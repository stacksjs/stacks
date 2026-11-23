import { campaigns } from './campaigns'
import { lists } from './lists'
import { confirm, subscribe, unsubscribe, unsubscribeAll } from './subscriptions'

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
  confirm: typeof confirm
  unsubscribe: typeof unsubscribe
  unsubscribeAll: typeof unsubscribeAll
} = {
  lists,
  campaigns,
  subscribe,
  confirm,
  unsubscribe,
  unsubscribeAll,
}

export { campaigns, confirm, lists, subscribe, unsubscribe, unsubscribeAll }
