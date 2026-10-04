/**
 * The app's own content in a device's search index.
 *
 * An app somebody opens is not the same thing as a record somebody finds: a
 * trail, a club, a document that turns up when its name is typed into the home
 * screen is reached without the app being thought of first. iOS builds that
 * index out of donated `NSUserActivity` objects, which Craft's `siri` bridge
 * is: a title and an action, and what the app gets back on a tap is that
 * action and nothing else. Two consequences shape this whole module:
 *
 *   1. iOS only hands a tapped activity back to an app that declares its type
 *      in `NSUserActivityTypes`, and that list is fixed at build time. A type
 *      per record id would be unbounded, so it cannot be declared — and an
 *      entry iOS will not hand back is worse than no entry, because it opens
 *      the app on whatever screen it was last on.
 *   2. The activity carries no payload of the app's. Whatever a tap needs to
 *      know has to be derivable from the action alone.
 *
 * So each kind of content gets a fixed number of *slots* — `trail-slot-0`,
 * `club-slot-0`, every one of them declared in the generated `Info.plist` by
 * the iOS build — and each slot holds whichever record is currently in it.
 * This module is that assignment: the pure part decides it, and
 * `createSpotlightIndex` stores it and makes the bridge calls. Because a
 * slot's identifier is also the activity's `persistentIdentifier`, re-donating
 * a slot replaces the entry iOS already has rather than adding another.
 *
 * What is indexed, how many of each, and where a tap opens is configuration
 * (`config/mobile.ts`, `spotlight`), so an app adds a kind with an entry and a
 * call rather than with another copy of the bookkeeping below.
 *
 * Nothing here needs a native host: off one, every call is a no-op that says
 * so, which is what lets a page donate unconditionally.
 */

/** One kind of content, as the index holds it. */
export interface SpotlightKind {
  /** The name slots are donated under: `trail` gives `trail-slot-0`. */
  name: string
  /** How many records of this kind the device holds at once. */
  slots: number
  /** Where a tapped entry opens, with `:id` standing for the record's id. */
  route: string
  /** Names an entry whose record arrived without a name of its own. */
  noun: string
}

/** A kind as an app configures it, before it is checked. */
export interface SpotlightKindInput {
  slots: number
  route: string
  noun?: string
}

/** What this module needs of a record. A list row and a detail row both fit. */
export interface SpotlightItem {
  id: number
  name?: string | null
}

/** One record's place in the index. */
export interface SpotlightEntry {
  /** Which kind's slots this belongs to. */
  kind: string
  /** Which slot holds it, and so which action a tap arrives under. */
  slot: number
  itemId: number
  /** What the device shows, kept so a re-donation can be skipped when equal. */
  title: string
  /** When it was last donated, in ms. The oldest is what a full kind evicts. */
  donatedAt: number
}

/**
 * The most slots one kind may claim.
 *
 * Every slot is a line in the generated `Info.plist` and a possible donation
 * at launch, so a mistyped budget is worth catching before a build log.
 */
export const MAX_SPOTLIGHT_SLOTS_PER_KIND = 64

/** A device shows one line; past this it is truncated anyway. */
const MAX_TITLE_LENGTH = 120

const SLOT_SEPARATOR = '-slot-'
const KIND_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const SLOT_DIGITS = /^(?:0|[1-9]\d*)$/

/** Configured kinds, and what was wrong with the ones left out. */
export interface SpotlightKindsResult {
  kinds: SpotlightKind[]
  /** One sentence per entry dropped, for a log nobody has to decode. */
  problems: string[]
}

/**
 * Read configured kinds, leaving out any that could not work.
 *
 * Dropping rather than throwing: a typo in one kind's budget should cost that
 * kind its index, not the app's startup. The problems come back so a caller
 * can say what it ignored — silence here looks exactly like a kind nothing has
 * donated to yet.
 */
