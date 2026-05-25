export {
  bulkDestroy,
  destroy,
  destroyByMethod,
  destroyByZone,
} from './destroy'

// Functions from fetch.ts
export {
  fetchAll,
  fetchById,
  formatShippingRateOptions,
  // Safe-by-default address-based lookups (stacksjs/stacks#1879 Co-11).
  // Use these from request handlers where the address is caller-controlled.
  getRateByWeightAndAddress,
  getRateByWeightAndZone,
  getRatesByZone,
  getShippingRatesByMethod,
  resolveZoneForAddress,
  validateZoneMatchesAddress,
} from './fetch'
export type { ShippingAddress } from './fetch'

// Functions from store.ts
export {
  bulkStore,
  store,
} from './store'

// Functions from update.ts
export {
  bulkUpdate,
  update,
  updateByMethod,
  updateByZone,
} from './update'
