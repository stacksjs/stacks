# Query Monitoring

The Query Monitoring system provides comprehensive tools to collect, analyze, and monitor database queries in your application. This helps you identify performance bottlenecks, optimize slow queries, and understand database usage patterns.

## Features

- **Real-time Query Logging**: Automatically logs all database queries with detailed information
- **Query Analysis**: Analyzes query patterns, identifies slow queries, and suggests optimizations
- **Dashboard Interface**: Visual dashboard for monitoring query performance metrics
- **Detailed Query Information**: Displays query details including duration, status, bindings, and more
- **Advanced Filtering**: Filter queries by type, status, connection, and more
- **Optimization Suggestions**: Automated recommendations for improving query performance

## Configuration

Query monitoring can be configured in your `config/database.ts` file:

```typescript
export default {
  // ... other database configs

  queryLogging: {
    // Enable or disable query logging
    enabled: true,

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
DB_QUERY_LOGGING_SLOW_THRESHOLD=100
DB_QUERY_LOGGING_RETENTION_DAYS=7
DB_QUERY_LOGGING_PRUNE_FREQUENCY=24
DB_QUERY_LOGGING_ANALYSIS_ENABLED=true
DB_QUERY_LOGGING_ANALYZE_ALL=false
DB_QUERY_LOGGING_EXPLAIN_PLAN=true
DB_QUERY_LOGGING_SUGGESTIONS=true
```

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

The detail view provides comprehensive information about a specific query:

- Full query text and normalized version
- Execution metrics and duration
- Bindings and parameters
- Stack trace and caller information
- Index usage information
- EXPLAIN plan data
- Optimization suggestions

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
| bindings | text | JSON array of query parameters |
| trace | text | Stack trace showing where query was called |
| model | text | Model that executed the query |
| method | text | Method that executed the query |
| file | text | File path where query originated |
| line | integer | Line number where query originated |
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

5. **Security**: Query logs may contain sensitive information in bindings. Ensure that access to the query dashboard is properly secured.

## Debugging with Query Logs

Query logs can be invaluable for debugging:

- Identify queries executed during specific user actions
- Track down N+1 query problems
- Verify that ORM methods generate expected SQL
- Analyze query patterns during performance issues
- Monitor database load during specific operations
