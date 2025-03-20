// Export all functions from fetch.ts
export {
  fetchAll,
  fetchById,
  fetchByName,
  fetchActive,
  fetchRootCategories,
  fetchChildCategories,
  fetchByDisplayOrder,
  fetchStats,
  compareCategoryGrowth,
  fetchCategoryTree,
} from './fetch'

// Export all functions from store.ts
export {
  store,
} from './store'

// Export all functions from destroy.ts
export {
  remove,
  bulkRemove,
  removeChildCategories,
  deactivate,
  deactivateChildCategories,
} from './destroy'

// Export all functions from update.ts
export {
  update,
  updateDisplayOrder,
  updateActiveStatus,
  updateParent,
} from './update'
