import type { DsfinvkClosing } from '../dsfinvk'
import { describe, expect, it } from 'bun:test'
import {
  DSFINVK_TABLES,
  dsfinvkCsv,
  dsfinvkExport,
  dsfinvkIndexXml,
  dsfinvkMoney,
  dsfinvkRowProblems,
  dsfinvkTable,
  dsfinvkText,
  DsfinvkError,
  GDPDU_DTD_FILE,
} from '../dsfinvk'

const columns = (name: Parameters<typeof dsfinvkTable>[0]) => dsfinvkTable(name).columns.map(column => column.name)
const KEY = ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR']

describe('the tables of DSFinV-K 2.4', () => {
  it('has the twenty files of the official index.xml, in its order', () => {
    expect(DSFINVK_TABLES.map(table => `${table.file}:${table.name}`)).toEqual([
      'cashpointclosing.csv:Stamm_Abschluss',
      'location.csv:Stamm_Orte',
      'cashregister.csv:Stamm_Kassen',
      'slaves.csv:Stamm_Terminals',
      'pa.csv:Stamm_Agenturen',
      'tse.csv:Stamm_TSE',
      'vat.csv:Stamm_USt',
      'businesscases.csv:Z_GV_Typ',
      'payment.csv:Z_Zahlart',
      'cash_per_currency.csv:Z_Waehrungen',
      'transactions.csv:Bonkopf',
      'datapayment.csv:Bonkopf_Zahlarten',
      'lines.csv:Bonpos',
      'itemamounts.csv:Bonpos_Preisfindung',
      'subitems.csv:Bonpos_Zusatzinfo',
      'transactions_tse.csv:TSE_Transaktionen',
      'transactions_vat.csv:Bonkopf_USt',
      'lines_vat.csv:Bonpos_USt',
      'allocation_groups.csv:Bonkopf_AbrKreis',
      'references.csv:Bon_Referenzen',
    ])
  })

  it('starts every table with the closing’s key and has the official number of columns', () => {
    const counts = Object.fromEntries(DSFINVK_TABLES.map(table => [table.file, table.columns.length]))
    expect(counts).toEqual({
      'cashpointclosing.csv': 16,
      'location.csv': 9,
      'cashregister.csv': 10,
      'slaves.csv': 9,
      'pa.csv': 11,
      'tse.csv': 11,
      'vat.csv': 6,
      'businesscases.csv': 10,
      'payment.csv': 6,
      'cash_per_currency.csv': 5,
      'transactions.csv': 23,
      'datapayment.csv': 9,
      'lines.csv': 21,
      'itemamounts.csv': 10,
      'subitems.csv': 17,
      'transactions_tse.csv': 13,
      'transactions_vat.csv': 8,
      'lines_vat.csv': 9,
      'allocation_groups.csv': 5,
      'references.csv': 11,
    })
    for (const table of DSFINVK_TABLES) expect(table.columns.slice(0, 3).map(column => column.name)).toEqual(KEY)
  })

  it('orders the columns of the receipt tables as the specification does', () => {
    expect(columns('Bonkopf')).toEqual([...KEY, 'BON_ID', 'BON_NR', 'BON_TYP', 'BON_NAME', 'TERMINAL_ID', 'BON_STORNO', 'BON_START', 'BON_ENDE', 'BEDIENER_ID', 'BEDIENER_NAME', 'UMS_BRUTTO', 'KUNDE_NAME', 'KUNDE_ID', 'KUNDE_TYP', 'KUNDE_STRASSE', 'KUNDE_PLZ', 'KUNDE_ORT', 'KUNDE_LAND', 'KUNDE_USTID', 'BON_NOTIZ'])
    expect(columns('Bonpos')).toEqual([...KEY, 'BON_ID', 'POS_ZEILE', 'GUTSCHEIN_NR', 'ARTIKELTEXT', 'POS_TERMINAL_ID', 'GV_TYP', 'GV_NAME', 'INHAUS', 'P_STORNO', 'AGENTUR_ID', 'ART_NR', 'GTIN', 'WARENGR_ID', 'WARENGR', 'MENGE', 'FAKTOR', 'EINHEIT', 'STK_BR'])
    expect(columns('TSE_Transaktionen')).toEqual([...KEY, 'BON_ID', 'TSE_ID', 'TSE_TANR', 'TSE_TA_START', 'TSE_TA_ENDE', 'TSE_TA_VORGANGSART', 'TSE_TA_SIGZ', 'TSE_TA_SIG', 'TSE_TA_FEHLER', 'TSE_VORGANGSDATEN'])
    expect(columns('Bonkopf_Zahlarten')).toEqual([...KEY, 'BON_ID', 'ZAHLART_TYP', 'ZAHLART_NAME', 'ZAHLWAEH_CODE', 'ZAHLWAEH_BETRAG', 'BASISWAEH_BETRAG'])
    expect(columns('Bon_Referenzen')).toEqual([...KEY, 'BON_ID', 'POS_ZEILE', 'REF_TYP', 'REF_NAME', 'REF_DATUM', 'REF_Z_KASSE_ID', 'REF_Z_NR', 'REF_BON_ID'])
    expect(columns('Stamm_Abschluss')).toEqual([...KEY, 'Z_BUCHUNGSTAG', 'TAXONOMIE_VERSION', 'Z_START_ID', 'Z_ENDE_ID', 'NAME', 'STRASSE', 'PLZ', 'ORT', 'LAND', 'STNR', 'USTID', 'Z_SE_ZAHLUNGEN', 'Z_SE_BARZAHLUNGEN'])
    expect(columns('Stamm_TSE')).toEqual([...KEY, 'TSE_ID', 'TSE_SERIAL', 'TSE_SIG_ALGO', 'TSE_ZEITFORMAT', 'TSE_PD_ENCODING', 'TSE_PUBLIC_KEY', 'TSE_ZERTIFIKAT_I', 'TSE_ZERTIFIKAT_II'])
    expect(columns('Z_GV_Typ')).toEqual([...KEY, 'GV_TYP', 'GV_NAME', 'AGENTUR_ID', 'UST_SCHLUESSEL', 'Z_UMS_BRUTTO', 'Z_UMS_NETTO', 'Z_UST'])
  })

  it('declares types, lengths and decimals as the official index.xml does', () => {
    const column = (table: Parameters<typeof dsfinvkTable>[0], name: string) => dsfinvkTable(table).columns.find(entry => entry.name === name)!
    expect(column('Bonkopf', 'BON_ID')).toMatchObject({ type: 'alphanumeric', maxLength: 40 })
    expect(column('Bonkopf', 'UMS_BRUTTO')).toMatchObject({ type: 'numeric', accuracy: 2 })
    expect(column('Bonpos', 'MENGE')).toMatchObject({ type: 'numeric', accuracy: 3 })
    expect(column('Bonpos', 'STK_BR')).toMatchObject({ type: 'numeric', accuracy: 5 })
    expect(column('Bonpos_USt', 'POS_BRUTTO')).toMatchObject({ type: 'numeric', accuracy: 5 })
    expect(column('TSE_Transaktionen', 'TSE_TA_SIG')).toMatchObject({ type: 'alphanumeric', maxLength: 512 })
    expect(column('TSE_Transaktionen', 'TSE_TA_FEHLER')).toMatchObject({ type: 'alphanumeric', maxLength: 200 })
    expect(column('Stamm_Kassen', 'KASSE_SERIENNR')).toMatchObject({ type: 'alphanumeric', maxLength: 70 })
    expect(column('Stamm_Abschluss', 'Z_NR')).toMatchObject({ type: 'numeric', accuracy: 0 })
  })
})