export function readSpotlightKinds(raw: unknown): SpotlightKindsResult {
  const kinds: SpotlightKind[] = []
  const problems: string[] = []
  const configured = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}

  for (const [name, value] of Object.entries(configured)) {
    const kind = value && typeof value === 'object' ? value as Record<string, unknown> : null
    if (!kind) {
      problems.push(`spotlight kind "${name}" is not an object`)
      continue
    }

    const { slots, route } = kind
    const noun = typeof kind.noun === 'string' && kind.noun.trim() ? kind.noun.trim() : 'Item'

    if (!KIND_NAME.test(name) || name.includes(SLOT_SEPARATOR)) {
      problems.push(`spotlight kind "${name}" is not a usable name: lowercase letters, digits and single dashes, and never "${SLOT_SEPARATOR}"`)
      continue
    }
    if (typeof slots !== 'number' || !Number.isInteger(slots) || slots <= 0 || slots > MAX_SPOTLIGHT_SLOTS_PER_KIND) {
      problems.push(`spotlight kind "${name}" needs slots between 1 and ${MAX_SPOTLIGHT_SLOTS_PER_KIND}, not ${String(slots)}`)
      continue
    }
    if (typeof route !== 'string' || !route.startsWith('/') || !route.includes(':id')) {
      problems.push(`spotlight kind "${name}" needs a route starting with "/" and carrying ":id", not ${String(route)}`)
      continue
    }

    kinds.push({ name, slots, route, noun })
  }

  return { kinds, problems }
}

/** One kind by name, or null for anything this build does not index. */
export function spotlightKind(kinds: readonly SpotlightKind[], name: string): SpotlightKind | null {
  return kinds.find(kind => kind.name === name) ?? null
}

/** The action a kind's slot is donated under, or null for no such slot. */
export function spotlightAction(kinds: readonly SpotlightKind[], kind: string, slot: number): string | null {
  const configured = spotlightKind(kinds, kind)
  if (!configured || !Number.isInteger(slot) || slot < 0 || slot >= configured.slots)
    return null

  return `${kind}${SLOT_SEPARATOR}${slot}`
}

/**
 * The kind and slot an action names, or null for anything else.
 *
 * Strict about the form — no padding, no trailing text, and the kind has to be
 * one these kinds carry — because this is what decides whether something the
 * system handed back is one of the app's own.
 */
export function spotlightSlot(kinds: readonly SpotlightKind[], action: string): { kind: string, slot: number } | null {
  if (typeof action !== 'string')
    return null

  const at = action.lastIndexOf(SLOT_SEPARATOR)
  if (at <= 0)
    return null

  const kind = action.slice(0, at)
  const digits = action.slice(at + SLOT_SEPARATOR.length)
  if (!SLOT_DIGITS.test(digits))
    return null

  const slot = Number(digits)
  return spotlightAction(kinds, kind, slot) === action ? { kind, slot } : null
}

/** Every action these kinds may be donated under, in configured order. */
export function spotlightActions(kinds: readonly SpotlightKind[]): string[] {
  return kinds.flatMap(kind =>
    Array.from({ length: kind.slots }, (_, slot) => `${kind.name}${SLOT_SEPARATOR}${slot}`),
  )
}

/**
 * Every activity type a build has to declare, for an `Info.plist`.
 *
 * The slots of every configured kind, plus whatever the app donates outside
 * the registry (`activityTypes`: a Siri phrase, an App Intent), each prefixed
 * with the bundle id the way Craft types the activity it donates.
 */
export function spotlightActivityTypes(config: unknown, bundleId: string): string[] {
  const settings = config && typeof config === 'object' ? config as Record<string, unknown> : {}
  if (settings.enabled === false)
    return []

  const own = Array.isArray(settings.activityTypes)
    ? settings.activityTypes.filter((type): type is string => typeof type === 'string' && type.trim().length > 0)
    : []

  const actions = [...own.map(type => type.trim()), ...spotlightActions(readSpotlightKinds(settings.kinds).kinds)]
  return [...new Set(actions)].map(action => `${bundleId}.${action}`)
}

/**
 * What the device shows for a record.
 *
 * The record's name alone: Craft hands the same string to Spotlight as the
 * activity's title and to Siri as its invocation phrase, and a name is the one
 * form that reads well in both — it is what somebody types looking for the
 * record, and what they could say.
 */
