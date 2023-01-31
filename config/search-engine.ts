import type { SearchEngineOptions as Options } from '@stacksjs/types'

/**
 * **Search Engine Options**
 *
 * This configuration defines all of your search engine options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const config: Options = {
  driver: 'meilisearch',

  meilisearch: {
    host: '',
    apiKey: '',
  },
}
