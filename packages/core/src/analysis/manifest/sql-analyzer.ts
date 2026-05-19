import { Parser } from 'node-sql-parser';

import type { Select } from 'node-sql-parser';

/** AST node shapes from node-sql-parser (loosely typed for runtime objects) */
interface AstColumnRef {
  type: 'column_ref';
  table?: string;
  column: unknown;
}
interface AstBinaryExpr {
  type: 'binary_expr';
  left: unknown;
  right: unknown;
}
interface AstFunction {
  type: 'function';
  args?: { value?: unknown[] };
}
interface AstAggrFunc {
  type: 'aggr_func';
  args?: { expr?: unknown };
}
interface AstCase {
  type: 'case';
  args?: Array<{ cond?: unknown; result?: unknown }>;
  fallback?: unknown;
}
interface AstCast {
  type: 'cast';
  expr?: unknown;
}
type AstNode =
  | AstAggrFunc
  | AstBinaryExpr
  | AstCase
  | AstCast
  | AstColumnRef
  | AstFunction
  | Record<string, unknown>;

interface SelectColumn {
  as?: string | { value?: string };
  expr?: AstNode | null;
}
interface FromClause {
  table?: string;
  as?: string;
  expr?: { ast?: unknown };
}

export interface ColumnDependency {
  sourceTable: string;
  sourceColumn: string;
}

export type ColumnDependencyMap = Record<string, ColumnDependency[]>;

/**
 * SQLAnalyzer performs AST analysis on SQL to infer column-level lineage.
 */
export class SQLAnalyzer {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Analyze SQL to extract column-level dependencies.
   * @param sql The compiled SQL code.
   * @param dialect The SQL dialect (e.g., 'mysql', 'postgresql', 'snowflake').
   * @returns A map of target column names to their source dependencies.
   */
  public analyze(sql: string, dialect: string = 'mysql'): ColumnDependencyMap {
    try {
      let cleanSql = sql.trim();
      while (cleanSql.endsWith(';')) {
        cleanSql = cleanSql.slice(0, -1);
      }
      const ast = this.parser.astify(cleanSql, { database: dialect });

      if (Array.isArray(ast)) {
        const selectAst = ast.find((s) => s.type === 'select') as Select;
        return selectAst ? this.analyzeSelect(selectAst, dialect) : {};
      }

      return this.analyzeSelect(ast as Select, dialect);
    } catch {
      return {};
    }
  }

  private analyzeSelect(
    select: Select,
    dialect: string,
    parentCteMap: Record<string, ColumnDependencyMap> = {},
  ): ColumnDependencyMap {
    if (!select || select.type !== 'select') return {};

    const tableMap = this.buildTableMap(
      (Array.isArray(select.from) ? select.from : []) as unknown[],
    );
    const cteMap = this.buildCteMap(select, dialect, parentCteMap);
    if (!select.columns || !Array.isArray(select.columns)) return {};

    return this.processSelectColumns(select.columns as SelectColumn[], tableMap, cteMap);
  }

  private buildCteMap(
    select: Select,
    dialect: string,
    parentCteMap: Record<string, ColumnDependencyMap>,
  ): Record<string, ColumnDependencyMap> {
    const cteMap = { ...parentCteMap };
    if (!select.with || !Array.isArray(select.with)) return cteMap;

    for (const cte of select.with) {
      if (cte.stmt?.ast) {
        cteMap[cte.name.value] = this.analyzeSelect(cte.stmt.ast as Select, dialect, cteMap);
      }
    }
    return cteMap;
  }

  private getColumnTargetName(col: SelectColumn): string | undefined {
    const asVal = col.as;
    if (asVal !== undefined && asVal !== null) {
      return typeof asVal === 'string'
        ? asVal
        : typeof (asVal as { value?: unknown }).value === 'string'
          ? (asVal as { value: string }).value
          : undefined;
    }
    if (
      col.expr &&
      typeof col.expr === 'object' &&
      (col.expr as AstColumnRef).type === 'column_ref'
    ) {
      return this.extractColumnName((col.expr as AstColumnRef).column);
    }
    return undefined;
  }

  private processSelectColumns(
    columns: SelectColumn[],
    tableMap: Record<string, string>,
    cteMap: Record<string, ColumnDependencyMap>,
  ): ColumnDependencyMap {
    const dependencies: ColumnDependencyMap = {};

    for (const col of columns) {
      const targetName = this.getColumnTargetName(col);

      if (!targetName || targetName === '*') {
        const colColumn =
          col.expr &&
          typeof col.expr === 'object' &&
          (col.expr as AstColumnRef).type === 'column_ref'
            ? this.extractColumnName((col.expr as AstColumnRef).column)
            : undefined;
        if (targetName === '*' || colColumn === '*') {
          const starDeps = this.resolveExpressionDependencies(col.expr, tableMap, cteMap);
          dependencies['*'] = this.uniqueDependencies(starDeps);
        }
        continue;
      }

      const colDeps = this.resolveExpressionDependencies(col.expr, tableMap, cteMap);
      const uniqueDeps = this.uniqueDependencies(colDeps);
      if (uniqueDeps.length > 0) {
        dependencies[targetName] = uniqueDeps;
      }
    }

    return dependencies;
  }

