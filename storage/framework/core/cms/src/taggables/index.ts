export {
  bulkDestroy,
  destroy,
} from './destroy'

export {
  fetchTagById,
  fetchTags,
} from './fetch'

/**
 * The tag analytics, which were written but never exported (stacksjs/stacks#2579).
 *
 * Unreachable through `@stacksjs/cms`, which is why two bugs sat in them: they
 * joined the pivot to `taggables` instead of `tags`, and none of them selected
 * the count they then read, so every count was 0 and "most used" was whichever
 * tag sorted first by name. Exported now that they work, since a tag manager is
 * the obvious consumer.
 */
export {
  countTaggedPosts,
  countTotalTags,
  fetchTagDistribution,
  fetchTagsWithPostCounts,
  findLeastUsedTag,
  findMostUsedTag,
  firstOrCreate,
} from './fetch'

export {
  findOrCreate,
  findOrCreateMany,
} from './store'

export {
  store,
} from './store'

export {
  update,
} from './update'
