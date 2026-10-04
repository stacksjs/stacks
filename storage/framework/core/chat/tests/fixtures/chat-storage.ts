import { Database } from 'bun:sqlite'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * A ChatStorage.sqlite laid out the way WhatsApp for Mac writes it (Core Data,
 * the same model as WhatsApp on iPhone): `Z`-prefixed tables and columns,
 * Apple-epoch second dates, group senders through ZWAGROUPMEMBER, media rows
 * whose path is relative to the container's `Message/` directory and whose
 * mime type sits in ZVCARDSTRING, and the archive as ZARCHIVED on the chat.
 * Only the columns the driver reads, plus enough to look real.
 */

const APPLE_EPOCH_S = 978_307_200

type Field = [number, string | bigint | Uint8Array]

/** A minimal protobuf encoder for the fixtures: varints and length-delimited fields. */
function proto(list: Field[]): Uint8Array {
  const out: number[] = []
  const varint = (value: bigint): void => {
    let v = value
    while (v >= 0x80n) {
      out.push(Number(v & 0x7Fn) | 0x80)
      v >>= 7n
    }
    out.push(Number(v))
  }
  for (const [field, value] of list) {
    if (typeof value === 'bigint') {
      varint(BigInt(field) << 3n)
      varint(value)
      continue
    }
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
    varint((BigInt(field) << 3n) | 2n)
    varint(BigInt(bytes.length))
    out.push(...bytes)
  }
  return new Uint8Array(out)
}

export const DANA = '15550004444@s.whatsapp.net'
export const EMEKA = '15550005555@s.whatsapp.net'
export const CLIMBERS = '120363000000000001@g.us'

export interface AddWhatsApp {
  type?: number
  text?: string | null
  fromMe?: boolean
  at?: number
  /** A group member's JID. */
  member?: string
  media?: { path?: string, mime?: string, vcard?: string, title?: string, bytes?: number, lat?: number, lon?: number, file?: string }
}

