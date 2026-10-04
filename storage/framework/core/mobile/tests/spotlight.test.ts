import type { SpotlightBridge, SpotlightEntry, SpotlightKind } from '../src/spotlight'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  createSpotlightIndex,
  MAX_SPOTLIGHT_SLOTS_PER_KIND,
  onSpotlightTap,
  placeSpotlightItem,
  readSpotlightEntries,
  readSpotlightKinds,
  removeSpotlightItem,
  spotlightAction,
  spotlightActions,
  spotlightActivityTypes,
  spotlightRoute,
  spotlightSlot,
  spotlightTitle,
} from '../src/spotlight'

const CONFIG = {
  trail: { slots: 4, route: '/trail/:id', noun: 'Trail' },
  club: { slots: 2, route: '/club/:id', noun: 'Club' },
}

const KINDS: SpotlightKind[] = readSpotlightKinds(CONFIG).kinds

function entry(kind: string, slot: number, itemId: number, donatedAt = 1000, title = `x${itemId}`): SpotlightEntry {
  return { kind, slot, itemId, title, donatedAt }
}

/** Fill one kind's slots, oldest first, so the next placement has to evict. */
function fullKind(name: string): SpotlightEntry[] {
  const kind = KINDS.find(held => held.name === name)!
  return Array.from({ length: kind.slots }, (_, slot) => entry(name, slot, slot + 1, 1000 + slot))
}

describe('reading the configured kinds', () => {
  it('takes a sound kind as written, and defaults its noun', () => {
    const { kinds, problems } = readSpotlightKinds({ club: { slots: 8, route: '/club/:id' } })

    expect(problems).toEqual([])
    expect(kinds).toEqual([{ name: 'club', slots: 8, route: '/club/:id', noun: 'Item' }])
  })

  it('names what it dropped rather than indexing nothing in silence', () => {
    const { kinds, problems } = readSpotlightKinds({
      'Trail': { slots: 4, route: '/trail/:id' },
      'a-slot-b': { slots: 4, route: '/x/:id' },
      'club': { slots: 0, route: '/club/:id' },
      'event': { slots: MAX_SPOTLIGHT_SLOTS_PER_KIND + 1, route: '/event/:id' },
      'route': { slots: 4, route: 'routes/:id' },
      'badge': { slots: 4, route: '/badges' },
      'relic': 'yes',
      'kept': { slots: 2, route: '/kept/:id' },
    })

    expect(kinds.map(kind => kind.name)).toEqual(['kept'])
    expect(problems).toHaveLength(7)
    expect(problems.join('\n')).toContain('"Trail" is not a usable name')
    expect(problems.join('\n')).toContain('"club" needs slots between 1 and 64')
    expect(problems.join('\n')).toContain('"route" needs a route starting with "/" and carrying ":id"')
    expect(problems.join('\n')).toContain('"relic" is not an object')
  })

  it('reads nothing out of nothing', () => {
    expect(readSpotlightKinds(null).kinds).toEqual([])
    expect(readSpotlightKinds('trail').kinds).toEqual([])
    expect(readSpotlightKinds([{ slots: 1, route: '/x/:id' }]).kinds).toEqual([])
  })
})

describe('a slot and the action that names it', () => {
  it('names one action per slot of every kind, in configured order', () => {
    expect(spotlightActions(KINDS)).toEqual([
      'trail-slot-0',
      'trail-slot-1',
      'trail-slot-2',
      'trail-slot-3',
      'club-slot-0',
      'club-slot-1',
    ])
  })

  it('round-trips every action it offers', () => {
    for (const action of spotlightActions(KINDS)) {
      const parsed = spotlightSlot(KINDS, action)
      expect(parsed).not.toBeNull()
      expect(spotlightAction(KINDS, parsed!.kind, parsed!.slot)).toBe(action)
    }
  })

  it('reads back only the exact form it writes', () => {
    expect(spotlightSlot(KINDS, 'trail-slot-07')).toBeNull()
    expect(spotlightSlot(KINDS, 'trail-slot-')).toBeNull()
    expect(spotlightSlot(KINDS, 'trail-slot-1x')).toBeNull()
    expect(spotlightSlot(KINDS, 'trail-slot-4')).toBeNull()
    expect(spotlightSlot(KINDS, 'mixtape-slot-0')).toBeNull()
    expect(spotlightSlot(KINDS, 'favorites')).toBeNull()
    expect(spotlightAction(KINDS, 'trail', 1.5)).toBeNull()
    expect(spotlightAction(KINDS, 'mixtape', 0)).toBeNull()
  })
})

