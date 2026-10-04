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
        ZCHATSESSION INTEGER, ZGROUPMEMBER INTEGER, ZMEDIAITEM INTEGER, ZMESSAGEDATE TIMESTAMP, ZSENTDATE TIMESTAMP,
        ZFROMJID VARCHAR, ZTOJID VARCHAR, ZPUSHNAME VARCHAR, ZSTANZAID VARCHAR, ZTEXT VARCHAR
      );
      CREATE INDEX ZWAMESSAGE_ZCHATSESSION_INDEX ON ZWAMESSAGE (ZCHATSESSION);
      CREATE TABLE ZWAMEDIAITEM (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZFILESIZE INTEGER, ZMESSAGE INTEGER,
        ZLATITUDE FLOAT, ZLONGITUDE FLOAT, ZMEDIALOCALPATH VARCHAR, ZTITLE VARCHAR, ZVCARDNAME VARCHAR, ZVCARDSTRING VARCHAR
      );
      CREATE TABLE ZWAGROUPMEMBER (
        Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZISACTIVE INTEGER, ZCHATSESSION INTEGER,
        ZCONTACTNAME VARCHAR, ZFIRSTNAME VARCHAR, ZMEMBERJID VARCHAR
      );
      CREATE TABLE ZWAPROFILEPUSHNAME (Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER, ZJID VARCHAR, ZPUSHNAME VARCHAR);
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

  /** What WhatsApp does when its Archive is pressed. */
  setArchived(jid: string, archived: boolean): void {
    this.db.query('UPDATE ZWACHATSESSION SET ZARCHIVED = ? WHERE ZCONTACTJID = ?').run(archived ? 1 : 0, jid)
  }
}