export class FakeChatStorage {
  readonly dir: string
  readonly path: string
  readonly db: Database
  private clock = Date.UTC(2026, 0, 1, 12)
  private stanza = 0

  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'attic-whatsapp-'))
    this.path = join(this.dir, 'ChatStorage.sqlite')
    this.db = new Database(this.path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE ZWACHATSESSION (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZARCHIVED INTEGER, ZHIDDEN INTEGER, ZREMOVED INTEGER,
        ZSESSIONTYPE INTEGER, ZUNREADCOUNT INTEGER, ZLASTMESSAGE INTEGER, ZLASTMESSAGEDATE TIMESTAMP,
        ZCONTACTJID VARCHAR, ZLASTMESSAGETEXT VARCHAR, ZPARTNERNAME VARCHAR
      );
      CREATE TABLE ZWAMESSAGE (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZISFROMME INTEGER, ZMESSAGETYPE INTEGER, ZFLAGS INTEGER,
        ZCHATSESSION INTEGER, ZGROUPMEMBER INTEGER, ZMEDIAITEM INTEGER, ZMESSAGEINFO INTEGER, ZMESSAGEDATE TIMESTAMP, ZSENTDATE TIMESTAMP,
        ZFROMJID VARCHAR, ZTOJID VARCHAR, ZPUSHNAME VARCHAR, ZSTANZAID VARCHAR, ZTEXT VARCHAR
      );
      CREATE INDEX ZWAMESSAGE_ZCHATSESSION_INDEX ON ZWAMESSAGE (ZCHATSESSION);
      CREATE TABLE ZWAMEDIAITEM (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZFILESIZE INTEGER, ZMESSAGE INTEGER,
        ZLATITUDE FLOAT, ZLONGITUDE FLOAT, ZMEDIALOCALPATH VARCHAR, ZTITLE VARCHAR, ZVCARDNAME VARCHAR, ZVCARDSTRING VARCHAR, ZMETADATA BLOB
      );
      CREATE TABLE ZWAMESSAGEINFO (Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZMESSAGE INTEGER, ZRECEIPTINFO BLOB);
      CREATE TABLE ZWAGROUPMEMBER (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZISACTIVE INTEGER, ZCHATSESSION INTEGER,
        ZCONTACTNAME VARCHAR, ZFIRSTNAME VARCHAR, ZMEMBERJID VARCHAR
      );
      CREATE TABLE ZWAPROFILEPUSHNAME (Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZJID VARCHAR, ZPUSHNAME VARCHAR);
      CREATE TABLE ZWAPROFILEPICTUREITEM (Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZREQUESTDATE TIMESTAMP, ZJID VARCHAR, ZPATH VARCHAR, ZPICTUREID VARCHAR);
    `)
  }

  /** A chat; type 0 direct, 1 group, 3 status updates. Returns its primary key. */
  chat(jid: string, name: string, type = 0): number {
    const result = this.db.query('INSERT INTO ZWACHATSESSION (Z_ENT, Z_OPT, ZARCHIVED, ZHIDDEN, ZREMOVED, ZSESSIONTYPE, ZUNREADCOUNT, ZCONTACTJID, ZPARTNERNAME) VALUES (4, 1, 0, 0, 0, ?, 0, ?, ?)').run(type, jid, name)
    return Number(result.lastInsertRowid)
  }

  member(chat: number, jid: string, contactName: string | null, pushName?: string): number {
    if (pushName)
      this.db.query('INSERT INTO ZWAPROFILEPUSHNAME (Z_ENT, Z_OPT, ZJID, ZPUSHNAME) VALUES (9, 1, ?, ?)').run(jid, pushName)
    return Number(this.db.query('INSERT INTO ZWAGROUPMEMBER (Z_ENT, Z_OPT, ZISACTIVE, ZCHATSESSION, ZCONTACTNAME, ZMEMBERJID) VALUES (6, 1, 1, ?, ?, ?)').run(chat, contactName, jid).lastInsertRowid)
  }

  add(chat: number, message: AddWhatsApp): number {
    this.clock = message.at ?? this.clock + 60_000
    const date = this.clock / 1000 - APPLE_EPOCH_S
    const type = message.type ?? 0
    const member = message.member
      ? (this.db.query('SELECT Z_PK AS pk FROM ZWAGROUPMEMBER WHERE ZCHATSESSION = ? AND ZMEMBERJID = ?').get(chat, message.member) as { pk: number }).pk
      : null
    const pk = Number(this.db.query(`INSERT INTO ZWAMESSAGE (Z_ENT, Z_OPT, ZISFROMME, ZMESSAGETYPE, ZFLAGS, ZCHATSESSION, ZGROUPMEMBER, ZMESSAGEDATE, ZSENTDATE, ZSTANZAID, ZTEXT)
      VALUES (8, 1, ?, ?, 16777216, ?, ?, ?, ?, ?, ?)`).run(message.fromMe ? 1 : 0, type, chat, member, date, date, `3EB0${String(++this.stanza).padStart(16, '0')}`, message.text ?? null).lastInsertRowid)
    if (message.media) {
      const m = message.media
      const media = Number(this.db.query('INSERT INTO ZWAMEDIAITEM (Z_ENT, Z_OPT, ZFILESIZE, ZMESSAGE, ZLATITUDE, ZLONGITUDE, ZMEDIALOCALPATH, ZTITLE, ZVCARDSTRING) VALUES (7, 1, ?, ?, ?, ?, ?, ?, ?)')
        .run(m.bytes ?? 0, pk, m.lat ?? 0, m.lon ?? 0, m.path ?? null, m.title ?? null, m.vcard ?? m.mime ?? null).lastInsertRowid)
      this.db.query('UPDATE ZWAMESSAGE SET ZMEDIAITEM = ? WHERE Z_PK = ?').run(media, pk)
      if (m.path && m.file !== undefined) {
        const file = join(this.dir, 'Message', m.path)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, m.file)
      }
    }
    this.db.query('UPDATE ZWACHATSESSION SET ZLASTMESSAGE = ?, ZLASTMESSAGEDATE = ?, ZLASTMESSAGETEXT = ? WHERE Z_PK = ?').run(pk, date, message.text ?? '', chat)
    return pk
  }

  /**
   * A profile picture row, and the file WhatsApp writes beside its path
   * (`<path>.thumb`) when it has fetched it; no file for one it has not.
   */
  picture(jid: string, bytes: Uint8Array | null): void {
    const path = `Media/Profile/${jid.split('@')[0]}-1700000000`
    this.db.query('INSERT INTO ZWAPROFILEPICTUREITEM (Z_ENT, Z_OPT, ZJID, ZPATH, ZPICTUREID) VALUES (10, 1, ?, ?, ?)').run(jid, path, '1')
    if (bytes) {
      mkdirSync(join(this.dir, 'Media', 'Profile'), { recursive: true })
      writeFileSync(join(this.dir, `${path}.thumb`), bytes)
    }
  }

  stanzaOf(pk: number): string {
    return (this.db.query('SELECT ZSTANZAID AS s FROM ZWAMESSAGE WHERE Z_PK = ?').get(pk) as { s: string }).s
  }

  /** Marks message `pk` as a reply quoting `quoted`, the way WhatsApp's media metadata does (field 5). */
  quote(pk: number, quoted: number): void {
    const metadata = proto([[5, this.stanzaOf(quoted)], [68, new Uint8Array(32)]])
    const row = this.db.query('SELECT ZMEDIAITEM AS m FROM ZWAMESSAGE WHERE Z_PK = ?').get(pk) as { m: number | null }
    if (row.m)
      this.db.query('UPDATE ZWAMEDIAITEM SET ZMETADATA = ? WHERE Z_PK = ?').run(metadata, row.m)
    else {
      const media = Number(this.db.query('INSERT INTO ZWAMEDIAITEM (Z_ENT, Z_OPT, ZMESSAGE, ZMETADATA) VALUES (7, 1, ?, ?)').run(pk, metadata).lastInsertRowid)
      this.db.query('UPDATE ZWAMESSAGE SET ZMEDIAITEM = ? WHERE Z_PK = ?').run(media, pk)
    }
  }

  /** Reactions on message `pk`, laid out as WhatsApp's receipts blob: field 7 of entries in field 1. */
  react(pk: number, reactions: Array<{ emoji: string, jid?: string, fromMe?: boolean, at: number }>): void {
    const entries = reactions.map((r, i) => [1, proto([
      [1, `3A${String(pk).padStart(6, '0')}R${i}`],
      ...(r.jid ? [[2, r.jid] as Field] : []),
      [3, r.emoji],
      [4, BigInt(r.at)],
      [5, 1n],
      ...(r.fromMe ? [[6, 1n] as Field] : []),
      [7, 1n],
    ])] as Field)
    const receipts = proto([[2, proto([[1, new Uint8Array(9)], [4, 1n]])], [7, proto(entries)]])
    const info = Number(this.db.query('INSERT INTO ZWAMESSAGEINFO (Z_ENT, Z_OPT, ZMESSAGE, ZRECEIPTINFO) VALUES (11, 1, ?, ?)').run(pk, receipts).lastInsertRowid)
    this.db.query('UPDATE ZWAMESSAGE SET ZMESSAGEINFO = ? WHERE Z_PK = ?').run(info, pk)
  }

  /** What WhatsApp does when its Archive is pressed. */
  setArchived(jid: string, archived: boolean): void {
    this.db.query('UPDATE ZWACHATSESSION SET ZARCHIVED = ? WHERE ZCONTACTJID = ?').run(archived ? 1 : 0, jid)
  }
}