describe('the activity types a build declares', () => {
  it('prefixes every slot and every action the app donates itself', () => {
    const types = spotlightActivityTypes({ kinds: CONFIG, activityTypes: ['favorites', ' view-stats '] }, 'org.example.app')

    expect(types[0]).toBe('org.example.app.favorites')
    expect(types[1]).toBe('org.example.app.view-stats')
    expect(types).toContain('org.example.app.trail-slot-3')
    expect(types).toContain('org.example.app.club-slot-1')
    expect(types).toHaveLength(8)
  })

  it('declares nothing for an index that is turned off, or absent', () => {
    expect(spotlightActivityTypes({ kinds: CONFIG, enabled: false }, 'org.example.app')).toEqual([])
    expect(spotlightActivityTypes(undefined, 'org.example.app')).toEqual([])
    expect(spotlightActivityTypes({}, 'org.example.app')).toEqual([])
  })

  it('declares a type once, however many times it is named', () => {
    const types = spotlightActivityTypes({ kinds: CONFIG, activityTypes: ['favorites', 'favorites', 'trail-slot-0'] }, 'org.example.app')
    expect(new Set(types).size).toBe(types.length)
  })
})

describe('what the device shows', () => {
  it('is the record’s name, tidied', () => {
    expect(spotlightTitle(KINDS, 'trail', { id: 4, name: '  Eagle Peak   Loop ' })).toBe('Eagle Peak Loop')
  })

  it('falls back to the kind’s own noun rather than an empty row', () => {
    expect(spotlightTitle(KINDS, 'trail', { id: 4, name: '  ' })).toBe('Trail #4')
    expect(spotlightTitle(KINDS, 'club', { id: 9, name: null })).toBe('Club #9')
    expect(spotlightTitle(KINDS, 'mixtape', { id: 2 })).toBe('Item #2')
  })

  it('does not hand the device a title longer than it shows', () => {
    const title = spotlightTitle(KINDS, 'trail', { id: 4, name: 'a'.repeat(400) })
    expect(title.length).toBeLessThanOrEqual(120)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('fitting a record into its kind', () => {
  it('takes the lowest free slot of that kind', () => {
    const first = placeSpotlightItem(KINDS, [], 'club', { id: 11, name: 'Trail Crew' }, 1)!
    expect(first.entry).toEqual({ kind: 'club', slot: 0, itemId: 11, title: 'Trail Crew', donatedAt: 1 })

    const second = placeSpotlightItem(KINDS, first.entries, 'club', { id: 12, name: 'Hill Repeats' }, 2)!
    expect(second.entry.slot).toBe(1)
  })

  it('keeps each kind’s slots to itself', () => {
    const withTrail = placeSpotlightItem(KINDS, [], 'trail', { id: 7, name: 'Ridge Loop' }, 1)!
    const withClub = placeSpotlightItem(KINDS, withTrail.entries, 'club', { id: 7, name: 'Trail Crew' }, 2)!

    // Same slot number, same record id, different kinds: both held.
    expect(withClub.entries).toHaveLength(2)
    expect(spotlightRoute(KINDS, withClub.entries, 'trail-slot-0')).toBe('/trail/7')
    expect(spotlightRoute(KINDS, withClub.entries, 'club-slot-0')).toBe('/club/7')
  })

  it('evicts only within the kind that filled up', () => {
    const entries = [...fullKind('club'), entry('trail', 0, 500, 1)]
    const placed = placeSpotlightItem(KINDS, entries, 'club', { id: 999, name: 'New Crew' }, 5000)!

    expect(placed.evicted).toMatchObject({ kind: 'club', itemId: 1 })
    // The trail entry is older than everything here, and untouched.
    expect(spotlightRoute(KINDS, placed.entries, 'trail-slot-0')).toBe('/trail/500')
    expect(placed.entries.filter(held => held.kind === 'club')).toHaveLength(2)
  })

  it('keeps a record in the slot it has, and re-donates a rename', () => {
    const first = placeSpotlightItem(KINDS, [], 'trail', { id: 3, name: 'Ridge Loop' }, 1)!
    const again = placeSpotlightItem(KINDS, first.entries, 'trail', { id: 3, name: 'Ridge Loop' }, 9)!
    expect(again.changed).toBe(false)
    expect(again.entry.donatedAt).toBe(9)

    const renamed = placeSpotlightItem(KINDS, again.entries, 'trail', { id: 3, name: 'Ridge Loop (closed)' }, 10)!
    expect(renamed.changed).toBe(true)
    expect(renamed.entries).toHaveLength(1)
  })

  it('refuses a kind it does not carry, or a record with no usable id', () => {
    expect(placeSpotlightItem(KINDS, [], 'mixtape', { id: 1, name: 'Nope' })).toBeNull()
    expect(placeSpotlightItem(KINDS, [], 'trail', { id: 0, name: 'Nowhere' })).toBeNull()
    expect(placeSpotlightItem(KINDS, [], 'trail', { id: -2, name: 'Nowhere' })).toBeNull()
    expect(placeSpotlightItem(KINDS, [], 'trail', { id: 1.5, name: 'Nowhere' })).toBeNull()
  })

  it('leaves the list it was given alone', () => {
    const entries = [entry('trail', 0, 1)]
    placeSpotlightItem(KINDS, entries, 'trail', { id: 2, name: 'Two' }, 5)
    removeSpotlightItem(entries, 'trail', 1)
    expect(entries).toEqual([entry('trail', 0, 1)])
  })
})

describe('taking a record out', () => {
  it('reports the slot to un-donate, and leaves other kinds alone', () => {
    const { entries, removed } = removeSpotlightItem([entry('club', 0, 11), entry('trail', 0, 11)], 'club', 11)

    expect(removed).toMatchObject({ kind: 'club', slot: 0 })
    expect(entries).toEqual([entry('trail', 0, 11)])
  })

  it('is a no-op for a record that was never indexed', () => {
    const { removed } = removeSpotlightItem([entry('club', 0, 11)], 'club', 404)
    expect(removed).toBeNull()
  })
})

describe('reading back a stored assignment', () => {
  it('keeps sound entries, grouped by kind in configured order', () => {
    const stored = readSpotlightEntries(KINDS, [entry('club', 1, 5), entry('trail', 3, 9), entry('club', 0, 2)])
    expect(stored.map(held => `${held.kind}-${held.slot}`)).toEqual(['trail-3', 'club-0', 'club-1'])
  })

  it('drops a kind or a slot this build no longer declares', () => {
    expect(readSpotlightEntries(KINDS, [entry('mixtape', 0, 5)])).toEqual([])
    expect(readSpotlightEntries(KINDS, [entry('club', 9, 5)])).toEqual([])
  })

  it('drops anything that is not an entry', () => {
    expect(readSpotlightEntries(KINDS, '[]')).toEqual([])
    expect(readSpotlightEntries(KINDS, null)).toEqual([])
    expect(readSpotlightEntries(KINDS, [null, 7, { kind: 'trail' }, { slot: 1 }, { kind: 'trail', slot: 1, itemId: 0 }])).toEqual([])
  })

  it('keeps one entry per slot and one slot per record, per kind', () => {
    const stored = readSpotlightEntries(KINDS, [
      entry('club', 1, 11),
      entry('club', 1, 12),
      entry('club', 0, 11),
      entry('trail', 1, 11),
    ])

    expect(stored.map(held => `${held.kind}#${held.itemId}`)).toEqual(['trail#11', 'club#11'])
  })

  it('repairs a missing title and a nonsense timestamp rather than dropping the row', () => {
    const stored = readSpotlightEntries(KINDS, [{ kind: 'club', slot: 1, itemId: 9, title: '  ', donatedAt: 'soon' }])
    expect(stored[0]).toEqual({ kind: 'club', slot: 1, itemId: 9, title: 'Club #9', donatedAt: 0 })
  })
})

/* ── the index itself ─────────────────────────────────────────────────────── */

interface Donation { phrase: string, action: string }

let donated: Donation[]
let removed: string[]
let stored: Map<string, string>

/** Craft's injected Siri bridge, as a WebView sees it. */
function bridge(options: { register?: boolean | 'hang' | 'refuse', remove?: boolean } = {}): () => SpotlightBridge {
  const register = options.register ?? true
  return () => ({
    register: register === false
      ? undefined
      : async (phrase: string, action: string) => {
          donated.push({ phrase, action })
          if (register === 'hang')
            return new Promise(() => {})
          if (register === 'refuse')
            throw new Error('Siri is off')
          return { registered: true }
        },
    remove: (options.remove ?? true)
      ? async (action: string) => { removed.push(action); return { removed: true } }
      : undefined,
  })
}

function index(options: Partial<Parameters<typeof createSpotlightIndex>[0]> = {}) {
  return createSpotlightIndex({ kinds: CONFIG, bridge: bridge(), storageKey: 'test_spotlight', ...options })
}

beforeEach(() => {
  donated = []
  removed = []
  stored = new Map()
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  }
})

afterEach(() => {
  delete (globalThis as any).localStorage
})

describe('an index off a native host', () => {
  it('does nothing, and says so', async () => {
    const spotlight = createSpotlightIndex({ kinds: CONFIG, bridge: () => undefined })

    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(false)
    expect(await spotlight.remove('trail', 7)).toBe(false)
    expect(await spotlight.sync('trail', [{ id: 7, name: 'Ridge Loop' }])).toBe(0)
    expect(spotlight.routeFor('trail-slot-0')).toBeNull()
    expect(stored.size).toBe(0)
  })

  it('does nothing when the whole index is turned off', async () => {
    const spotlight = index({ enabled: false })

    expect(spotlight.kinds).toEqual([])
    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(false)
    expect(donated).toEqual([])
  })
})

describe('indexing a record', () => {
  it('donates it under a slot, and remembers which', async () => {
    const spotlight = index()
    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(true)

    expect(donated).toEqual([{ phrase: 'Ridge Loop', action: 'trail-slot-0' }])
    expect(spotlight.routeFor('trail-slot-0')).toBe('/trail/7')
    expect(JSON.parse(stored.get('test_spotlight')!)[0]).toMatchObject({ kind: 'trail', slot: 0, itemId: 7 })
  })

  it('does not donate the same record twice under the same name', async () => {
    const spotlight = index()
    await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })
    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(true)

    expect(donated).toHaveLength(1)
  })

  it('stores nothing the host refused, so a tap cannot resolve to it', async () => {
    const spotlight = index({ bridge: bridge({ register: 'refuse' }) })

    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(false)
    expect(spotlight.routeFor('trail-slot-0')).toBeNull()
    expect(stored.size).toBe(0)
  })

  it('gives up on a bridge call nothing answers', async () => {
    const spotlight = index({ bridge: bridge({ register: 'hang' }), timeoutMs: 50 })

    expect(await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })).toBe(false)
    expect(spotlight.routeFor('trail-slot-0')).toBeNull()
  })

  it('keeps one record per slot when two donate at once', async () => {
    const spotlight = index()
    await Promise.all([
      spotlight.index('trail', { id: 7, name: 'Ridge Loop' }),
      spotlight.index('trail', { id: 8, name: 'Creek Trail' }),
    ])

    expect(donated.map(one => one.action).sort()).toEqual(['trail-slot-0', 'trail-slot-1'])
    expect(spotlight.routeFor('trail-slot-0')).toBe('/trail/7')
    expect(spotlight.routeFor('trail-slot-1')).toBe('/trail/8')
  })

  it('works for the session even where nothing can be stored', async () => {
    delete (globalThis as any).localStorage
    const spotlight = index()

    expect(await spotlight.index('club', { id: 4, name: 'Trail Crew' })).toBe(true)
    expect(spotlight.routeFor('club-slot-0')).toBe('/club/4')
  })
})

