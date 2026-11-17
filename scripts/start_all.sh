#!/usr/bin/env bash
# Starts API (5000) and React UI (5173). Ctrl+C stops both.
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
trap 'kill 0' EXIT
(cd backend && npm run start) &
(cd frontend && npm run dev) &
wait
