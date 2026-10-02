import { createHash } from 'node:crypto'

/**
 * Stable row identities for imported records, without a schema change.
 *
 * Re-running an import must update what the last run wrote rather than add a
 * second copy, so every imported row needs a key that survives between runs.
 * `products` has no slug, SKU or external-id column to hold one, and names
 * are not unique on any platform.
 *
 * Every commerce table already has a unique `uuid` column (the `useUuid`
 * trait). A name-based UUID (RFC 9562 version 5) of
 * `<source>:<store host>:<kind>:<external id>` is the same value on every run
 * and unique per source record, so the existing column doubles as the
 * external-id index. Rows created any other way keep their random v7 UUIDs and
 * can never collide with these.
 */

/** Namespace for every UUID the catalog importer derives. Never change it. */
export const CATALOG_IMPORT_NAMESPACE = '5d0c8a3e-6f1b-4c2a-9e47-b18f3d2a6c90'

/** RFC 9562 version 5 (SHA-1, name-based) UUID. */
export function uuidV5(name: string, namespace: string = CATALOG_IMPORT_NAMESPACE): string {
  const namespaceHex = namespace.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(namespaceHex))
    throw new TypeError(`Invalid namespace UUID "${namespace}"`)

  const bytes = createHash('sha1')
    .update(Buffer.from(namespaceHex, 'hex'))
    .update(name, 'utf8')
    .digest()
    .subarray(0, 16)

  bytes[6] = (bytes[6]! & 0x0F) | 0x50
  bytes[8] = (bytes[8]! & 0x3F) | 0x80

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type CatalogRecordKind = 'product' | 'variant'

/** The deterministic `uuid` for one imported record. */
export function catalogUuid(source: string, host: string, kind: CatalogRecordKind, externalId: string): string {
  return uuidV5(`${source}:${host.toLowerCase()}:${kind}:${externalId}`)
}
