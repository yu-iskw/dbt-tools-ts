# @dbt-tools/mcp

`@dbt-tools/mcp` is a Model Context Protocol (MCP) server that exposes dbt artifact analysis to AI agents and LLM-based tooling.

## What is MCP?

The Model Context Protocol is a standard for connecting AI agents to external tools and data sources. Running `@dbt-tools/mcp` allows an AI assistant or agent workflow to query your dbt project's artifacts through a structured protocol.

## Installation

Run without installing using `npx`:

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

## Configuration

Connect the MCP server to your agent by pointing it at your dbt target directory:

```bash
npx @dbt-tools/mcp --dbt-target /path/to/your/dbt/project/target
```

## MCP Client Setup

Configure your MCP client (such as Claude Desktop) to use the server:

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["@dbt-tools/mcp", "--dbt-target", "./target"]
    }
  }
}
```

## Capabilities

The MCP server exposes tools for querying dbt artifact data, including model status, lineage, and metadata.