describe('taking a record out of the index', () => {
  it('deletes the entry and frees the slot', async () => {
    const spotlight = index()
    await spotlight.index('club', { id: 7, name: 'Trail Crew' })
    expect(await spotlight.remove('club', 7)).toBe(true)

    expect(removed).toEqual(['club-slot-0'])
    expect(spotlight.routeFor('club-slot-0')).toBeNull()

    await spotlight.index('club', { id: 8, name: 'Hill Repeats' })
    expect(spotlight.routeFor('club-slot-0')).toBe('/club/8')
  })

  it('stops claiming a record even when the deletion was refused', async () => {
    const spotlight = index({ bridge: () => ({ ...bridge()(), remove: async () => { throw new Error('nope') } }) })
    await spotlight.index('club', { id: 7, name: 'Trail Crew' })

    expect(await spotlight.remove('club', 7)).toBe(false)
    expect(spotlight.routeFor('club-slot-0')).toBeNull()
  })
})

describe('syncing a list', () => {
  it('keeps the head of a list longer than the kind’s budget', async () => {
    const spotlight = index()
    const trails = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Trail ${i + 1}` }))

    expect(await spotlight.sync('trail', trails)).toBe(4)
    expect(spotlight.entries().map(held => held.itemId).sort()).toEqual([1, 2, 3, 4])
  })

  it('syncs one kind without disturbing another', async () => {
    const spotlight = index()
    await spotlight.index('trail', { id: 7, name: 'Ridge Loop' })
    donated = []

    expect(await spotlight.sync('club', [{ id: 1, name: 'A' }, { id: 2, name: 'B' }])).toBe(2)
    expect(donated.every(one => one.action.startsWith('club-slot-'))).toBe(true)
    expect(spotlight.routeFor('trail-slot-0')).toBe('/trail/7')
  })

  it('does nothing for a kind nothing configured', async () => {
    const spotlight = index()
    expect(await spotlight.sync('mixtape', [{ id: 1, name: 'Nope' }])).toBe(0)
    expect(donated).toEqual([])
  })
})

describe('signing out', () => {
  it('takes every kind back down', async () => {
    const spotlight = index()
    await spotlight.index('trail', { id: 7, name: 'A' })
    await spotlight.index('club', { id: 8, name: 'B' })

    expect(await spotlight.clear()).toBe(2)
    expect(removed.sort()).toEqual(['club-slot-0', 'trail-slot-0'])
    expect(spotlight.entries()).toEqual([])
    expect(JSON.parse(stored.get('test_spotlight')!)).toEqual([])
  })

  it('forgets the bookkeeping even where it cannot un-donate', async () => {
    const spotlight = index({ bridge: () => undefined })
    expect(await spotlight.clear()).toBe(0)
    expect(spotlight.entries()).toEqual([])
  })
})

describe('what an earlier session left', () => {
  it('answers a tap from storage, without donating anything', () => {
    stored.set('test_spotlight', JSON.stringify([entry('trail', 2, 42, 5, 'Ridge Loop')]))
    const spotlight = index()

    expect(spotlight.routeFor('trail-slot-2')).toBe('/trail/42')
    expect(donated).toEqual([])
  })

  it('reads a key an earlier build stored under, then moves it', async () => {
    stored.set('old_key', JSON.stringify([entry('trail', 1, 42, 5, 'Ridge Loop')]))
    const spotlight = index({ legacyStorageKeys: ['old_key'] })

    expect(spotlight.routeFor('trail-slot-1')).toBe('/trail/42')

    await spotlight.index('club', { id: 3, name: 'Trail Crew' })
    expect(stored.has('old_key')).toBe(false)
    expect(JSON.parse(stored.get('test_spotlight')!).map((held: SpotlightEntry) => held.itemId)).toEqual([42, 3])
  })

  it('answers nothing for bookkeeping it cannot read', () => {
    stored.set('test_spotlight', 'not json')
    expect(index().routeFor('trail-slot-0')).toBeNull()
  })
})

describe('following a tap', () => {
  it('routes an entry tapped in Spotlight, and stops when taken down', async () => {
    const spotlight = index()
    await spotlight.index('club', { id: 4, name: 'Trail Crew' })

    const routes: string[] = []
    const stop = onSpotlightTap(spotlight, route => routes.push(route))

    globalThis.dispatchEvent(new CustomEvent('craftSiriShortcut', { detail: { action: 'club-slot-0', data: {} } }))
    globalThis.dispatchEvent(new CustomEvent('craftShortcut', { detail: { type: 'club-slot-0' } }))
    // Not this index's to answer: an app's own shortcut action, and an empty slot.
    globalThis.dispatchEvent(new CustomEvent('craftSiriShortcut', { detail: { action: 'favorites' } }))
    globalThis.dispatchEvent(new CustomEvent('craftSiriShortcut', { detail: { action: 'trail-slot-3' } }))
    stop()
    globalThis.dispatchEvent(new CustomEvent('craftSiriShortcut', { detail: { action: 'club-slot-0' } }))

    expect(routes).toEqual(['/club/4', '/club/4'])
  })

  it('ignores a detail with nothing in it', async () => {
    const spotlight = index()
    await spotlight.index('club', { id: 4, name: 'Trail Crew' })
    const routes: string[] = []
    const stop = onSpotlightTap(spotlight, route => routes.push(route))

    for (const detail of [null, 42, {}, { action: 7 }])
      globalThis.dispatchEvent(new CustomEvent('craftSiriShortcut', { detail }))
    stop()

    expect(routes).toEqual([])
  })
})
