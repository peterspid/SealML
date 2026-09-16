#!/usr/bin/env bash
# Compile every SealML Compact contract. Fails fast on first error.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/contracts/build"
mkdir -p "$OUT"
for src in "$ROOT"/contracts/*.compact; do
  name="$(basename "$src" .compact)"
  echo "--- compiling $name"
  compact compile "$src" "$OUT/$name"
done
echo "ALL CONTRACTS COMPILED -> $OUT"
