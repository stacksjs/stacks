function fail(message: string): never { throw new Error(`Release verification blocked: ${message}`) }

export async function boundedBody(response: Response, limit: number): Promise<Uint8Array> {
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > limit) {
    await response.body?.cancel()
    fail('Response exceeds its byte budget')
  }
  if (!response.body) fail('Response has no body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > limit) fail('Response exceeds its byte budget')
      chunks.push(next.value)
    }
    return Buffer.concat(chunks, length)
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

// Check physical tar bounds before an archive reader allocates declared sizes.
// Sparse files and links cannot describe an installed npm code identity here.
export function validateTarBounds(tar: Uint8Array): number {
  if (!tar.byteLength || tar.byteLength % 512) fail('Published archive has invalid tar block bounds')
  let offset = 0
  let files = 0
  let headers = 0
  const text = (start: number, length: number): string => new TextDecoder().decode(tar.subarray(start, start + length)).replace(/\0.*$/s, '').trim()
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      if (tar.subarray(offset).some(byte => byte !== 0)) fail('Published archive has data after its tar terminator')
      return files
    }
    if (++headers > 100_000) fail('Published archive has too many entries')
    const rawSize = text(offset + 124, 12)
    if (!/^[0-7]+$/.test(rawSize)) fail('Published archive has an unsupported tar size')
    const size = Number.parseInt(rawSize, 8)
    const end = offset + 512 + Math.ceil(size / 512) * 512
    if (!Number.isSafeInteger(end) || end > tar.byteLength) fail('Published archive declares bytes outside its tar bounds')
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]!)
    if (type === '0') files++
    else if (type === 'x' || type === 'g') {
      const metadata = tar.subarray(offset + 512, offset + 512 + size)
      const allowed = new Set(['path', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname', 'comment', 'charset', 'hdrcharset'])
      for (let start = 0; start < metadata.length;) {
        const space = metadata.indexOf(32, start)
        if (space < 0) fail('Published archive has malformed PAX records')
        const rawLength = new TextDecoder().decode(metadata.subarray(start, space))
        const length = Number(rawLength)
        const end = start + length
        if (!/^\d+$/.test(rawLength) || !Number.isSafeInteger(end) || end > metadata.length || end <= space + 2 || metadata[end - 1] !== 10)
          fail('Published archive has malformed PAX bounds')
        const equals = metadata.indexOf(61, space + 1)
        const key = new TextDecoder().decode(metadata.subarray(space + 1, equals))
        if (equals < 0 || equals >= end - 1 || !allowed.has(key)) fail('Published archive has unsupported PAX allocation or link metadata')
        start = end
      }
    }
    else if (type !== '5' && type !== 'L') fail('Published archive contains a link or unsupported tar entry')
    offset = end
  }
  fail('Published archive has no tar terminator')
}

/** Bounded npm archive reader shared by retained candidates and release evidence. */
export async function libraryArchiveEntries(bytes: Uint8Array, limit = 256 * 1024 * 1024): Promise<Map<string, Uint8Array>> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))
  const tar = await boundedBody(new Response(stream), limit)
  const count = validateTarBounds(tar)
  const files = await new Bun.Archive(tar).files()
  if (!count || files.size !== count) fail('Published archive has missing or duplicate file paths')
  const result = new Map<string, Uint8Array>()
  for (const [name, file] of files) {
    const path = name.slice('package/'.length)
    if (!name.startsWith('package/') || !safeArchivePath(path) || result.has(path))
      fail('Published archive contains an unsafe or duplicate package path')
    result.set(path, new Uint8Array(await file.arrayBuffer()))
  }
  if (!result.has('package.json')) fail('Published archive has no package manifest')
  return result
}

export function safeArchivePath(path: string): boolean {
  return typeof path === 'string' && !!path && !path.includes('\\') && !path.includes(':')
    && !path.includes('\0') && !path.split('/').some(part => !part || part === '.' || part === '..')
}
