import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipEntries } from '../src/zip'

/**
 * `zipEntries()` builds an archive in memory, so every test hands its bytes to
 * readers that share no code with it: Info-ZIP's `unzip` (tests the CRCs,
 * extracts, and `zipinfo` mode prints the headers), and, where installed,
 * libarchive's `bsdtar` and Python's `zipfile`.
 */

const root = mkdtempSync(join(tmpdir(), 'stacks-zip-entries-'))
let written = 0

afterAll(() => {
  rmSync(root, { force: true, recursive: true })
})

function save(bytes: Uint8Array): string {
  const file = join(root, `archive-${++written}.zip`)
  writeFileSync(file, bytes)
  return file
}

function run(cmd: string[]): { code: number, out: Uint8Array, text: string } {
  // A UTF-8 locale, or bsdtar prints a non-ASCII name as octal escapes.
  const result = Bun.spawnSync({ cmd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, LC_ALL: 'C.UTF-8' } })
  const out = result.stdout as Uint8Array
  return { code: result.exitCode ?? -1, out, text: new TextDecoder().decode(out) + new TextDecoder().decode(result.stderr as Uint8Array) }
}

const hasBsdtar = Bun.which('bsdtar') !== null
const hasPython = Bun.which('python3') !== null

const csv = `id,name\n${Array.from({ length: 200 }, (_, i) => `${i},Member ${i}`).join('\n')}\n`
const noise = crypto.getRandomValues(new Uint8Array(4096))
const at = new Date(2026, 9, 13, 14, 35, 27) // local time, as DOS dates are

const entries = [
  { name: 'members.csv', data: csv },
  { name: 'raw/noise.bin', data: noise },
  { name: 'empty.txt', data: '' },
  { name: 'Übersicht/größe – 日本.txt', data: 'Grüße\n' },
]

