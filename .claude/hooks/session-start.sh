#!/bin/bash
# SessionStart hook for Claude Code cloud sessions only (no-op on local machines).
# - Installs npm dev dependencies so `node tests/run-all.js` and `npm run lint` work.
# - Installs the playwright-cli binary used by .claude/skills/playwright-cli and points
#   it at the Chromium preinstalled in the cloud image (Google Chrome is not available).
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PLAYWRIGHT_CLI_VERSION="0.1.22"
CHROMIUM_PATH="/opt/pw-browsers/chromium"

log() { echo "[SessionStart] $*" >&2; }

# npm rewrites yarn.lock when it exists; keep the tracked file untouched.
cd "$PROJECT_DIR" || exit 0
yarn_backup=""
if [ -f yarn.lock ]; then
  yarn_backup="$(mktemp)"
  cp yarn.lock "$yarn_backup"
fi
if ! npm install --ignore-scripts --no-audit --no-fund >/dev/null 2>&1; then
  log "npm install failed; tests and lint may not run"
fi
if [ -n "$yarn_backup" ]; then
  cp "$yarn_backup" yarn.lock
  rm -f "$yarn_backup"
fi

installed="$(playwright-cli --version 2>/dev/null || true)"
if [ "$installed" != "$PLAYWRIGHT_CLI_VERSION" ]; then
  if ! npm install --global --ignore-scripts --no-audit --no-fund "@playwright/cli@${PLAYWRIGHT_CLI_VERSION}" >/dev/null 2>&1; then
    log "could not install @playwright/cli@${PLAYWRIGHT_CLI_VERSION}"
  fi
fi

if [ -x "$CHROMIUM_PATH" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export PLAYWRIGHT_MCP_BROWSER=chromium"
    echo "export PLAYWRIGHT_MCP_EXECUTABLE_PATH=${CHROMIUM_PATH}"
  } >> "$CLAUDE_ENV_FILE"
fi

exit 0