describe('writing a table', () => {
  const key = { Z_KASSE_ID: 'K1', Z_ERSTELLUNG: '2026-10-13T22:00:00+02:00', Z_NR: 1 }

  it('writes a header, ; between columns, CRLF, decimal commas and quotes only where needed', () => {
    const csv = dsfinvkCsv(dsfinvkTable('Z_Zahlart'), [
      { ...key, ZAHLART_TYP: 'Bar', ZAHLART_NAME: 'Kasse; vorne', Z_ZAHLART_BETRAG: dsfinvkMoney(1250) },
      { ...key, ZAHLART_TYP: 'Unbar', ZAHLART_NAME: 'Visa "Debit"', Z_ZAHLART_BETRAG: 99.5 },
    ])
    expect(csv).toBe([
      'Z_KASSE_ID;Z_ERSTELLUNG;Z_NR;ZAHLART_TYP;ZAHLART_NAME;Z_ZAHLART_BETRAG',
      'K1;2026-10-13T22:00:00+02:00;1;Bar;"Kasse; vorne";12,50',
      'K1;2026-10-13T22:00:00+02:00;1;Unbar;"Visa ""Debit""";99,50',
      '',
    ].join('\r\n'))
  })

  it('formats money with its column’s decimals', () => {
    expect(dsfinvkMoney(-500)).toBe('-5,00')
    expect(dsfinvkMoney(119, 5)).toBe('1,19000')
    expect(dsfinvkMoney(0)).toBe('0,00')
    expect(dsfinvkText('plain')).toBe('plain')
  })

  it('names every problem with a row', () => {
    const problems = dsfinvkRowProblems(dsfinvkTable('Bonkopf'), {
      Z_KASSE_ID: 'K1',
      Z_ERSTELLUNG: 'yesterday',
      BON_ID: 'x'.repeat(41),
      BON_NR: 1.5,
      BON_TYP: 'Quittung',
      BON_STORNO: '0',
      BON_START: '2026-10-13T10:00:00',
      BON_ENDE: '2026-10-13T10:01:00',
      BEDIENER_ID: '7',
      UMS_BRUTTO: '1,00',
      NOT_A_COLUMN: 'x',
    })
    expect(problems.map(problem => problem.column).sort()).toEqual(['BON_ID', 'BON_NR', 'BON_TYP', 'NOT_A_COLUMN', 'Z_ERSTELLUNG', 'Z_NR'])
  })

  it('refuses a till serial with / or _, a closing without a tax number or VAT id, and a bad TSE time', () => {
    expect(dsfinvkRowProblems(dsfinvkTable('Stamm_Kassen'), { ...key, KASSE_SERIENNR: 'HQ_1/2', KASSE_BASISWAEH_CODE: 'EUR' }).map(p => p.column)).toEqual(['KASSE_SERIENNR'])
    const closing = { ...key, TAXONOMIE_VERSION: '2.4', Z_START_ID: '1', Z_ENDE_ID: '2', NAME: 'Gym', STRASSE: 'Weg 1', PLZ: '10115', ORT: 'Berlin', LAND: 'DEU', Z_SE_ZAHLUNGEN: '1,00', Z_SE_BARZAHLUNGEN: '0,00' }
    expect(dsfinvkRowProblems(dsfinvkTable('Stamm_Abschluss'), closing).map(p => p.column)).toEqual(['STNR'])
    expect(dsfinvkRowProblems(dsfinvkTable('Stamm_Abschluss'), { ...closing, USTID: 'DE123456789' })).toEqual([])
    expect(dsfinvkRowProblems(dsfinvkTable('TSE_Transaktionen'), { ...key, BON_ID: '1', TSE_ID: 1, TSE_TANR: 1, TSE_TA_START: '2026-10-13T10:00:00Z', TSE_TA_ENDE: '2026-10-13T10:00:01.000Z', TSE_TA_VORGANGSART: 'Kassenbeleg-V1', TSE_TA_SIGZ: 1, TSE_TA_SIG: 'c2ln' }).map(p => p.column)).toEqual(['TSE_TA_START'])
  })

  it('lets an unsigned TSE row through when it says why', () => {
    const row = { ...key, BON_ID: '1', TSE_ID: 1, TSE_TA_VORGANGSART: 'Kassenbeleg-V1', TSE_TA_FEHLER: 'TSE ausgefallen: fiskaly nicht erreichbar' }
    expect(dsfinvkRowProblems(dsfinvkTable('TSE_Transaktionen'), row)).toEqual([])
    expect(dsfinvkRowProblems(dsfinvkTable('TSE_Transaktionen'), { ...row, TSE_TA_FEHLER: '' }).map(p => p.column)).toEqual(['TSE_TANR', 'TSE_TA_START', 'TSE_TA_ENDE', 'TSE_TA_SIGZ', 'TSE_TA_SIG'])
  })

  it('throws a DsfinvkError naming the table, row and column', () => {
    expect(() => dsfinvkCsv(dsfinvkTable('Stamm_USt'), [{ ...key, UST_SCHLUESSEL: 1, UST_SATZ: 19 }])).toThrow(DsfinvkError)
    expect(() => dsfinvkCsv(dsfinvkTable('Stamm_USt'), [{ ...key, UST_SCHLUESSEL: 1, UST_SATZ: 19 }])).toThrow('Stamm_USt row 1, UST_BESCHR: must be filled')
  })
})

