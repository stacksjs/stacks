/**
 * Run EXPLAIN on all SQL files in a directory
 */
export declare function queryExplainAll(path: string, options?: ExplainAllOptions): Promise<ExplainResult[]>;
export declare interface ExplainAllOptions {
  verbose?: boolean
  json?: boolean
  format?: 'text' | 'json'
}
export declare interface ExplainResult {
  file: string
  query: string
  plan: any[]
  error?: string
}
export { queryExplainAll as explainAllQueries };
