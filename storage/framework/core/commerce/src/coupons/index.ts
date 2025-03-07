// Export types that might be needed elsewhere
export type {
  CouponJsonResponse,
  CouponResponse,
} from '../../../../orm/src/models/Coupon'

export type {
  CouponStats,
} from '../../types'

// Export functions from destroy.ts
export {
  deleteCoupon,
  deleteCoupons,
  deleteExpiredCoupons,
} from './destroy'

// Export functions from fetch.ts
export {
  fetchActive,
  fetchAll,
  fetchByCode,
  fetchById,
  type FetchCouponsOptions,
  fetchPaginated,
  fetchStats,
} from './fetch'

// Export functions from store.ts
export {
  store,
} from './store'
