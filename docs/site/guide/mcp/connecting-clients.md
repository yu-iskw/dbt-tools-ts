# Connecting MCP clients

`dbt-tools-mcp` is a **stdio** MCP server. It keeps a dbt artifact run parsed in memory so clients can issue many small queries without reloading large manifests on every call.

## When to use MCP vs CLI

| Use MCP                                                   | Use CLI instead                    |
| --------------------------------------------------------- | ---------------------------------- |
| An AI coding agent issues many tool calls on the same run | One-shot shell or CI command       |
| Parse cost dominates (large manifest, remote target)      | Simple `status` or `summary` check |

Skills from [Install agent skills](../agents/install.md) run the **CLI** on your machine. MCP is optional for native MCP tool integration.

## Launch

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

Or global install:

```bash
npm install -g @dbt-tools/mcp
dbt-tools-mcp --dbt-target ./target
```

Set `DBT_TOOLS_DBT_TARGET` so client configs can omit the flag.

## Client configuration (pattern)

Point your MCP client at the `dbt-tools-mcp` binary with the same artifact root:

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "dbt-tools-mcp",
      "args": ["--dbt-target", "./target"]
    }
  }
}
```

Exact config file location depends on your editor—see your MCP host documentation.

## Learn more

- [Getting started](./getting-started.md)
- [Configuration](../../reference/configuration.md)
- [Troubleshooting](../../reference/troubleshooting.md) — MCP stdio issues
- [MCP README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md)
