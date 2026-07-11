// Resolve ambiguous re-exports by explicitly choosing which module's version to use
export type { WhereOperator } from './browser';
export type { ModelQueryBuilder } from './dynamodb/index';
export type { ColumnName, QueryBuilder } from './client';
export type { ModelRecord } from './schema';
export type { ModelDefinition as OrmModelDefinition, ModelStatic as OrmModelStatic } from './orm';
// Re-export the type-inference version of InferRelationNames (supports wrapped models)
// to resolve the ambiguity with orm.ts's InferRelationNames (which takes raw definitions)
export type { InferRelationNames } from './type-inference';
// Explicit re-exports for type inference utilities
export type {
  InferAttributes,
  InferFillableAttributes,
  InferPrimaryKey,
  InferTableName,
  InferNumericColumns,
  InferColumnNames,
  InferHiddenKeys,
  InferGuardedKeys,
  InferPivotColumns,
  ModelRow,
  ModelRowLoose,
  ModelCreateData,
  ModelCreateDataLoose,
  RelationCardinality,
} from './type-inference';
export * from './actions/index';
export * from './browser';
export * from './client';
export * from './model';
export * from './config';
export * from './drivers/index';
export * from './dynamodb-client';
export * from './dynamodb-single-table';
export * from './dynamodb-tooling-adapter';
export * from './dynamodb/index';
export * from './factory';
export * from './loader';
export * from './meta';
export * from './migrations';
export * from './pivot';
export * from './orm';
export * from './schema';
export * from './seeder';
export * from './sqlite-pragmas';
export * from './type-inference';
export * from './types';
export { type ModelDefinition, defineModel } from './model';
// Explicit re-exports for model registry functions
export { getModel, getAllModels, getModelRegistry, hasModel, clearModelRegistry, registerModel } from './model';
