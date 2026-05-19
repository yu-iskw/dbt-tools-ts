import type { Command } from 'commander';
import type { QueryExecutionsOptions } from '../actions/reporting/query-executions-action';

type RegisterOpts = {
  OPT_DBT_TARGET: string;
  DESC_DBT_TARGET: string;
  OPT_JSON: string;
  DESC_JSON: string;
  OPT_NO_JSON: string;
  DESC_NO_JSON: string;
  OPT_FIELDS: string;
  DESC_FIELDS: string;
};

const OPT_MIN_BYTES = '--min-bytes-processed <n>';
const DESC_MIN_BYTES = 'Minimum bytes processed';
const OPT_MIN_ROWS_AFFECTED = '--min-rows-affected <n>';
const DESC_MIN_ROWS_AFFECTED = 'Minimum rows affected';

function registerCommonQueryExecutionsOptions(command: Command, opts: RegisterOpts): Command {
  return command
    .option(opts.OPT_DBT_TARGET, opts.DESC_DBT_TARGET)
    .option('--sort <key>', 'Sort key (execution_time_desc, slot_ms_desc, rows_inserted_desc, …)')
    .option('--status <status>', 'Comma-separated statuses to include')
    .option('--limit <n>', 'Max rows to return', parseInt)
    .option('--offset <n>', 'Skip rows (requires --limit)', parseInt)
    .option(
      '--resource-types <types>',
      'Comma-separated resource types (default: model,test,unit_test)',
    )
    .option('--unique-id-pattern <pattern>', 'Glob pattern for unique_id')
    .option('--min-execution-time <seconds>', 'Minimum execution time', parseFloat)
    .option('--max-execution-time <seconds>', 'Maximum execution time', parseFloat)
    .option(opts.OPT_FIELDS, opts.DESC_FIELDS)
    .option(opts.OPT_JSON, opts.DESC_JSON)
    .option(opts.OPT_NO_JSON, opts.DESC_NO_JSON);
}

function registerBaseWarehouseOptions(command: Command): Command {
  return command
    .option(OPT_MIN_BYTES, DESC_MIN_BYTES, parseFloat)
    .option(OPT_MIN_ROWS_AFFECTED, DESC_MIN_ROWS_AFFECTED, parseFloat);
}

export function registerQueryExecutionsCommand(
  program: Command,
  opts: RegisterOpts,
  run: (options: QueryExecutionsOptions) => Promise<void>,
): void {
  const root = registerCommonQueryExecutionsOptions(
    program
      .command('query-executions')
      .description('Filter and sort run_results executions (time and warehouse metrics)'),
    opts,
  );

  root.action(async (options: QueryExecutionsOptions) => {
    await run(options);
  });

  const bigquery = registerCommonQueryExecutionsOptions(root.command('bigquery'), opts)
    .option('--min-slot-ms <n>', 'Minimum BigQuery slot_ms', parseFloat)
    .option(OPT_MIN_BYTES, DESC_MIN_BYTES, parseFloat)
    .option('--min-bytes-billed <n>', 'Minimum bytes billed', parseFloat)
    .option(OPT_MIN_ROWS_AFFECTED, DESC_MIN_ROWS_AFFECTED, parseFloat);
  bigquery.action(async (options: QueryExecutionsOptions) => {
    await run({ ...options, warehouse: 'bigquery' });
  });

  const snowflake = registerCommonQueryExecutionsOptions(root.command('snowflake'), opts)
    .option(OPT_MIN_BYTES, DESC_MIN_BYTES, parseFloat)
    .option(OPT_MIN_ROWS_AFFECTED, DESC_MIN_ROWS_AFFECTED, parseFloat)
    .option('--min-rows-inserted <n>', 'Minimum rows inserted', parseFloat)
    .option('--min-rows-updated <n>', 'Minimum rows updated', parseFloat)
    .option('--min-rows-deleted <n>', 'Minimum rows deleted', parseFloat)
    .option('--min-rows-duplicated <n>', 'Minimum rows duplicated', parseFloat);
  snowflake.action(async (options: QueryExecutionsOptions) => {
    await run({ ...options, warehouse: 'snowflake' });
  });

  for (const name of ['athena', 'postgres', 'redshift', 'spark'] as const) {
    const sub = registerCommonQueryExecutionsOptions(
      registerBaseWarehouseOptions(root.command(name)),
      opts,
    );
    sub.action(async (options: QueryExecutionsOptions) => {
      await run({ ...options, warehouse: name });
    });
  }
}
