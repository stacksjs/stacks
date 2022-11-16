export interface SearchEngineOptions {
  /**
   * ### Search Engine Driver
   *
   * The search engine to utilize.
   *
   * @default string 'meilisearch'
   * @see https://stacksjs.dev/docs/search-engine
   */
  driver: 'meilisearch' | 'algolia'
}
