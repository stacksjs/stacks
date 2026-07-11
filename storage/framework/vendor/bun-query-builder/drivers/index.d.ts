import { MySQLDriver } from './mysql';
import { PostgresDriver } from './postgres';
import { SingleStoreDriver } from './singlestore';
import { SQLiteDriver } from './sqlite';
import type { DialectDriver } from './postgres';
import type { SupportedDialect } from '../types';
export type { DialectDriver } from './postgres';
export type {
  DynamoDBAttributeDefinition,
  DynamoDBAttributeType,
  DynamoDBBatchGetItemParams,
  DynamoDBBatchWriteItemParams,
  DynamoDBComparisonOperator,
  DynamoDBCondition,
  DynamoDBConfig,
  DynamoDBDeleteItemParams,
  DynamoDBDriver,
  DynamoDBGetItemParams,
  DynamoDBGlobalSecondaryIndex,
  DynamoDBKeySchema,
  DynamoDBLocalSecondaryIndex,
  DynamoDBPutItemParams,
  DynamoDBQueryParams,
  DynamoDBScanParams,
  DynamoDBTableDefinition,
  DynamoDBTransactWriteParams,
  DynamoDBUpdateItemParams,
  SingleTableEntityMapping,
} from './dynamodb';
export declare function getDialectDriver(dialect: SupportedDialect): DialectDriver;
export { MySQLDriver } from './mysql';
export { PostgresDriver } from './postgres';
export { SingleStoreDriver } from './singlestore';
export { SQLiteDriver } from './sqlite';
// DynamoDB driver (NoSQL)
export {
  createDynamoDBDriver,
  DynamoDBDriverImpl,
} from './dynamodb';
