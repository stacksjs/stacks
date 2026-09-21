---
title: Query Monitoring
description: "The Query Monitoring system provides comprehensive tools to collect, analyze, and monitor database queries in your application. This helps you identify per..."
---
# Query Monitoring

The Query Monitoring system provides comprehensive tools to collect, analyze, and monitor database queries in your application. This helps you identify performance bottlenecks, optimize slow queries, and understand database usage patterns.

## Features

- **Real-time Query Logging**: Automatically logs all database queries with detailed information
- **Query Analysis**: Analyzes query patterns, identifies slow queries, and suggests optimizations
- **Dashboard Interface**: Visual dashboard for monitoring query performance metrics
- **Detailed Query Information**: Displays each query's text, type, duration, status, connection, affected tables and optimization suggestions, and the model and method behind a slow or failed query. Bindings (with credentials redacted) and caller traces are recorded in `query_logs` but not shown on the dashboard
- **Advanced Filtering**: Filter queries by type, status, connection, and more
- **Optimization Suggestions**: Automated recommendations for improving query performance

## Configuration

Query monitoring can be configured in your `config/database.ts` file:

```typescript
export default {
  // ... other database configs

  queryLogging: {
    // Persistent history defaults on outside production and off in production
    enabled: process.env.DB_QUERY_LOGGING_ENABLED === 'true',

    // Also capture caller stacks for successful fast queries
    captureAllTraces: false,

    // Keep bound values, with credentials redacted (see Bindings); defaults
    // to false in production, which keeps only each value's type
    captureBindings: true,

    // Columns whose values are secret although their names are not, on top
    // of the names recognised anyway (see Sensitive columns)
    sensitiveColumns: ['gift_cards.code'],

    // Threshold in milliseconds to mark a query as slow
    slowThreshold: 100,

    // Days to keep query logs before pruning
    retention: 7,

    // How often to run the pruning job (in hours)
    pruneFrequency: 24,

    // Queries to exclude from logging
    excludedQueries: ['query_logs'],

    // Query analysis options
    analysis: {
      enabled: true,
      analyzeAll: false,
      explainPlan: true,
      suggestions: true,
    },
  },
}
```

## Environment Variables

You can also configure query monitoring using environment variables:

```
DB_QUERY_LOGGING_ENABLED=true
DB_QUERY_LOGGING_CAPTURE_ALL_TRACES=false
DB_QUERY_LOGGING_CAPTURE_BINDINGS=true
DB_QUERY_LOGGING_SLOW_THRESHOLD=100
DB_QUERY_LOGGING_RETENTION_DAYS=7
DB_QUERY_LOGGING_PRUNE_FREQUENCY=24
DB_QUERY_LOGGING_ANALYSIS_ENABLED=true
DB_QUERY_LOGGING_ANALYZE_ALL=false
DB_QUERY_LOGGING_EXPLAIN_PLAN=true
DB_QUERY_LOGGING_SUGGESTIONS=true
```

`DB_QUERY_LOGGING_CAPTURE_BINDINGS` takes `true`/`false`, `1`/`0`, `yes`/`no`
or `on`/`off`, in any letter case. Any other value keeps only the type of each
binding and prints a warning once.

