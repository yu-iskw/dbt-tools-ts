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

function tokenizeSQL(sql: string): SqlToken[] {
  const readBlockComment = (start: number): string | null => {
    if (!sql.startsWith('/*', start)) return null;
    const end = sql.indexOf('*/', start + 2);
    return end === -1 ? sql.slice(start) : sql.slice(start, end + 2);
  };

  const readLineComment = (start: number): string | null => {
    if (!sql.startsWith('--', start)) return null;
    const end = sql.indexOf('\n', start);
    return end === -1 ? sql.slice(start) : sql.slice(start, end + 1);
  };

  const readStringLiteral = (start: number): string | null => {
    if (sql[start] !== "'") return null;
    let end = start + 1;
    while (end < sql.length) {
      if (sql[end] === "'" && sql[end - 1] !== '\\') {
        end += 1;
        break;
      }
      end += 1;
    }
    return sql.slice(start, end);
  };

  const readNumberLiteral = (start: number): string | null => {
    const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(sql.slice(start));
    if (!numMatch || (start > 0 && /[a-zA-Z_]/.test(sql[start - 1]))) {
      return null;
    }
    return numMatch[0];
  };

  const readWord = (start: number): { type: string; value: string } | null => {
    const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(sql.slice(start));
    if (!wordMatch) return null;
    const word = wordMatch[0];
    const upper = word.toUpperCase();
    return {
      type: SQL_KEYWORDS.has(upper)
        ? 'keyword'
        : SQL_FUNCTIONS.has(upper)
          ? 'function'
          : 'identifier',
      value: word,
    };
  };

  const readStructuredToken = (start: number): { type: string; value: string } | null => {
    const value =
      readBlockComment(start) ??
      readLineComment(start) ??
      readStringLiteral(start) ??
      readNumberLiteral(start);
    if (value == null) return null;
    if (value.startsWith('/*') || value.startsWith('--')) {
      return { type: 'comment', value };
    }
    if (sql[start] === "'") {
      return { type: 'string', value };
    }
    return { type: 'number', value };
  };

  const singleCharTokenType = (char: string): string | null => {
    if (/[=<>!|+\-*/%^&~]/.test(char)) return 'operator';
    if (/[(),;.[\]{}]/.test(char)) return 'punctuation';
    return null;
  };

  const tokens: SqlToken[] = [];
  let pos = 0;
  const len = sql.length;

  while (pos < len) {
    const structuredToken = readStructuredToken(pos);
    if (structuredToken != null) {
      tokens.push(structuredToken);
      pos += structuredToken.value.length;
      continue;
    }

    const word = readWord(pos);
    if (word != null) {
      tokens.push(word);
      pos += word.value.length;
      continue;
    }
    const charType = singleCharTokenType(sql[pos]);
    if (charType != null) {
      tokens.push({ type: charType, value: sql[pos] });
      pos++;
      continue;
    }
    tokens.push({ type: 'plain', value: sql[pos] });
    pos++;
  }
  return tokens;
}

export function SqlPanel({ sql }: { sql: string }) {
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