export function spotlightTitle(kinds: readonly SpotlightKind[], kind: string, item: SpotlightItem): string {
  const name = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim() : ''
  if (!name)
    return `${spotlightKind(kinds, kind)?.noun ?? 'Item'} #${item.id}`

  return name.length > MAX_TITLE_LENGTH ? `${name.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : name
}

/** The result of fitting a record into its kind's slots. */
export interface SpotlightPlacement {
  entries: SpotlightEntry[]
  /** The slot it now occupies, and the title to donate under it. */
  entry: SpotlightEntry
  /**
   * The record whose slot this one took, if the kind was full.
   *
   * Nothing has to be un-donated for it: the slot's identifier is the
   * activity's, so donating the new entry replaces the old one.
   */
  evicted: SpotlightEntry | null
  /**
   * Whether the entry needs donating at all.
   *
   * False when the same record already holds a slot under the same title,
   * which is the common case on a second visit — the entry the device holds is
   * already right, and re-donating it buys nothing.
   */
  changed: boolean
}

/**
 * Put a record in its kind's slots, taking the oldest when every one is taken.
 *
 * Returns the whole next list rather than mutating, so a caller stores exactly
 * what it donated: a failure between the two cannot leave bookkeeping that
 * claims an entry the device does not have.
 */
export function placeSpotlightItem(
  kinds: readonly SpotlightKind[],
  entries: readonly SpotlightEntry[],
  kind: string,
  item: SpotlightItem,
  now: number = Date.now(),
): SpotlightPlacement | null {
  const configured = spotlightKind(kinds, kind)
  if (!configured || !Number.isInteger(item.id) || item.id <= 0)
    return null

  const mine = entries.filter(entry => entry.kind === kind)
  const title = spotlightTitle(kinds, kind, item)

  // Already indexed, else a free slot, else the slot of the entry donated
  // longest ago — in that order.
  const held = mine.find(entry => entry.itemId === item.id) ?? null
  const free = held ? null : firstFreeSlot(mine, configured.slots)
  const evicted = held || free !== null ? null : oldest(mine)
  const slot = held?.slot ?? free ?? evicted?.slot
  if (slot === undefined || slot === null)
    return null

  const entry: SpotlightEntry = { kind, slot, itemId: item.id, title, donatedAt: now }
  const kept = entries.filter(other => other.kind !== kind || (other.slot !== slot && other.itemId !== item.id))

  return {
    entries: sortEntries(kinds, [...kept, entry]),
    entry,
    evicted,
    changed: !held || held.title !== title,
  }
}

/** Take a record out — what it held is the slot to un-donate. */
export function removeSpotlightItem(
  entries: readonly SpotlightEntry[],
  kind: string,
  itemId: number,
): { entries: SpotlightEntry[], removed: SpotlightEntry | null } {
  const removed = entries.find(entry => entry.kind === kind && entry.itemId === itemId) ?? null
  return {
    entries: removed ? entries.filter(entry => entry !== removed) : [...entries],
    removed,
  }
}

/** The route a tapped entry means, or null for a slot holding nothing. */
export function spotlightRoute(
  kinds: readonly SpotlightKind[],
  entries: readonly SpotlightEntry[],
  action: string,
): string | null {
  const parsed = spotlightSlot(kinds, action)
  if (!parsed)
    return null

  const entry = entries.find(held => held.kind === parsed.kind && held.slot === parsed.slot)
  const route = spotlightKind(kinds, parsed.kind)?.route
  return entry && route ? route.replace(':id', String(entry.itemId)) : null
}

/**
 * Read back a stored assignment.
 *
 * Stored state outlives the build that wrote it — a kind can be renamed and a
 * budget can shrink — so anything that is not a slot these kinds declare is
 * dropped rather than trusted: a tap on it would resolve to a record the
 * `Info.plist` no longer lets through.
 */
export function readSpotlightEntries(kinds: readonly SpotlightKind[], raw: unknown): SpotlightEntry[] {
  if (!Array.isArray(raw))
    return []

  const bySlot = new Map<string, SpotlightEntry>()
  const seen = new Set<string>()

  for (const item of raw) {
    if (!item || typeof item !== 'object')
      continue

    const record = item as Record<string, unknown>
    const { kind, slot, itemId, title, donatedAt } = record

    if (typeof kind !== 'string' || typeof slot !== 'number' || spotlightAction(kinds, kind, slot) === null)
      continue
    if (typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId <= 0)
      continue

    const slotKey = `${kind}${SLOT_SEPARATOR}${slot}`
    const itemKey = `${kind}#${itemId}`
    if (bySlot.has(slotKey) || seen.has(itemKey))
      continue

    bySlot.set(slotKey, {
      kind,
      slot,
      itemId,
      title: typeof title === 'string' && title.trim() ? title : spotlightTitle(kinds, kind, { id: itemId }),
      donatedAt: typeof donatedAt === 'number' && Number.isFinite(donatedAt) && donatedAt > 0 ? donatedAt : 0,
    })
    seen.add(itemKey)
  }

  return sortEntries(kinds, [...bySlot.values()])
}

