"""Commitments and attestations. Hashes only — raw artifacts never leave disk."""
import hashlib
import json


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def chain_key(domain: str, element_id: str) -> str:
    return sha256_hex(f"{domain}:{element_id}".encode())


def build_attestation(payload: dict) -> dict:
    """Evaluator-signed attestation over claims (no raw data included)."""
    for forbidden in ("predictions", "dataset", "weights", "rows", "records"):
        if forbidden in payload:
            raise ValueError(f"attestation must not contain raw field: {forbidden}")
    body = json.dumps(payload, sort_keys=True).encode()
    return {
        "claims": payload,
        "proofCommitment": sha256_hex(b"proof:" + body),
    }
