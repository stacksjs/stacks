import { describe, expect, it } from 'bun:test'
import {
  fiskalyReceiptFor,
  parseReceiptQrCode,
  processData,
  receiptQrCode,
  receiptVatLines,
  splitGross,
  tseAmount,
  tseTime,
} from '../kassensichv'

describe('amounts as the TSE writes them', () => {
  it('uses a point, two decimals, a minus only when negative and no grouping', () => {
    expect(tseAmount(0)).toBe('0.00')
    expect(tseAmount(5)).toBe('0.05')
    expect(tseAmount(7533)).toBe('75.33')
    expect(tseAmount(-500)).toBe('-5.00')
    expect(tseAmount(123456789)).toBe('1234567.89')
    expect(() => tseAmount(1.5)).toThrow()
  })

  it('splits the VAT out of a gross amount', () => {
    expect(splitGross(1190, 19)).toEqual({ net: 1000, vat: 190 })
    expect(splitGross(107, 7)).toEqual({ net: 100, vat: 7 })
    expect(splitGross(-1190, 19)).toEqual({ net: -1000, vat: -190 })
    expect(splitGross(500, 0)).toEqual({ net: 500, vat: 0 })
    // 2.50 at 19%: 0.399… rounds to 0.40.
    expect(splitGross(250, 19)).toEqual({ net: 210, vat: 40 })
  })
})

describe('processData (DSFinV-K Anhang I)', () => {
  it('matches the specification’s examples', () => {
    expect(processData({ vat: [{ key: 1, grossCents: 10000 }], payments: [{ kind: 'Bar', cents: 10000 }] }))
      .toBe('Beleg^100.00_0.00_0.00_0.00_0.00^100.00:Bar')
    expect(processData({
      vat: [{ key: 1, grossCents: 7533 }, { key: 2, grossCents: 799 }],
      payments: [{ kind: 'Unbar', cents: 6430 }, { kind: 'Bar', cents: 500, currency: 'USD' }, { kind: 'Bar', cents: 1000 }, { kind: 'Bar', cents: 500, currency: 'CHF' }],
    })).toBe('Beleg^75.33_7.99_0.00_0.00_0.00^10.00:Bar_5.00:Bar:CHF_5.00:Bar:USD_64.30:Unbar')
  })

  it('adds up payments of one kind, leaves out zero ones and books 0% keys in the fifth bucket', () => {
    expect(processData({
      vat: [{ key: 6, grossCents: 2000 }, { key: 1, grossCents: 300 }, { key: 1, grossCents: 200 }],
      payments: [{ kind: 'Unbar', cents: 1500 }, { kind: 'Unbar', cents: 1000 }, { kind: 'Bar', cents: 0 }],
    })).toBe('Beleg^5.00_0.00_0.00_0.00_20.00^25.00:Unbar')
  })

  it('writes a refund with negative amounts, and nothing after the last ^ without payments', () => {
    expect(processData({ vat: [{ key: 2, grossCents: -350 }], payments: [{ kind: 'Bar', cents: -350 }] }))
      .toBe('Beleg^0.00_-3.50_0.00_0.00_0.00^-3.50:Bar')
    expect(processData({ bonTyp: 'AVBelegabbruch', vat: [], payments: [] })).toBe('AVBelegabbruch^0.00_0.00_0.00_0.00_0.00^')
  })

  it('refuses a VAT key it does not know', () => {
    expect(() => processData({ vat: [{ key: 9 as any, grossCents: 100 }], payments: [] })).toThrow()
  })
})

describe('the receipt QR code', () => {
  const official = {
    clientSerialNumber: 'AMA-2642',
    processType: 'Kassenbeleg-V1' as const,
    processData: 'Beleg^4.05_3.00_0.00_0.00_0.00^7.05:Bar',
    transactionNumber: 13,
    signatureCounter: 44131,
    start: '2019-11-22T11:29:48.000Z',
    end: 1574422189,
    signatureAlgorithm: 'ecdsa-plain-SHA384',
    logTimeFormat: 'unixTime',
    signature: 'c2lnbmF0dXJl',
    publicKey: 'cHVibGljLWtleQ==',
  }

  it('is the twelve fields of the specification’s example, joined by ;', () => {
    expect(receiptQrCode(official)).toBe('V0;AMA-2642;Kassenbeleg-V1;Beleg^4.05_3.00_0.00_0.00_0.00^7.05:Bar;13;44131;2019-11-22T11:29:48.000Z;2019-11-22T11:29:49.000Z;ecdsa-plain-SHA384;unixTime;c2lnbmF0dXJl;cHVibGljLWtleQ==')
  })

  it('reads back what it wrote, and nothing else', () => {
    const parsed = parseReceiptQrCode(receiptQrCode(official))
    expect(parsed?.transactionNumber).toBe(13)
    expect(parsed?.signatureCounter).toBe(44131)
    expect(parsed?.processData).toBe(official.processData)
    expect(parseReceiptQrCode('V1;a;b')).toBeNull()
  })

  it('writes TSE times as YYYY-MM-DDThh:mm:ss.fffZ', () => {
    expect(tseTime(0)).toBe('1970-01-01T00:00:00.000Z')
    expect(tseTime('2026-10-13T10:00:00+02:00')).toBe('2026-10-13T08:00:00.000Z')
    expect(() => tseTime('nope')).toThrow()
  })
})

describe('what fiskaly is sent', () => {
  it('groups amounts per fiskaly VAT rate and per payment type', () => {
    expect(fiskalyReceiptFor({
      vat: [{ key: 1, grossCents: 1190 }, { key: 2, grossCents: 107 }, { key: 1, grossCents: 100 }, { key: 6, grossCents: 0 }],
      payments: [{ kind: 'Unbar', cents: 1000 }, { kind: 'Bar', cents: 397 }],
    })).toEqual({
      receipt_type: 'RECEIPT',
      amounts_per_vat_rate: [{ vat_rate: 'NORMAL', amount: '12.90' }, { vat_rate: 'REDUCED_1', amount: '1.07' }],
      amounts_per_payment_type: [{ payment_type: 'NON_CASH', amount: '10.00' }, { payment_type: 'CASH', amount: '3.97' }],
    })
  })

  it('names a currency other than euros', () => {
    expect(fiskalyReceiptFor({ vat: [{ key: 1, grossCents: 500 }], payments: [{ kind: 'Bar', cents: 500, currency: 'chf' }] }).amounts_per_payment_type)
      .toEqual([{ payment_type: 'CASH', amount: '5.00', currency_code: 'CHF' }])
  })
})

describe('receipt VAT lines', () => {
  it('prints gross, net and VAT per key, in key order', () => {
    expect(receiptVatLines([{ key: 2, grossCents: 107 }, { key: 1, grossCents: 1190 }, { key: 1, grossCents: 1190 }])).toEqual([
      { key: 1, rate: 19, description: 'Regelsteuersatz', grossCents: 2380, netCents: 2000, vatCents: 380 },
      { key: 2, rate: 7, description: 'Ermäßigter Steuersatz', grossCents: 107, netCents: 100, vatCents: 7 },
    ])
  })
})