/** Kinds in configured order, slots ascending — a stable shape to store. */
function sortEntries(kinds: readonly SpotlightKind[], entries: SpotlightEntry[]): SpotlightEntry[] {
  const order = new Map(kinds.map((kind, index) => [kind.name, index]))
  return [...entries].sort((a, b) =>
    (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0) || a.slot - b.slot,
  )
}

/** The lowest slot nothing holds, or null once every one is taken. */
function firstFreeSlot(entries: readonly SpotlightEntry[], slots: number): number | null {
  const taken = new Set(entries.map(entry => entry.slot))
  for (let slot = 0; slot < slots; slot++) {
    if (!taken.has(slot))
      return slot
  }
  return null
}

function oldest(entries: readonly SpotlightEntry[]): SpotlightEntry | null {
  return entries.reduce<SpotlightEntry | null>((found, entry) => {
    return !found || entry.donatedAt < found.donatedAt ? entry : found
  }, null)
}

/**
 * Craft's Siri calls, which are also its Spotlight calls.
 *
 * `register` builds an `NSUserActivity` typed `<bundle id>.<action>`, titles it
 * with the phrase, marks it eligible for search and prediction and makes it
 * current — so a registered phrase is both a Siri suggestion and a Spotlight
 * entry — and `remove` deletes the saved activity by that same identifier.
 *
 * Typed here because `craft-native`'s browser SDK exports neither: they exist
 * only on the object Craft injects into the WebView, so without this seam every
 * caller reaches into `globalThis.craft` and guesses at shapes.
 */
export interface SpotlightBridge {
  register?: (phrase: string, action: string) => Promise<unknown>
  remove?: (action: string) => Promise<unknown>
}

interface CraftSpotlightHost {
  craft?: { siri?: SpotlightBridge }
}

/** The host's Siri bridge, or undefined anywhere that is not a native build. */
export function spotlightBridge(): SpotlightBridge | undefined {
  const host = (globalThis as CraftSpotlightHost).craft
  return host && typeof host === 'object' ? host.siri : undefined
}

export interface SpotlightIndexOptions {
  /** The kinds to index, as configured (`config/mobile.ts`) or already read. */
  kinds: Record<string, SpotlightKindInput> | readonly SpotlightKind[]
  /** False makes every call a no-op, for an index being withdrawn. */
  enabled?: boolean
  /** Where the slot assignment is remembered. */
  storageKey?: string
  /**
   * Keys an earlier build stored under, read once.
   *
   * An app that renames its key would otherwise go quiet on every entry the
   * device is already holding, until each one happened to be donated again.
   */
  legacyStorageKeys?: readonly string[]
  /** How long to wait on a bridge call. */
  timeoutMs?: number
  /** The bridge to donate through. Defaults to the injected Craft host. */
  bridge?: () => SpotlightBridge | undefined
  /** The clock, for tests. */
  now?: () => number
  /** Where a dropped kind is reported. Defaults to `console.warn`. */
  onProblem?: (message: string) => void
}

