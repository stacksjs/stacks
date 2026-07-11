import type { ModelRecord } from './schema';
export declare function loadModels(options: LoadModelsOptions): Promise<ModelRecord>;
export declare interface LoadModelsOptions {
  cwd?: string
  modelsDir: string
}
