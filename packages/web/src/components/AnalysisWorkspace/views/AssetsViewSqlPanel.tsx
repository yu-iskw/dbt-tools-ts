import type { ReactElement } from 'react';
// ---------------------------------------------------------------------------
// SQL syntax highlighting — zero-dependency tokenizer
// ---------------------------------------------------------------------------
const SQL_KEYWORDS = new Set(
  'SELECT FROM WHERE WITH AS JOIN ON GROUP BY ORDER LIMIT HAVING UNION CASE WHEN THEN ELSE END LEFT RIGHT INNER OUTER CROSS DISTINCT NULL AND OR NOT IN IS BETWEEN LIKE EXISTS INSERT INTO UPDATE SET DELETE CREATE TABLE VIEW REPLACE IF ASC DESC USING AT ZONE INTERVAL QUALIFY WINDOW ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW PARTITION OVER'.split(
    ' ',
  ),
);
const SQL_FUNCTIONS = new Set(
  'SUM COUNT AVG MAX MIN COALESCE CAST IFF IF ROW_NUMBER RANK DENSE_RANK NTILE LEAD LAG FIRST_VALUE LAST_VALUE NVL NVL2 NULLIF GREATEST LEAST TRIM LTRIM RTRIM UPPER LOWER LENGTH SUBSTR SUBSTRING REPLACE SPLIT CONCAT DATE YEAR MONTH DAY HOUR MINUTE SECOND DATEDIFF DATEADD CURRENT_DATE CURRENT_TIMESTAMP TO_DATE TO_TIMESTAMP TO_NUMBER TO_VARCHAR TRY_CAST CONVERT FLOOR CEIL ROUND ABS MOD SQRT LOG EXP ARRAY_AGG LISTAGG STRING_AGG GROUP_CONCAT FLATTEN UNNEST GENERATE_SERIES'.split(
    ' ',
  ),
);

interface SqlToken {
  type: string;
  value: string;
}

function isIdentifierStart(ch: string): boolean {
  return /[a-zA-Z_]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function readBlockComment(sql: string, start: number): string | null {
  if (!sql.startsWith('/*', start)) return null;
  const end = sql.indexOf('*/', start + 2);
  return end === -1 ? sql.slice(start) : sql.slice(start, end + 2);
}

function readLineComment(sql: string, start: number): string | null {
  if (!sql.startsWith('--', start)) return null;
  const end = sql.indexOf('\n', start);
  return end === -1 ? sql.slice(start) : sql.slice(start, end + 1);
}

function readStringLiteral(sql: string, start: number): string | null {
  if (sql.charAt(start) !== "'") return null;
  let end = start + 1;
  while (end < sql.length) {
    if (sql.charAt(end) === "'" && sql.charAt(end - 1) !== '\\') {
      end += 1;
      break;
    }
    end += 1;
  }
  return sql.slice(start, end);
}

function readNumberLiteral(sql: string, start: number): string | null {
  if (start > 0 && isIdentifierPart(sql.charAt(start - 1))) {
    return null;
  }
  let end = start;
  while (end < sql.length && isDigit(sql.charAt(end))) {
    end += 1;
  }
  if (end === start) return null;
  if (sql.charAt(end) === '.') {
    let frac = end + 1;
    while (frac < sql.length && isDigit(sql.charAt(frac))) {
      frac += 1;
    }
    if (frac > end + 1) {
      end = frac;
    }
  }
  return sql.slice(start, end);
}

function readWord(sql: string, start: number): { type: string; value: string } | null {
  if (!isIdentifierStart(sql.charAt(start))) return null;
  let end = start + 1;
  while (end < sql.length && isIdentifierPart(sql.charAt(end))) {
    end += 1;
  }
  const word = sql.slice(start, end);
  const upper = word.toUpperCase();
  return {
    type: SQL_KEYWORDS.has(upper)
      ? 'keyword'
      : SQL_FUNCTIONS.has(upper)
        ? 'function'
        : 'identifier',
    value: word,
  };
}

function readStructuredToken(sql: string, start: number): { type: string; value: string } | null {
  const value =
    readBlockComment(sql, start) ??
    readLineComment(sql, start) ??
    readStringLiteral(sql, start) ??
    readNumberLiteral(sql, start);
  if (value == null) return null;
  if (value.startsWith('/*') || value.startsWith('--')) {
    return { type: 'comment', value };
  }
  if (sql.charAt(start) === "'") {
    return { type: 'string', value };
  }
  return { type: 'number', value };
}

function singleCharTokenType(char: string): string | null {
  if (/[=<>!|+\-*/%^&~]/.test(char)) return 'operator';
  if (/[(),;.[\]{}]/.test(char)) return 'punctuation';
  return null;
}

function tokenizeSQL(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let pos = 0;
  const len = sql.length;

  while (pos < len) {
    const structuredToken = readStructuredToken(sql, pos);
    if (structuredToken != null) {
      tokens.push(structuredToken);
      pos += structuredToken.value.length;
      continue;
    }

    const word = readWord(sql, pos);
    if (word != null) {
      tokens.push(word);
      pos += word.value.length;
      continue;
    }
    const ch = sql.charAt(pos);
    const charType = singleCharTokenType(ch);
    if (charType != null) {
      tokens.push({ type: charType, value: ch });
      pos += 1;
      continue;
    }
    tokens.push({ type: 'plain', value: ch });
    pos += 1;
  }
  return tokens;
}

export function SqlPanel({ sql }: { sql: string }): ReactElement {
  const tokens = tokenizeSQL(sql);
  return (
    <pre className="sql-panel">
      <code>
        {tokens.map((token, i) =>
          token.type === 'plain' || token.type === 'identifier' ? (
            token.value
          ) : (
            <span key={i} className={`sql-token-${token.type}`}>
              {token.value}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