describe('zipEntries', () => {
  const file = save(zipEntries(entries, { date: at }))

  it('passes unzip -t (every CRC checked)', () => {
    const test = run(['unzip', '-t', file])
    expect(test.text).toContain('No errors detected')
    expect(test.code).toBe(0)
  })

  it('extracts every entry byte for byte with unzip', () => {
    for (const entry of entries) {
      const extracted = run(['unzip', '-p', file, entry.name])
      expect(extracted.code).toBe(0)
      const expected = typeof entry.data === 'string' ? new TextEncoder().encode(entry.data) : entry.data
      expect(Buffer.compare(Buffer.from(extracted.out), Buffer.from(expected))).toBe(0)
    }
  })

  it('deflates what shrinks, stores what does not, and keeps order, UTF-8 names, mode and time', () => {
    const info = run(['unzip', '-Z', '-l', '-T', file])
    expect(info.code).toBe(0)
    const lines = info.text.split('\n').filter(line => line.startsWith('-rw-r--r--'))
    // Apple's unzip prints a non-ASCII name as ???, so only the ASCII ones are compared here;
    // the extraction test above and the bsdtar and Python readers below match the UTF-8 one.
    expect(lines).toHaveLength(entries.length)
    expect(lines.slice(0, 3).map(line => line.split(/\s+/).slice(8).join(' '))).toEqual(entries.slice(0, 3).map(entry => entry.name))
    expect(lines[0]).toContain('defN') // members.csv, deflated
    expect(lines[1]).toContain('stor') // random bytes do not shrink
    expect(lines[2]).toContain('stor') // empty
    for (const line of lines)
      expect(line).toContain('20261013.143526') // 27 s rounds down to DOS's 2-second step
  })

  it('writes a correct CRC-32 and sets the UTF-8 flag', () => {
    const bytes = zipEntries([{ name: 'check.txt', data: '123456789' }], { level: 0, date: at })
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(0, true)).toBe(0x04034B50)
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800)
    expect(view.getUint16(8, true)).toBe(0) // level 0 stores
    expect(view.getUint32(14, true)).toBe(0xCBF43926) // the CRC-32 check value
  })

  it('reads back with libarchive (bsdtar)', () => {
    if (!hasBsdtar)
      return
    const listed = run(['bsdtar', '-tf', file])
    expect(listed.code).toBe(0)
    // macOS's libarchive hands names back decomposed (NFD).
    expect(listed.text.trim().split('\n').map(name => name.normalize('NFC'))).toEqual(entries.map(entry => entry.name))
    expect(run(['bsdtar', '-xOf', file, 'members.csv']).text).toBe(csv)
  })

  it('reads back with Python\'s zipfile', () => {
    if (!hasPython)
      return
    const script = [
      'import sys, zipfile, hashlib',
      'z = zipfile.ZipFile(sys.argv[1])',
      'assert z.testzip() is None',
      'for i in z.infolist(): print(i.filename, i.flag_bits & 0x800, i.date_time, hashlib.sha256(z.read(i)).hexdigest())',
    ].join('\n')
    const result = run(['python3', '-c', script, file])
    expect(result.code).toBe(0)
    const lines = result.text.trim().split('\n')
    expect(lines).toHaveLength(entries.length)
    entries.forEach((entry, i) => {
      const hash = new Bun.CryptoHasher('sha256').update(entry.data).digest('hex')
      expect(lines[i]).toBe(`${entry.name} 2048 (2026, 10, 13, 14, 35, 26) ${hash}`)
    })
  })

  it('is byte-identical for the same input and date', () => {
    expect(Buffer.compare(Buffer.from(zipEntries(entries, { date: at })), Buffer.from(zipEntries(entries, { date: at })))).toBe(0)
  })

  it('lets an entry carry its own date and clamps dates to the DOS range', () => {
    const own = save(zipEntries([
      { name: 'own.txt', data: 'a', date: new Date(2024, 1, 29, 8, 0, 0) },
      { name: 'old.txt', data: 'b', date: new Date(1970, 0, 1) },
      { name: 'fallback.txt', data: 'c' },
    ], { date: at }))
    const info = run(['unzip', '-Z', '-l', '-T', own]).text
    expect(info).toMatch(/20240229\.080000 own\.txt/)
    expect(info).toMatch(/19800101\.000000 old\.txt/)
    expect(info).toMatch(/20261013\.143526 fallback\.txt/)
  })

  it('makes an empty archive: just the end record', () => {
    const bytes = zipEntries([])
    expect(bytes.length).toBe(22)
    expect(run(['unzip', '-l', save(bytes)]).text).toContain('zipfile is empty') // a warning, not a format error
  })

  it('turns backslashes into forward slashes', () => {
    const info = run(['unzip', '-Z', '-1', save(zipEntries([{ name: 'a\\b.txt', data: 'x' }]))])
    expect(info.text.trim()).toBe('a/b.txt')
  })

  it('refuses names that could escape the folder, and repeats', () => {
    for (const name of ['', '/etc/passwd', 'C:/x.txt', '../x.txt', 'a/../../x.txt', 'a//b.txt', './x.txt', 'dir/', 'nul\0.txt'])
      expect(() => zipEntries([{ name, data: 'x' }])).toThrow('not a safe file name')
    expect(() => zipEntries([{ name: 'a.txt', data: 'x' }, { name: 'a.txt', data: 'y' }])).toThrow('two entries are named "a.txt"')
  })

  it('refuses a level outside 0-9 and an invalid date', () => {
    expect(() => zipEntries([], { level: 10 })).toThrow('level must be an integer from 0 to 9')
    expect(() => zipEntries([{ name: 'a.txt', data: 'x', date: new Date(Number.NaN) }])).toThrow('invalid date')
  })

  it('refuses what only ZIP64 could hold, clearly', () => {
    expect(() => zipEntries(Array.from({ length: 65_536 }, (_, i) => ({ name: `${i}.txt`, data: '' }))))
      .toThrow('more than the 65,535 a ZIP without ZIP64 holds')

    // A 4 GB entry, without allocating 4 GB.
    const huge = Object.defineProperty(new Uint8Array(0), 'length', { value: 0x1_0000_0000 })
    expect(() => zipEntries([{ name: 'huge.bin', data: huge }])).toThrow('past the 4 GB a ZIP without ZIP64 holds')
  })
})
