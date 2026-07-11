/**
 * Show detailed information about a specific model
 */
export declare function modelShow(modelName: string, options?: ModelShowOptions): Promise<ModelDetails | void>;
export declare interface ModelShowOptions {
  dir?: string
  verbose?: boolean
  json?: boolean
}
export declare interface ModelDetails {
  name: string
  table: string
  primaryKey: string
  attributes: Record<string, any>
  relations?: Record<string, any>
  scopes?: Record<string, any>
  hooks?: string[]
  indexes?: any[]
  timestamps?: boolean
  softDeletes?: boolean
}
export { modelShow as showModel };
