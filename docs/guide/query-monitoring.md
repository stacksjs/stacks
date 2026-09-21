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
persistence is disabled. Production skips the query-hook path entirely unless
durable history is explicitly enabled.

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
  more hex digits, a long mixed-case random token, or a Stripe or AWS key.

Every other value is kept outside production, so the log still shows which id
or status a query used. In production `captureBindings` defaults to `false`
and each entry is only its type (`<string>`, `<number>`, `<date>`, ...): the
count and shape survive, the user data does not. Enabling `captureBindings`
in `config/database.ts`, or setting `DB_QUERY_LOGGING_CAPTURE_BINDINGS=true`,
keeps values in production too, with the same redaction. An app config written
before `captureBindings` existed has no key for it: it gets the same defaults
and still reads `DB_QUERY_LOGGING_CAPTURE_BINDINGS`. Binary values are only
ever recorded as `<bytes>`.

### What the redaction can miss

The redaction works from names and shapes. Wherever values are kept (outside
production, or in production with `captureBindings` enabled), these are kept
as bound:

- a secret in a column with an ordinary name that also looks ordinary, such as
  a six-character `code`;
- a number bound to an ordinary column of a sensitive table: only text is
  redacted there, so a numeric one-time code in `verifications.code` is kept;
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
| error | text | Error message if failed |
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

6. **Security**: Bindings are stored with credentials redacted, and in production only their types are kept unless `captureBindings` is enabled. Query text, error messages and ordinary bound values can still carry personal data, so keep access to the query dashboard secured.

## Debugging with Query Logs

Query logs can be invaluable for debugging:

- Identify queries executed during specific user actions
- Track down N+1 query problems
- Verify that ORM methods generate expected SQL
- Analyze query patterns during performance issues
- Monitor database load during specific operations