describe('index.xml', () => {
  it('names the DTD and describes every table the way the official file does', () => {
    const xml = dsfinvkIndexXml()
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\r\n<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">')).toBe(true)
    expect(xml.match(/<Table>/g)?.length).toBe(20)
    expect(xml.match(/<VariableColumn>/g)?.length).toBe(DSFINVK_TABLES.reduce((sum, table) => sum + table.columns.length, 0))
    expect(xml).toContain('<ColumnDelimiter>;</ColumnDelimiter>')
    expect(xml).toContain('<RecordDelimiter>&#xD;&#xA;</RecordDelimiter>')
    expect(xml).toContain('<DecimalSymbol>,</DecimalSymbol>')
    expect(xml).toContain('<Name>UMS_BRUTTO</Name>\r\n          <Description>Brutto-Gesamtumsatz</Description>\r\n          <Numeric>\r\n            <Accuracy>2</Accuracy>')
  })
})

describe('an export of a day at the till', () => {
  const closing = (): DsfinvkClosing => ({
    register: { id: 'hq-12-3', serialNumber: 'HQ-12-3-ab12', brand: 'HQ.training', model: 'Point of sale', softwareBrand: 'HQ.training', softwareVersion: '1.0', currency: 'EUR' },
    number: 4,
    createdAt: '2026-10-13T22:00:00+02:00',
    businessDate: '2026-10-13',
    company: { name: 'Studio Mitte GmbH', street: 'Torstraße 1', postalCode: '10119', city: 'Berlin', country: 'DEU', taxNumber: '30/123/45678', vatId: 'DE123456789' },
    location: { name: 'Studio Mitte', street: 'Torstraße 1', postalCode: '10119', city: 'Berlin', country: 'DEU' },
    terminals: [{ id: 'tmr_1', serialNumber: 'WPE-1', brand: 'Stripe', model: 'bbpos_wisepos_e' }],
    tses: [{ id: 1, serial: 'ab'.repeat(32), signatureAlgorithm: 'ecdsa-plain-SHA256', timeFormat: 'unixTime', publicKey: 'cHVibGlj', certificate: 'Q'.repeat(2400) }],
    transactions: [
      {
        id: '101',
        number: 101,
        start: '2026-10-13T09:00:00+02:00',
        end: '2026-10-13T09:00:05+02:00',
        operatorId: '7',
        operatorName: 'Front desk',
        customer: { name: 'Ada', id: '55', type: 'member' },
        lines: [
          { lineNumber: 1, text: 'Protein bar', articleNumber: 'BAR-1', quantity: 2, unitGrossCents: 250, grossCents: 500, vatKey: 2 },
          { lineNumber: 2, text: 'Day pass', articleNumber: '9', quantity: 1, unitGrossCents: 1500, grossCents: 1500, vatKey: 1 },
        ],
        payments: [{ type: 'Unbar', name: 'visa', cents: 2000 }],
        tse: { tseId: 1, transactionNumber: 17, start: 1760338800, end: 1760338805, processType: 'Kassenbeleg-V1', signatureCounter: 40, signature: 'c2ln', processData: 'Beleg^15.00_5.00_0.00_0.00_0.00^20.00:Unbar' },
      },
      {
        id: '102',
        number: 102,
        start: '2026-10-13T10:00:00+02:00',
        end: '2026-10-13T10:00:02+02:00',
        operatorId: '7',
        lines: [{ lineNumber: 1, text: 'Water', quantity: 1, unitGrossCents: 200, grossCents: 200, vatKey: 1 }],
        payments: [{ type: 'Bar', cents: 200 }],
        tse: { tseId: 1, transactionNumber: null, start: null, end: null, processType: 'Kassenbeleg-V1', signatureCounter: null, signature: null, error: 'TSE ausgefallen: fiskaly nicht erreichbar' },
      },
      {
        id: '103',
        number: 103,
        voided: true,
        start: '2026-10-13T11:00:00+02:00',
        end: '2026-10-13T11:00:01+02:00',
        operatorId: '7',
        lines: [{ lineNumber: 1, text: 'Protein bar', articleNumber: 'BAR-1', quantity: -2, unitGrossCents: 250, grossCents: -500, vatKey: 2 }],
        payments: [{ type: 'Unbar', name: 'visa', cents: -500 }],
        references: [{ type: 'Transaktion', date: '2026-10-13T09:00:05+02:00', registerId: 'hq-12-3', zNumber: 4, bonId: '101' }],
        tse: { tseId: 1, transactionNumber: 19, start: 1760346000, end: 1760346001, processType: 'Kassenbeleg-V1', signatureCounter: 42, signature: 'c2ln', processData: 'Beleg^0.00_-5.00_0.00_0.00_0.00^-5.00:Unbar' },
      },
    ],
  })

  const files = () => Object.fromEntries(dsfinvkExport([closing()]).map(file => [file.name, file.content]))
  const rowsOf = (csv: string) => csv.trimEnd().split('\r\n').slice(1).map(line => line.split(';'))

  it('writes all twenty files, index.xml and the DTD', () => {
    const names = Object.keys(files())
    expect(names).toHaveLength(22)
    expect(names).toContain('index.xml')
    expect(names).toContain(GDPDU_DTD_FILE)
    expect(files()[GDPDU_DTD_FILE]).toContain('<!ELEMENT DataSet')
  })

  it('sums the closing per business case, VAT key and payment type', () => {
    const out = files()
    expect(rowsOf(out['businesscases.csv']!)).toEqual([
      ['hq-12-3', '2026-10-13T22:00:00+02:00', '4', 'Umsatz', '', '0', '1', '17,00000', '14,29000', '2,71000'],
      ['hq-12-3', '2026-10-13T22:00:00+02:00', '4', 'Umsatz', '', '0', '2', '0,00000', '0,00000', '0,00000'],
    ])
    expect(rowsOf(out['payment.csv']!)).toEqual([
      ['hq-12-3', '2026-10-13T22:00:00+02:00', '4', 'Unbar', 'visa', '15,00'],
      ['hq-12-3', '2026-10-13T22:00:00+02:00', '4', 'Bar', '', '2,00'],
    ])
    expect(rowsOf(out['cash_per_currency.csv']!)).toEqual([['hq-12-3', '2026-10-13T22:00:00+02:00', '4', 'EUR', '2,00']])
    const head = rowsOf(out['cashpointclosing.csv']!)[0]!
    expect(head.slice(3)).toEqual(['2026-10-13', '2.4', '101', '103', 'Studio Mitte GmbH', 'Torstraße 1', '10119', 'Berlin', 'DEU', '30/123/45678', 'DE123456789', '17,00', '2,00'])
  })

  it('writes each receipt’s VAT as printed, its payments, the refund’s reference and the TSE rows', () => {
    const out = files()
    expect(rowsOf(out['transactions_vat.csv']!).filter(row => row[3] === '101').map(row => row.slice(4))).toEqual([
      ['1', '15,00000', '12,61000', '2,39000'],
      ['2', '5,00000', '4,67000', '0,33000'],
    ])
    expect(rowsOf(out['transactions.csv']!).map(row => [row[3], row[8], row[13]])).toEqual([['101', '0', '20,00'], ['102', '0', '2,00'], ['103', '1', '-5,00']])
    expect(rowsOf(out['references.csv']!)).toEqual([['hq-12-3', '2026-10-13T22:00:00+02:00', '4', '103', '', 'Transaktion', '', '2026-10-13T09:00:05+02:00', 'hq-12-3', '4', '101']])
    const tse = rowsOf(out['transactions_tse.csv']!)
    expect(tse[0]!.slice(4, 11)).toEqual(['1', '17', '2025-10-13T07:00:00.000Z', '2025-10-13T07:00:05.000Z', 'Kassenbeleg-V1', '40', 'c2ln'])
    expect(tse[1]!.slice(4)).toEqual(['1', '', '', '', 'Kassenbeleg-V1', '', '', 'TSE ausgefallen: fiskaly nicht erreichbar', ''])
    expect(rowsOf(out['lines.csv']!)[0]!.slice(3)).toEqual(['101', '1', '', 'Protein bar', '', 'Umsatz', '', '0', '0', '0', 'BAR-1', '', '', '', '2,000', '1,000', '', '2,50000'])
    expect(rowsOf(out['vat.csv']!).map(row => row.slice(3))).toEqual([['1', '19,00', 'Regelsteuersatz'], ['2', '7,00', 'Ermäßigter Steuersatz']])
  })

  it('splits a long TSE certificate over extra columns and declares them', () => {
    const out = files()
    expect(out['tse.csv']!.split('\r\n')[0]).toEndWith('TSE_ZERTIFIKAT_I;TSE_ZERTIFIKAT_II;TSE_ZERTIFIKAT_III')
    expect(rowsOf(out['tse.csv']!)[0]!.slice(-3).map(part => part.length)).toEqual([1000, 1000, 400])
    expect(out['index.xml']).toContain('<Name>TSE_ZERTIFIKAT_III</Name>')
  })

  it('refuses a receipt whose payments do not cover its lines', () => {
    const broken = closing()
    broken.transactions[0]!.payments = [{ type: 'Unbar', cents: 1900 }]
    expect(() => dsfinvkExport([broken])).toThrow(DsfinvkError)
  })

  it('refuses a line number used twice in one receipt', () => {
    const broken = closing()
    broken.transactions[0]!.lines[1]!.lineNumber = 1
    expect(() => dsfinvkExport([broken])).toThrow('appears twice')
  })
})
