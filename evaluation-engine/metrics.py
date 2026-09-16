"""SealML evaluation engine — metrics from a predictions CSV.

CSV format: label,pred[,group]  (binary 0/1 labels and predictions)
Only aggregate counts leave this module; row-level data is never printed,
returned, or transmitted.
"""
import csv


def load_counts(path):
    """Return (tp, tn, fp, fn, total, groups) without retaining rows."""
    tp = tn = fp = fn = 0
    groups = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        if "label" not in (reader.fieldnames or []) or "pred" not in (reader.fieldnames or []):
            raise ValueError("CSV must have label,pred columns")
        has_group = "group" in (reader.fieldnames or [])
        for row in reader:
            try:
                label = int(row["label"])
                pred = int(row["pred"])
            except (ValueError, TypeError):
                raise ValueError("label and pred must be 0/1")
            if label not in (0, 1) or pred not in (0, 1):
                raise ValueError("label and pred must be 0/1")
            if label == 1 and pred == 1:
                tp += 1
            elif label == 0 and pred == 0:
                tn += 1
            elif label == 0 and pred == 1:
                fp += 1
            else:
                fn += 1
            if has_group:
                g = groups.setdefault(row["group"], [0, 0, 0, 0])
                if label == 1 and pred == 1:
                    g[0] += 1
                elif label == 0 and pred == 0:
                    g[1] += 1
                elif label == 0 and pred == 1:
                    g[2] += 1
                else:
                    g[3] += 1
    return tp, tn, fp, fn, tp + tn + fp + fn, groups


def safe_div(a, b):
    return a / b if b else 0.0


def compute_metrics(tp, tn, fp, fn):
    total = tp + tn + fp + fn
    accuracy = safe_div(tp + tn, total)
    precision = safe_div(tp, tp + fp)
    recall = safe_div(tp, tp + fn)
    error_rate = safe_div(fp + fn, total)
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "error-rate": error_rate,
        "samplesEvaluated": total,
    }


def group_error_rates(groups):
    """Per-group error rate from aggregate counts only."""
    rates = {}
    for name, (tp, tn, fp, fn) in groups.items():
        rates[name] = safe_div(fp + fn, tp + tn + fp + fn)
    return rates


def fairness_delta(rates):
    """Max pairwise difference of group error rates (claim only)."""
    vals = list(rates.values())
    if len(vals) < 2:
        return 0.0
    return max(vals) - min(vals)
