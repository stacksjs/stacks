import { createBrowserModel, type BrowserModelDefinition } from './browser';
// Re-export the browser model types for convenience
export type { BrowserModelDefinition as ModelDefinition };
/**
 * Look up a registered model by name.
 *
 * @param name - The model name (e.g., 'User', 'Trail')
 * @returns The model instance, or undefined if not registered
 *
 * @example
 * ```ts
 * const User = getModel('User')
 * if (User) {
 *   const users = await User.all()
 * }
 * ```
 */
export declare function getModel(name: string): ReturnType<typeof createBrowserModel> | undefined;
/**
 * Get all registered models as an array.
 *
 * @returns Array of all registered model instances
 *
 * @example
 * ```ts
 * const models = getAllModels()
 * for (const model of models) {
 *   console.log(model.getTable())
 * }
 * ```
 */
export declare function getAllModels(): ReturnType<typeof createBrowserModel>[];
/**
 * Get all registered models as a name-to-model map.
 *
 * @returns Record mapping model names to model instances
 *
 * @example
 * ```ts
 * const models = getModelRegistry()
 * // { User: UserModel, Trail: TrailModel, ... }
 * ```
 */
export declare function getModelRegistry(): Record<string, ReturnType<typeof createBrowserModel>>;
/**
 * Check if a model with the given name is registered.
 *
 * @param name - The model name to check
 * @returns true if the model is registered
 */
export declare function hasModel(name: string): boolean;
/**
 * Clear all registered models. Primarily useful for testing.
 */
export declare function clearModelRegistry(): void;
/**
 * Register an already-created model instance in the global registry.
 *
 * Framework integrations can build richer model facades themselves and
 * still expose those models to query-builder features that discover
 * models through the shared registry.
 *
 * @param name - The model name (e.g., 'User', 'Trail')
 * @param model - The runtime model instance to register
 * @returns The same model instance for convenient passthrough usage
 */
export declare function registerModel<TModel>(name: string, model: TModel): TModel;
/**
 * Define an isomorphic model that works in both server and browser.
 *
 * In the browser, this creates a model that uses fetch() to call your API.
 * On the server, this uses the dynamic ORM (createModel) to provide fully
 * typed query methods that work directly with the database — no code
 * generation needed.
 *
 * The model is automatically registered in the global model registry,
 * making it available via `getModel(name)` and `getAllModels()`.
 *
 * @param definition - The model definition
 * @returns An isomorphic model with query methods
 */
export declare function defineModel<const TDef extends BrowserModelDefinition>(definition: TDef): void;
/**
 * Register models on the global window.StacksBrowser object.
 * Call this in your app's entry point to make models available for STX auto-imports.
 *
 * @param models - Object mapping model names to model instances
 *
 * @example
 * ```ts
 * import Trail from './Models/Trail'
 * import Activity from './Models/Activity'
 *
 * registerBrowserModels({ Trail, Activity })
 * ```
 */
export declare function registerBrowserModels(models: Record<string, unknown>): void;
