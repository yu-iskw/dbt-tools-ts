import { FieldFilter, formatOutput, resolveStdoutFormat } from '@dbt-tools/core';

export function emitActionOutput<T>(
  output: T,
  options: { format?: string; fields?: string },
  humanFormatter: (o: T) => string,
): void {
  if (resolveStdoutFormat(options.format) === 'json') {
    const out = options.fields
      ? FieldFilter.filterFields(output as unknown as Record<string, unknown>, options.fields)
      : output;
    console.log(formatOutput(out, options.format));
  } else {
    console.log(humanFormatter(output));
  }
}