Persistent query history is disabled by default in production because every
application query otherwise creates an additional database write. Set
`DB_QUERY_LOGGING_ENABLED=true` when durable history is worth that cost.
Development retains request-scoped query tracking for error diagnostics when
persistence is disabled. In production without durable history, SQLite runs
with no query hooks at all. PostgreSQL and MySQL keep a single `onQueryError`
hook, which reports a Bun SQL pool broken by
[oven-sh/bun#42804](https://github.com/oven-sh/bun/issues/42804) and runs
nothing for a query that succeeds. bun-query-builder still takes its
instrumented path for every query once any hook is set; against a local
PostgreSQL 16 that cost was around a microsecond per query, within the noise
of a 54µs query. The hook sees builder queries and raw queries only: ORM model
queries, `db.unsafe()` and a transaction's `BEGIN` never reach it, so a pool
that only those use is reported when `/api/health` runs its own probe.

## Bindings

The values a query binds are stored in `query_logs.bindings` as a JSON array,
one entry per parameter. The table outlives the request and
`GET /api/queries/:id` returns it, so credentials are kept out of it. An entry
is stored as `<redacted>` when:

- the SQL binds it to a column with a sensitive name, such as `password`,
  `remember_token`, `api_key`, `two_factor_secret` or `otp`;
- it is text and the statement reads or writes a table with a sensitive name,
  such as `sessions`, `password_resets` or `oauth_access_tokens`, where even
  the `id` is a credential;
- it is text, its column cannot be worked out from the SQL, and the statement
  names something sensitive;
- it is an object, or text holding JSON, with a key that has a sensitive name
  at any depth, such as `{"api_key": "..."}` bound to a `settings` column,
  including JSON encoded inside a JSON string;
- it looks like a credential by itself: a password hash, a JWT, a run of 32 or
  more hex digits, a long mixed-case random token, or a Stripe or AWS key;
- the SQL binds it to a column the application lists in `sensitiveColumns`
  (see [Sensitive columns](#sensitive-columns)).

Every other value is kept outside production, so the log still shows which id
or status a query used. In production `captureBindings` defaults to `false`
and each entry is only its type (`<string>`, `<number>`, `<date>`, ...): the
count and shape survive, the user data does not. Enabling `captureBindings`
in `config/database.ts`, or setting `DB_QUERY_LOGGING_CAPTURE_BINDINGS=true`,
keeps values in production too, with the same redaction. An app config written
before `captureBindings` existed has no key for it: it gets the same defaults
and still reads `DB_QUERY_LOGGING_CAPTURE_BINDINGS`. Binary values are only
ever recorded as `<bytes>`.

### Sensitive columns

The names above are the ones every application shares. A column that is
secret in yours but looks ordinary, such as a gift card's `code`, is listed
in `sensitiveColumns`. The list extends those names and never replaces them:

```typescript
queryLogging: {
  sensitiveColumns: [
    'gift_cards.code', // `code` in gift_cards only
    'serial', // `serial` in every table
  ],
}
```

A bare name is that column in every table. A `table.column` entry is that
column where a statement writes it against the table or an alias of it
(`gift_cards.code`, or `g.code` after `FROM gift_cards g`), and not where it
writes it against another table the statement names (`c.code` after
`FROM coupons c`). A column written without its table counts wherever the
statement names the table, because which table it belongs to is not known:
`SELECT * FROM coupons JOIN gift_cards ... WHERE code = ?` redacts the value,
`SELECT * FROM coupons WHERE code = ?` keeps it. Names are compared without
quotes or letter case, and a schema before the table is ignored.

A listed column's values are stored as `<redacted>` and taken out of the
error of a failed query (see [Errors](#errors)). An entry that is neither a
column nor `table.column`, such as `gift_cards.*`, marks nothing; the logger
prints a warning for it once.

### What the redaction can miss

The redaction works from names and shapes. Wherever values are kept (outside
production, or in production with `captureBindings` enabled), these are kept
as bound:

- a secret in a column with an ordinary name that also looks ordinary, such as
  a six-character `code`, unless the column is listed in
  [`sensitiveColumns`](#sensitive-columns);
- a number bound to an ordinary column of a sensitive table: only text is
  redacted there, so a numeric one-time code in `verifications.code` is kept
  unless that column is listed;
- text bound to an ordinary column of a sensitive table that the statement
  names only after a comma (`FROM users, sessions`), after `USING`, or after
  `UPDATE ONLY`: a table is recognised only right after `FROM`, `INTO`,
  `JOIN`, `TABLE` or `UPDATE`;
- a value compared with a JSON path key written as a string, such as
  `meta->>'password' = ?` or `JSON_EXTRACT(meta, '$.password') = ?`: a string
  literal is not read as a column name.

Only bound values are covered: SQL that interpolates a value into its own text
is stored as written, so bind values rather than building them into the
statement.

A failed query's error has the same gaps, since a value is taken out of it
only where its binding withholds it (see [Errors](#errors)), and it also
keeps:

- in production, a number bound to an ordinary column, such as the
  `5551234567` of MySQL's `Duplicate entry '5551234567'`, and a copy of fewer
  than 8 characters of a value that is not secret, such as the `ada` of
  `Duplicate entry 'ada'`;
- a copy MySQL cut to fewer than 16 characters of a value. MySQL prints 64
  bytes of a duplicate key, and in a unique key over several columns a later
  value starts where the ones before it end: on MySQL 8.4 a key over a
  60-character value and a secret printed `'BBB...B-SEC'`, keeping `SEC`. A
  prefix index (`UNIQUE (token(10))`) prints only as much as it indexes;
- a value the statement changes before the driver prints it, such as
  `LOWER(?)` or `TRIM(?)`, or joins to other text so that a letter, digit or
  underscore runs into its start (`CONCAT('ref', ?)`), or into the end of a
  value shorter than 16 characters;
- a date or a boolean, which are not looked for, even where the binding is
  `<date>`, `<boolean>` or `<redacted>`: on MySQL 8.4 a duplicate key over a
  name and a bound date printed `Duplicate entry 'ada-1990-05-17 08:30:00'`,
  and a bound `true` printed as `1`;
- a value a driver prints in a form other than the ones listed under
  [Errors](#errors).

## Errors

The error of a failed query is stored in `query_logs.error`, and drivers
copy bound values into their messages: MySQL prints the value of a
duplicate key (`Duplicate entry '...' for key 'devices.token'`) and a value
a column rejects (`Incorrect integer value: '...'`), and PostgreSQL prints a
value it cannot parse (`invalid input syntax for type uuid: "..."`). Where
the driver printed text, JSON or bytes that the bindings store as
`<redacted>` or as a type, the stored error holds that marker instead;
numbers and short copies follow the rules below, and dates and booleans
are not looked for (see
[What the redaction can miss](#what-the-redaction-can-miss)):

```text
MySQLError: Duplicate entry '<redacted>' for key 'devices.token'
PostgresError: invalid input syntax for type uuid: "<string>"
```

A value is recognised as each driver prints it: as it is; as MySQL prints a
duplicate key, with a character beyond three UTF-8 bytes as `?` and nothing
after a NUL; and as MySQL prints a rejected value, with every byte beyond
printable ASCII as `\xHH`. An array is recognised as its JSON text, which is
how MySQL prints it, and item by item, since PostgreSQL prints its items
joined by commas (`malformed array literal: "a,b"`). A value of 16
characters or more is also recognised cut short, from its first 16
characters on, since MySQL cuts a duplicate key at 64 bytes and a rejected
value at 128 characters; a shorter value only whole. A copy is left alone
where it continues a word, with a letter, digit or underscore on both sides
of where it starts, and so is a whole copy of a value shorter than 16
characters that runs on into a word at its end: a bound `a` does not take
the `a` out of `value`.

Other than that, a copy of a withheld value is replaced wherever it stands,
also where it spells one of the message's own words or a table or key name:
a redacted password `users` turns `for key 'users.email'` into
`for key '<redacted>.email'`. So that this does not happen to every short
value in production, where every value is a type, a copy of fewer than 8
characters is replaced only when its value is secret, meaning it would be
`<redacted>` if values were kept: a bound `key` or `email` leaves
`for key 'users.email'` as it is. A number is likewise replaced only when it
is secret, as a number in an `otp` column or a listed column is: in
production every number is a type, and replacing each id would turn
`at row 1` into `at row <number>`. In production, text longer than 65,536
characters is taken to be secret without being read, and so is an object or
array whose keys and values come to more than that in its JSON text (commas
and escapes are not counted), so its numbers and short copies are replaced
too.

The stored error keeps at most the first 4,096 characters of the driver's
message, since PostgreSQL prints a value it cannot parse in full, and ends
with `<truncated: N more characters>` when the message was longer. A
recognised copy that runs past that point is replaced whole. PostgreSQL
keeps the key of a duplicate in the error's detail, which is not stored.

A bound array is looked for as its own JSON text, which is how MySQL prints
it, and as each item that is not itself an array, which is how PostgreSQL
prints one. Arrays are read only as far as 32 deep. All the values of one
query together are read only as far as 100,000 items and 16,777,216
characters of the forms they can be printed in; the forms MySQL alone
prints stop at 512 characters, as its error messages do. Past any of these
the values are not looked for, and the stored error is the marker of the
binding where reading stopped, such as `<object>` or `<redacted>`.

## Dashboard Interface

The query monitoring dashboard provides several views:

### Overview

The dashboard home displays:

- Total query count and distribution by type
- Query performance metrics and trends
- Recent queries with filtering options
- Charts showing query distribution and performance

### Query History

The history page allows you to:

- Browse all logged queries
- Filter by time range, connection, status, and type
- Search for specific queries
- View detailed query execution information

### Slow Queries

The slow queries page focuses on:

- Identifying performance bottlenecks
- Showing queries that exceed the slow threshold
- Providing optimization suggestions
- Displaying performance metrics and patterns

### Query Details

The detail view shows one query log record:

- Query type, status, duration and when it ran
- Full query text, and the normalized version when it differs
- Connection and rows affected
- Model and method behind a slow or failed query
- Affected tables
- Optimization suggestions

It does not show the bindings, the stack trace, the file and line, the index
lists or the EXPLAIN plan. `GET /api/queries/:id` returns the whole record,
bindings and trace included, to an authenticated caller.

## API Endpoints

The following API endpoints are available for programmatic access:

- `GET /api/queries/stats` - Get query statistics and metrics
- `GET /api/queries/recent` - Get paginated list of recent queries
- `GET /api/queries/slow` - Get paginated list of slow queries
- `GET /api/queries/:id` - Get detailed information about a specific query
- `GET /api/queries/timeline` - Get query timeline data for charts
- `GET /api/queries/frequent` - Get most frequently run queries
- `POST /api/queries/prune` - Manually trigger pruning of old query logs

## Database Schema

Queries are stored in the `query_logs` table with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| query | text | The actual SQL query |
| normalized_query | text | Query with values replaced by placeholders |
| duration | numeric | Execution time in milliseconds |
| connection | text | Database connection used |
| status | text | Completed, slow, or failed |
| error | text | Error message if failed: its first 4,096 characters at most, with the values its bindings withhold replaced (see [Errors](#errors)) |
| executed_at | timestamp | When the query was executed |
| bindings | text | JSON array of query parameters, credentials redacted (see [Bindings](#bindings)) |
| trace | text | Stack trace for a slow or failed query |
| model | text | Model that executed a slow or failed query |
| method | text | Method that executed a slow or failed query |
| file | text | File path where a slow or failed query originated |
| line | integer | Line number where a slow or failed query originated |
| memory_usage | numeric | Memory used during execution |
| rows_affected | integer | Number of rows affected |
| transaction_id | text | Related transaction identifier |
| tags | text | JSON array of query tags |
| affected_tables | text | JSON array of tables affected |
| indexes_used | text | JSON array of indexes used |
| missing_indexes | text | JSON array of suggested indexes |
| explain_plan | text | Query execution plan |
| optimization_suggestions | text | JSON array of optimization suggestions |

## Automatic Maintenance

The system includes a scheduled job (`PruneQueryLogsJob`) that automatically removes old query logs based on your retention settings. The pruning frequency can be configured to ensure your database doesn't grow too large.

## Best Practices

1. **Production Settings**: In production, consider increasing the `slowThreshold` and disabling `analyzeAll` to reduce overhead.

2. **Retention Period**: Set a reasonable retention period based on your storage capacity and monitoring needs.

3. **Selective Logging**: Use `excludedQueries` to prevent logging frequent or unimportant queries.

4. **Database Impact**: Be aware that query logging itself adds some overhead. Monitor the performance impact and adjust settings accordingly.

5. **Caller Traces**: Slow and failed queries always include caller traces. Enable `captureAllTraces` only when fast-query call sites are worth the additional CPU and storage cost.

6. **Security**: Bindings are stored with credentials redacted, and in production only their types are kept unless `captureBindings` is enabled; a failed query's error has the values its bindings withhold taken out where the driver printed them, with the gaps listed under [What the redaction can miss](#what-the-redaction-can-miss). List the columns only your application knows are secret in `sensitiveColumns`. Query text and ordinary bound values can still carry personal data, so keep access to the query dashboard secured. The application log records a failed query's error as the driver threw it, outside `query_logs`.

## Debugging with Query Logs

Query logs can be invaluable for debugging:

- Identify queries executed during specific user actions
- Track down N+1 query problems
- Verify that ORM methods generate expected SQL
- Analyze query patterns during performance issues
- Monitor database load during specific operations