  private extractColumnName(column: unknown): string {
    if (typeof column === 'string') return column;
    if (column && typeof column === 'object') {
      const c = column as Record<string, unknown>;
      const expr = c.expr;
      if (
        expr &&
        typeof expr === 'object' &&
        (expr as Record<string, unknown>).type === 'default'
      ) {
        return String((expr as Record<string, unknown>).value);
      }
    }
    return String(column);
  }

  private buildTableMap(from: unknown[]): Record<string, string> {
    const map: Record<string, string> = {};
    if (!from || !Array.isArray(from)) return map;

    for (const item of from) {
      const f = item as FromClause;
      if (f.table) {
        const actualTable = f.table;
        const alias = f.as || actualTable;
        map[alias] = actualTable;
      } else if (f.expr && f.expr.ast) {
        const subqueryAlias = f.as;
        if (subqueryAlias) {
          map[subqueryAlias] = `__subquery_${subqueryAlias}__`;
        }
      }
    }
    return map;
  }

  private resolveExpressionDependencies(
    expr: unknown,
    tableMap: Record<string, string>,
    cteMap: Record<string, ColumnDependencyMap>,
  ): ColumnDependency[] {
    const deps: ColumnDependency[] = [];
    this.traverseAst(expr, tableMap, cteMap, deps);
    return deps;
  }

  private traverseAst(
    node: unknown,
    tableMap: Record<string, string>,
    cteMap: Record<string, ColumnDependencyMap>,
    deps: ColumnDependency[],
  ): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    switch (n.type) {
      case 'column_ref':
        this.collectColumnRefDeps(n, tableMap, cteMap, deps);
        break;
      case 'binary_expr':
        this.traverseAst(n.left, tableMap, cteMap, deps);
        this.traverseAst(n.right, tableMap, cteMap, deps);
        break;
      case 'function': {
        const args = n.args as { value?: unknown[] } | undefined;
        if (args?.value) for (const a of args.value) this.traverseAst(a, tableMap, cteMap, deps);
        break;
      }
      case 'aggr_func': {
        const args = n.args as { expr?: unknown } | undefined;
        if (args?.expr) this.traverseAst(args.expr, tableMap, cteMap, deps);
        break;
      }
      case 'case': {
        const args = n.args as Array<{ cond?: unknown; result?: unknown }>;
        if (args)
          for (const arg of args) {
            this.traverseAst(arg.cond, tableMap, cteMap, deps);
            this.traverseAst(arg.result, tableMap, cteMap, deps);
          }
        this.traverseAst(n.fallback, tableMap, cteMap, deps);
        break;
      }
      case 'cast':
        this.traverseAst(n.expr, tableMap, cteMap, deps);
        break;
    }
  }

  private collectColumnRefDeps(
    n: Record<string, unknown>,
    tableMap: Record<string, string>,
    cteMap: Record<string, ColumnDependencyMap>,
    deps: ColumnDependency[],
  ): void {
    const tableAlias = n.table as string | undefined;
    const columnName = this.extractColumnName(n.column);

    if (tableAlias) {
      const actualTable = tableMap[tableAlias];
      if (actualTable) {
        this.pushColumnDeps(actualTable, columnName, cteMap, deps);
      }
      return;
    }

    const tables = Object.values(tableMap);
    if (tables.length === 1) {
      this.pushColumnDeps(tables[0], columnName, cteMap, deps);
      return;
    }
    for (const table of tables) {
      const cteCols = cteMap[table]?.[columnName];
      if (cteCols?.length) deps.push(...cteCols);
    }
  }

  private pushColumnDeps(
    actualTable: string,
    columnName: string,
    cteMap: Record<string, ColumnDependencyMap>,
    deps: ColumnDependency[],
  ): void {
    const cteDeps = cteMap[actualTable]?.[columnName] ?? [];
    if (cteDeps.length > 0) {
      deps.push(...cteDeps);
    } else {
      deps.push({ sourceTable: actualTable, sourceColumn: columnName });
    }
  }

  private uniqueDependencies(deps: ColumnDependency[]): ColumnDependency[] {
    const seen = new Set<string>();
    return deps.filter((d) => {
      const key = `${d.sourceTable}.${d.sourceColumn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/**
 * Map dbt manifest `metadata.adapter_type` to node-sql-parser `database` names
 * passed to `SQLAnalyzer.analyze`. Unknown adapters fall back to `mysql`
 * (historical CLI default).
 */
export function sqlDialectFromDbtAdapterType(adapterType: string | null | undefined): string {
  if (adapterType == null || typeof adapterType !== 'string') return 'mysql';
  const n = adapterType.trim().toLowerCase();
  switch (n) {
    case 'snowflake':
      return 'snowflake';
    case 'bigquery':
      return 'bigquery';
    case 'postgres':
    case 'postgresql':
      return 'postgresql';
    case 'redshift':
      return 'redshift';
    case 'sqlite':
      return 'sqlite';
    case 'databricks':
    case 'spark':
    case 'trino':
    case 'athena':
      return 'postgresql';
    default:
      return 'mysql';
  }
}