/** The device's index, as an app drives it. */
export interface SpotlightIndex {
  /** The kinds this index carries, after the configured ones were checked. */
  readonly kinds: readonly SpotlightKind[]
  /**
   * Put one record in the index.
   *
   * Call it for a record somebody opened, or one that has become theirs.
   * False means the host cannot index, or refused.
   */
  index: (kind: string, item: SpotlightItem) => Promise<boolean>
  /**
   * Index a whole list of one kind, most important first.
   *
   * Donated in reverse so the first record given is the last donated: the most
   * recent donation is the one eviction reaches last, so a list longer than the
   * kind's budget keeps its head rather than its tail.
   */
  sync: (kind: string, items: readonly SpotlightItem[]) => Promise<number>
  /** Take a record out: it was unsaved, left, withdrawn from, deleted. */
  remove: (kind: string, itemId: number) => Promise<boolean>
  /** Empty the index — for a sign-out, where none of it is this person's. */
  clear: () => Promise<number>
  /** The route a tapped action means, or null for anything not in the index. */
  routeFor: (action: string) => string | null
  /** What the index currently claims the device is holding. */
  entries: () => readonly SpotlightEntry[]
  /** Every activity type a build declares for this index. */
  activityTypes: (bundleId: string) => string[]
  /** Forget the cached assignment and read it again. Tests use this. */
  reset: () => void
}

const DEFAULT_STORAGE_KEY = 'stacks_spotlight_index'

/**
 * Every bridge call returns a promise the native side settles.
 *
 * A host that does not know the message parks the promise forever — Craft's
 * wrappers keep the callback with no timeout — and these are called from
 * mount, so an unanswered one would hold a mount open for the life of the
 * session. Nothing here is worth waiting on for longer: the record either got
 * indexed or it did not.
 */
const BRIDGE_TIMEOUT_MS = 3000

export function createSpotlightIndex(options: SpotlightIndexOptions): SpotlightIndex {
  const report = options.onProblem ?? ((message: string) => console.warn(`[spotlight] ${message}`))
  const configured = Array.isArray(options.kinds)
    ? { kinds: [...options.kinds] as SpotlightKind[], problems: [] as string[] }
    : readSpotlightKinds(options.kinds)

  // Said once, at construction, because a dropped kind is otherwise
  // indistinguishable from a kind nothing has donated to yet.
  for (const problem of configured.problems)
    report(problem)

  const kinds: readonly SpotlightKind[] = options.enabled === false ? [] : configured.kinds
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const legacyKeys = options.legacyStorageKeys ?? []
  const timeoutMs = options.timeoutMs ?? BRIDGE_TIMEOUT_MS
  const clock = options.now ?? (() => Date.now())
  const reachBridge = options.bridge ?? spotlightBridge

  /**
   * The assignment, also held in memory.
   *
   * A tap is answered synchronously from this, and a native WebView can have
   * no `localStorage` at all (Craft can serve an app from `craft://app`), in
   * which case the index still works for the session that donated it.
   */
  let entries: SpotlightEntry[] | null = null

  function store(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    }
    catch {
      // Reading the global throws where site data is blocked outright.
      return null
    }
  }

  function read(): SpotlightEntry[] {
    if (entries)
      return entries

    entries = []
    const local = store()
    if (!local)
      return entries

    try {
      const raw = [storageKey, ...legacyKeys].map(key => local.getItem(key)).find(value => value)
      entries = raw ? readSpotlightEntries(kinds, JSON.parse(raw)) : []
    }
    catch {
      // Bookkeeping that cannot be parsed describes entries the device may
      // still hold, and nothing can be said about them. Donating over those
      // slots is what repairs it, which is what the next `index` call does.
      entries = []
    }
    return entries
  }

  function write(next: SpotlightEntry[]): void {
    entries = next
    const local = store()
    if (!local)
      return

    try {
      local.setItem(storageKey, JSON.stringify(next))
      for (const key of legacyKeys)
        local.removeItem(key)
    }
    catch {
      // A full or blocked store costs the index its memory across sessions,
      // not this session's entries.
    }
  }

  async function settled<T>(work: Promise<T> | undefined): Promise<T | null> {
    if (!work)
      return null

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        work,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs)
        }),
      ])
    }
    catch {
      // A rejected bridge call is a record that did not get indexed, which is
      // the same outcome as a host that cannot index at all.
      return null
    }
    finally {
      if (timer !== undefined)
        clearTimeout(timer)
    }
  }

  /**
   * One bridge call at a time.
   *
   * A detail page donating its own record while a list syncs would otherwise
   * read the same slot assignment twice and donate two records into one slot —
   * the second silently replacing the first on the device, with the
   * bookkeeping claiming both.
   */
  let queue: Promise<unknown> = Promise.resolve()

  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work)
    queue = next.catch(() => undefined)
    return next
  }

  async function index(kind: string, item: SpotlightItem): Promise<boolean> {
    const register = reachBridge()?.register
    if (!register || kinds.length === 0)
      return false

    return serialize(async () => {
      const placement = placeSpotlightItem(kinds, read(), kind, item, clock())
      const action = placement && spotlightAction(kinds, kind, placement.entry.slot)
      if (!placement || !action)
        return false

      // Already indexed under this title: the device holds the right entry and
      // re-donating it buys nothing. The recency is still worth storing, so the
      // next eviction takes a record nobody has opened instead of this one.
      if (!placement.changed) {
        write(placement.entries)
        return true
      }

      const accepted = await settled(register(placement.entry.title, action)) !== null
      // Stored only once the device has it, so the bookkeeping never claims an
      // entry that was never donated — a tap on it would resolve to the wrong
      // record.
      if (accepted)
        write(placement.entries)

      return accepted
    })
  }

  async function remove(kind: string, itemId: number): Promise<boolean> {
    const drop = reachBridge()?.remove
    if (!drop)
      return false

    return serialize(async () => {
      const { entries: next, removed } = removeSpotlightItem(read(), kind, itemId)
      if (!removed)
        return false

      const action = spotlightAction(kinds, kind, removed.slot)
      const gone = action ? await settled(drop(action)) !== null : false
      // Dropped whether or not the device confirms it: the record was asked to
      // stop being one of theirs, and an entry that resolves to nothing merely
      // opens the app, while one this list still claims would keep opening
      // something they removed. Donating into the slot later replaces whatever
      // the device kept.
      write(next)
      return gone
    })
  }

  async function sync(kind: string, items: readonly SpotlightItem[]): Promise<number> {
    const slots = spotlightKind(kinds, kind)?.slots
    if (!slots || !reachBridge()?.register)
      return 0

    let indexed = 0
    for (const item of [...items].slice(0, slots).reverse()) {
      if (await index(kind, item))
        indexed++
    }
    return indexed
  }

  async function clear(): Promise<number> {
    const drop = reachBridge()?.remove
    if (!drop) {
      write([])
      return 0
    }

    return serialize(async () => {
      let removed = 0
      for (const entry of read()) {
        const action = spotlightAction(kinds, entry.kind, entry.slot)
        if (action && await settled(drop(action)) !== null)
          removed++
      }
      write([])
      return removed
    })
  }

  return {
    kinds,
    index,
    sync,
    remove,
    clear,
    routeFor: action => spotlightRoute(kinds, read(), action),
    entries: () => read(),
    activityTypes: bundleId => spotlightActions(kinds).map(action => `${bundleId}.${action}`),
    reset: () => {
      entries = null
    },
  }
}

