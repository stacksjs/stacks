import { createHash } from 'node:crypto'
import { stripVTControlCharacters } from 'node:util'

export interface AcceptedPublication {
  name: string
  version: string
  integrity: string
  shasum: string
}

/** Preserve archive identity when an upload may already have been staged. */
export function acceptedPublications(log: string): AcceptedPublication[] {
  const accepted = new Map<string, AcceptedPublication>()
  let current: Partial<AcceptedPublication> | undefined
  for (const raw of log.split('\n')) {
    const line = stripVTControlCharacters(raw).trim()
    const provenanceUpload = /^(?:✓\s+)?Uploaded (.+)@([^ ]+) with provenance$/.exec(line)
    if (line.startsWith('Publishing ')) {
      const match = /^Publishing (.+)@([^ ]+)\.\.\.$/.exec(line)
      current = match ? { name: match[1], version: match[2] } : undefined
    }
    else if (line.startsWith('Integrity: ') && current) current.integrity = line.slice(11)
    else if (line.startsWith('Shasum: ') && current) current.shasum = line.slice(8)
    else if (line.includes('Upload accepted; publication is pending public metadata')
      || line.includes('Upload outcome is pending public verification. Do not send another upload while this version may be staged.')
      || provenanceUpload) {
      if (!current?.name || !current.version
        || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(current.integrity ?? '')
        || !/^[a-f0-9]{40}$/.test(current.shasum ?? '')) {
        throw new Error('Accepted publication has no complete original archive receipt; refusing to resume')
      }
      if (provenanceUpload && (provenanceUpload[1] !== current.name || provenanceUpload[2] !== current.version))
        throw new Error('Provenance upload acknowledgement does not match the original archive receipt')
      const receipt = current as AcceptedPublication
      const key = `${receipt.name}@${receipt.version}`
      const previous = accepted.get(key)
      if (previous && (previous.integrity !== receipt.integrity || previous.shasum !== receipt.shasum))
        throw new Error(`Conflicting original archive receipts for ${key}`)
      accepted.set(key, receipt)
      current = undefined
    }
  }
  return [...accepted.values()]
}

type ReadPublic = (url: string, init: { method: 'GET', signal: AbortSignal }) => Promise<Response>

/** Read-only: metadata AND complete bytes must match the accepted archive. */
export async function publicationMatchesOriginal(
  receipt: AcceptedPublication,
  read: ReadPublic = fetch,
  timeoutMs = 30_000,
): Promise<boolean> {
  try {
    const init = { method: 'GET' as const, signal: AbortSignal.timeout(timeoutMs) }
    const response = await read(`https://registry.npmjs.org/${encodeURIComponent(receipt.name)}/${encodeURIComponent(receipt.version)}`, init)
    if (response.status !== 200) return false
    const metadata = await response.json() as {
      name?: string, version?: string,
      dist?: { tarball?: string, integrity?: string, shasum?: string },
    }
    if (metadata.name !== receipt.name || metadata.version !== receipt.version
      || metadata.dist?.shasum !== receipt.shasum
      || !metadata.dist.integrity?.split(/\s+/).includes(receipt.integrity)
      || !metadata.dist.tarball) return false
    const tarball = new URL(metadata.dist.tarball)
    if (tarball.origin !== 'https://registry.npmjs.org' || tarball.username || tarball.password) return false
    const archive = await read(tarball.href, init)
    if (archive.status !== 200) return false
    const bytes = new Uint8Array(await archive.arrayBuffer())
    return `sha512-${createHash('sha512').update(bytes).digest('base64')}` === receipt.integrity
      && createHash('sha1').update(bytes).digest('hex') === receipt.shasum
  }
  catch {
    return false
  }
}

if (import.meta.main) {
  const [file, seconds = '1200'] = process.argv.slice(2)
  const budget = Number(seconds) * 1000
  if (!file || !Number.isSafeInteger(budget) || budget <= 0) throw new Error('Expected a publish log and a positive wait budget')
  const receipts = acceptedPublications(await Bun.file(file).text())
  if (!receipts.length) throw new Error('Publish failed without an accepted original archive; refusing to resume')
  // One absolute budget covers every package, request and response body.
  const deadline = performance.now() + budget
  for (const receipt of receipts) {
    while (true) {
      const remaining = Math.floor(deadline - performance.now())
      if (remaining <= 0) throw new Error(`Original ${receipt.name}@${receipt.version} is still pending; no publication resumed`)
      if (await publicationMatchesOriginal(receipt, fetch, Math.min(30_000, remaining))) break
      const pause = Math.min(15_000, Math.max(0, deadline - performance.now()))
      await Bun.sleep(pause)
    }
    console.log(`Verified original ${receipt.name}@${receipt.version}: metadata, SHA-512 and SHA-1`)
  }
}
