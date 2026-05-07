import { campaigns } from './campaigns'
import { lists } from './lists'
import { subscribe, unsubscribe, unsubscribeAll } from './subscriptions'

/**
 * Top-level Newsletter facade.
 *
 * Keeps the import surface tiny — most call sites only need
 * `newsletter.subscribe()` or `newsletter.campaigns.sendNow()`.
 */

export const newsletter: {
  lists: typeof lists
  campaigns: typeof campaigns
  subscribe: typeof subscribe
  unsubscribe: typeof unsubscribe
  unsubscribeAll: typeof unsubscribeAll
} = {
  lists,
  campaigns,
  subscribe,
  unsubscribe,
  unsubscribeAll,
}

export { campaigns, lists, subscribe, unsubscribe, unsubscribeAll }
