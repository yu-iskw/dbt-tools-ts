#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pnpm --filter @dbt-tools/mcp build
echo "Launch MCP Inspector against a local target directory:"
echo "  npx @modelcontextprotocol/inspector -- node $ROOT/packages/mcp/dist/server.js --dbt-target ./target"
