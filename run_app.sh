#!/usr/bin/env bash
# Start the Judge the Sample app locally.
#
#     bash run_app.sh
#
# Run it from a Bash terminal (macOS/Linux Terminal, or Git Bash/WSL on Windows).
# Stop the app with Ctrl+C.
set -euo pipefail

# Always work from the folder this script is in, wherever it was started from.
cd "$(dirname "$0")"

PORT=5173

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm was not found. Install Node.js 20 or later (it includes npm), then try again." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies with npm install..."
  npm install
fi

echo
echo "Starting the app. Open this address in your browser:"
echo "    http://localhost:${PORT}/"
echo "Stop it with Ctrl+C in this terminal."
echo

# --strictPort: if port ${PORT} is busy, stop with an error instead of silently
# moving to another address.
exec npm run dev -- --port "${PORT}" --strictPort
