import { lists } from '@stacksjs/newsletter/lists'
import { subscribe } from '@stacksjs/newsletter/subscriptions'

/** Product membership belongs to the native pivot, so an existing Stacks subscriber can join too. */
export async function subscribeToLaunchpad(email: string, ports: { lists: Pick<typeof lists, 'find' | 'create'>, subscribe: typeof subscribe } = { lists, subscribe }) {
  const address = email.trim().toLowerCase()
  if (address.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('A valid email is required')
  const slug = 'launchpad-updates'
  let list = await ports.lists.find(slug)
  if (!list) {
    try { list = await ports.lists.create({ slug, name: 'Launchpad updates', description: 'Launchpad releases and improvements.', isPublic: true }) }
    catch (error) {
      // Another request may have created the same native list while this one waited.
      list = await ports.lists.find(slug)
      if (!list) throw error
    }
  }
  return ports.subscribe(address, { list: list.id, source: 'launchpad' })
}