/** The events a Craft host reports a tapped shortcut or entry on. */
const TAP_EVENTS = ['craftShortcut', 'craftSiriShortcut'] as const

/**
 * Follow a tap on an indexed entry.
 *
 * Craft reports one as a `craftSiriShortcut` event carrying `{action}` (a
 * home-screen quick action arrives as `craftShortcut` with `{type}`, handled
 * here too), and the handler is called with the route the action resolves to —
 * anything this index does not recognise is left alone, so an app with its own
 * shortcut actions can keep handling those itself.
 *
 * These are plain window events, listened for directly rather than through
 * Craft's `shortcuts.onShortcut` and `siri.onInvoke`: both of those are
 * themselves listeners on these same events, so going through them would run
 * every tap twice and leave a subscription their wrappers cannot take back
 * down.
 */
export function onSpotlightTap(index: SpotlightIndex, handler: (route: string) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail
    const action = typeof detail === 'string'
      ? detail
      : detail && typeof detail === 'object'
        ? (detail as { action?: unknown, type?: unknown }).action ?? (detail as { type?: unknown }).type
        : null

    const route = typeof action === 'string' ? index.routeFor(action) : null
    if (route)
      handler(route)
  }

  if (typeof globalThis.addEventListener !== 'function')
    return () => {}

  for (const name of TAP_EVENTS)
    globalThis.addEventListener(name, listener)

  return () => {
    for (const name of TAP_EVENTS)
      globalThis.removeEventListener(name, listener)
  }
}
