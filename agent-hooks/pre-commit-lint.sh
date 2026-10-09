#!/usr/bin/env bash
# Lifecycle hook: runs fast Oxlint check on staged files before commit
set -e

echo "⚡ [Hook: pre-commit] Running Oxlint on staged files..."
cd frontend
npx oxlint --deny-warnings
echo "✅ [Hook: pre-commit] Oxlint check passed."
