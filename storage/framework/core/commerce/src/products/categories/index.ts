// Export all functions from destroy.ts
export {
  bulkRemove,
  deactivate,
  deactivateChildCategories,
  remove,
  removeChildCategories,
} from './destroy'

// Export all functions from fetch.ts
export {
  compareCategoryGrowth,
  fetchActive,
  fetchAll,
  fetchByDisplayOrder,
  fetchById,
  fetchByName,
  fetchCategoryTree,
  fetchChildCategories,
  fetchRootCategories,
  fetchStats,
} from './fetch'

// Export all functions from store.ts
export {
  findOrCreateByName,
  store,
} from './store'

// Export all functions from update.ts
export {
  update,
  updateActiveStatus,
  updateDisplayOrder,
  updateParent,
} from './update'
