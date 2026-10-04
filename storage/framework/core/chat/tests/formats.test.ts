import { describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBplist } from '../src/inbox/formats/bplist'
import { bytesOf, fields, numberOf, stringOf, tryFields } from '../src/inbox/formats/protobuf'

describe('binary property lists', () => {
  // plutil writes the real format, so the reader is checked against Apple's encoder.
  it.skipIf(process.platform !== 'darwin')('reads what plutil writes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bplist-'))
    const xml = join(dir, 'p.plist')
    writeFileSync(xml, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>groupPhotoGuid</key><string>at_0_ABCD-1234</string>
  <key>unicode</key><string>Café ☕</string>
  <key>count</key><integer>300</integer>
  <key>big</key><integer>5000000000</integer>
  <key>ratio</key><real>1.5</real>
  <key>on</key><true/>
  <key>blob</key><data>AQID</data>
  <key>list</key><array><string>a</string><integer>2</integer></array>
  <key>when</key><date>2026-01-01T00:00:00Z</date>
</dict></plist>`)
    execFileSync('/usr/bin/plutil', ['-convert', 'binary1', xml])
    expect(parseBplist(new Uint8Array(readFileSync(xml)))).toEqual({
      groupPhotoGuid: 'at_0_ABCD-1234',
      unicode: 'Café ☕',
      count: 300,
      big: 5000000000n,
      ratio: 1.5,
      on: true,
      blob: new Uint8Array([1, 2, 3]),
      list: ['a', 2],
      when: new Date('2026-01-01T00:00:00Z'),
    })
  })

  it('refuses what is not one', () => {
    expect(() => parseBplist(new TextEncoder().encode('<?xml version="1.0"?><plist/>'.padEnd(64)))).toThrow()
  })
})

describe('protobuf', () => {
  // field 1 varint 150, field 2 string "hi", field 3 embedded { field 1: "ok" }
  const message = new Uint8Array([0x08, 0x96, 0x01, 0x12, 0x02, 0x68, 0x69, 0x1A, 0x04, 0x0A, 0x02, 0x6F, 0x6B])

  it('splits a message into numbered fields', () => {
    const list = fields(message)
    expect(numberOf(list, 1)).toBe(150n)
    expect(stringOf(list, 2)).toBe('hi')
    expect(stringOf(tryFields(bytesOf(list, 3)), 1)).toBe('ok')
  })

  it('reports garbage as not a message', () => {
    expect(tryFields(new Uint8Array([0x0A, 0x09, 0x01]))).toBeNull()
    expect(tryFields(null)).toBeNull()
  })
})
