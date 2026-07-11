/**
 * Generate a new model file
 */
export declare function makeModel(name: string, options?: MakeModelOptions): Promise<void>;
export declare interface MakeModelOptions {
  table?: string
  dir?: string
  timestamps?: boolean
}
