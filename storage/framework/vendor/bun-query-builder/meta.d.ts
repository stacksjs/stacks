import type { BelongsToManyConfig, ModelRecord } from './schema';
export declare function buildSchemaMeta(models: ModelRecord): SchemaMeta;
export declare interface SchemaMeta {
  modelToTable: Record<string, string>
  tableToModel: Record<string, string>
  primaryKeys: Record<string, string>
  relations?: Record<string, {
    hasOne?: Record<string, string>
    hasMany?: Record<string, string>
    belongsTo?: Record<string, string>
    belongsToMany?: Record<string, string | BelongsToManyConfig>
    hasOneThrough?: Record<string, { through: string, target: string }>
    hasManyThrough?: Record<string, { through: string, target: string }>
    morphOne?: Record<string, string>
    morphMany?: Record<string, string>
    morphTo?: Record<string, unknown>
    morphToMany?: Record<string, string>
    morphedByMany?: Record<string, string>
  }>
  scopes?: Record<string, Record<string, (qb: any, value?: any) => any>>
  models?: ModelRecord
}
