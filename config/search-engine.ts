import { defineSearchEngine } from '../.stacks/core/types/src/search-engine'

/**
 * **Search Engine Options**
 *
 * This configuration defines all of your search engine options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineSearchEngine({
  driver: 'meilisearch',
})
