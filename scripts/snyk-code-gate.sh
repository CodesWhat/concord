#!/usr/bin/env bash
# Run snyk code test as informational scan.
# Prints findings for developer awareness but does not block push.
set -uo pipefail

echo "Running Snyk Code SAST scan (informational)..."
snyk code test --severity-threshold=high "$@" 2>&1 || true
echo "Snyk Code: scan complete (informational — see CI for gate)"
