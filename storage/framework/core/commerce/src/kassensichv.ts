/**
 * What a German till signs and prints (KassenSichV, DSFinV-K 2.4 Anhang I):
 * the VAT keys, the `processData` a receipt's TSE transaction carries, the
 * receipt's QR code, and the amounts a cloud TSE such as fiskaly is sent.
 * Pure and dependency-free (`@stacksjs/commerce/kassensichv`), so a till in
 * the browser can draw the same receipt the server signed.
 *
 * Amounts are integers in cents (euro cents for a euro till). VAT is
 * included in gross prices, as German consumer prices are.
 */

/**
 * DSFinV-K's VAT keys (UST_SCHLUESSEL, Anlage 2, Stand 05.12.2024) that a
 * till selling goods and services uses: the general and reduced rates, and
 * the three kinds of 0%. `bucket` is the key's place among the five VAT
 * amounts of `processData` (general, reduced, § 24 Nr. 3, § 24 Nr. 1, 0%).
 */
export const DE_VAT_KEYS = {
  1: { rate: 19, bucket: 0, fiskaly: 'NORMAL', description: 'Regelsteuersatz' },
  2: { rate: 7, bucket: 1, fiskaly: 'REDUCED_1', description: 'Ermäßigter Steuersatz' },
  5: { rate: 0, bucket: 4, fiskaly: 'NULL', description: 'Nicht Steuerbar' },
  6: { rate: 0, bucket: 4, fiskaly: 'NULL', description: 'Umsatzsteuerfrei' },
  7: { rate: 0, bucket: 4, fiskaly: 'NULL', description: 'UmsatzsteuerNichtErmittelbar' },
} as const

export type DeVatKey = keyof typeof DE_VAT_KEYS

export function isDeVatKey(value: unknown): value is DeVatKey {
  return typeof value === 'number' && Object.prototype.hasOwnProperty.call(DE_VAT_KEYS, value)
}

/** The VAT inside a gross amount at a rate (percent), rounded half away from zero, and the net rest. */
export function splitGross(grossCents: number, ratePercent: number): { net: number, vat: number } {
  if (!Number.isSafeInteger(grossCents)) throw new Error('A gross amount must be whole cents')
  if (!ratePercent) return { net: grossCents, vat: 0 }
  const exact = Math.abs(grossCents) * ratePercent / (100 + ratePercent)
  const vat = Math.sign(grossCents) * Math.round(exact)
  return { net: grossCents - vat, vat }
}

/**
 * An amount as the TSE and the QR code write it: "." as the decimal point,
 * exactly two decimals, a "-" only when negative, no grouping.
 */
export function tseAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('An amount must be whole cents')
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** How a payment counts for the TSE: cash, or anything else. */
export type TsePaymentKind = 'Bar' | 'Unbar'

export interface TseVatAmount { key: DeVatKey, grossCents: number }
export interface TsePayment { kind: TsePaymentKind, cents: number, /** ISO 4217; EUR when left out. */ currency?: string }

export type BonTyp = 'Beleg' | 'AVTransfer' | 'AVBestellung' | 'AVTraining' | 'AVBelegstorno' | 'AVBelegabbruch' | 'AVSachbezug' | 'AVRechnung' | 'AVSonstige'

/**
 * The `processData` of a `Kassenbeleg-V1` transaction: the receipt type, the
 * five gross VAT amounts and the payments, as
 * `Beleg^75.33_7.99_0.00_0.00_0.00^10.00:Bar_5.00:Bar:CHF_64.30:Unbar`.
 * Payments of one kind and currency are added up; zero ones are left out;
 * cash comes first, euros before other currencies (alphabetical).
 */
export function processData(input: { bonTyp?: BonTyp, vat: readonly TseVatAmount[], payments: readonly TsePayment[] }): string {
  const buckets = [0, 0, 0, 0, 0]
  for (const amount of input.vat) {
    if (!isDeVatKey(amount.key)) throw new Error(`Unknown VAT key ${String(amount.key)}`)
    buckets[DE_VAT_KEYS[amount.key].bucket]! += amount.grossCents
  }
  const sums = new Map<string, { kind: TsePaymentKind, currency: string, cents: number }>()
  for (const payment of input.payments) {
    const currency = (payment.currency || 'EUR').toUpperCase()
    const key = `${payment.kind}:${currency}`
    const entry = sums.get(key) ?? { kind: payment.kind, currency, cents: 0 }
    entry.cents += payment.cents
    sums.set(key, entry)
  }
  const order = (entry: { kind: TsePaymentKind, currency: string }) => `${entry.kind === 'Bar' ? 0 : 1}:${entry.currency === 'EUR' ? '' : entry.currency}`
  const payments = [...sums.values()]
    .filter(entry => entry.cents !== 0)
    .sort((a, b) => order(a).localeCompare(order(b)))
    .map(entry => `${tseAmount(entry.cents)}:${entry.kind}${entry.currency === 'EUR' ? '' : `:${entry.currency}`}`)
  return `${input.bonTyp ?? 'Beleg'}^${buckets.map(tseAmount).join('_')}^${payments.join('_')}`
}

/** fiskaly's receipt schema (`schema.standard_v1.receipt`) for the same amounts. */
export function fiskalyReceiptFor(input: { vat: readonly TseVatAmount[], payments: readonly TsePayment[], receiptType?: 'RECEIPT' | 'TRAINING' | 'TRANSFER' | 'ORDER' | 'CANCELLATION' | 'ABORT' | 'BENEFIT_IN_KIND' | 'INVOICE' | 'OTHER' }) {
  const byRate = new Map<string, number>()
  for (const amount of input.vat) {
    if (!isDeVatKey(amount.key)) throw new Error(`Unknown VAT key ${String(amount.key)}`)
    const rate = DE_VAT_KEYS[amount.key].fiskaly
    byRate.set(rate, (byRate.get(rate) ?? 0) + amount.grossCents)
  }
  const byPayment = new Map<string, { payment_type: 'CASH' | 'NON_CASH', currency: string, cents: number }>()
  for (const payment of input.payments) {
    const type = payment.kind === 'Bar' ? 'CASH' : 'NON_CASH'
    const currency = (payment.currency || 'EUR').toUpperCase()
    const entry = byPayment.get(`${type}:${currency}`) ?? { payment_type: type, currency, cents: 0 }
    entry.cents += payment.cents
    byPayment.set(`${type}:${currency}`, entry)
  }
  return {
    receipt_type: input.receiptType ?? 'RECEIPT',
    amounts_per_vat_rate: [...byRate.entries()].filter(([, cents]) => cents !== 0).map(([vat_rate, cents]) => ({ vat_rate, amount: tseAmount(cents) })),
    amounts_per_payment_type: [...byPayment.values()].filter(entry => entry.cents !== 0).map(entry => ({
      payment_type: entry.payment_type,
      amount: tseAmount(entry.cents),
      ...(entry.currency === 'EUR' ? {} : { currency_code: entry.currency }),
    })),
  } as const
}

/** A TSE time as receipts and the export write it: `YYYY-MM-DDThh:mm:ss.fffZ` (UTC). Takes unix seconds, an ISO string or a Date. */
export function tseTime(value: number | string | Date): string {
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Not a time')
  return date.toISOString()
}

export interface ReceiptQrInput {
  /** The till's serial number as registered with the TSE (the client's serial). */
  clientSerialNumber: string
  processType: 'Kassenbeleg-V1' | 'Bestellung-V1' | 'SonstigerVorgang'
  processData: string
  transactionNumber: number
  signatureCounter: number
  start: number | string | Date
  end: number | string | Date
  /** 'ecdsa-plain-SHA384' and the like. */
  signatureAlgorithm: string
  /** 'unixTime', 'utcTime'… as the TSE reports it. */
  logTimeFormat: string
  /** Base64, exactly as the TSE returned it. */
  signature: string
  publicKey: string
}

/** The receipt's QR code content (DSFinV-K Anhang I): twelve fields joined by ";", starting with "V0". */
export function receiptQrCode(input: ReceiptQrInput): string {
  return [
    'V0',
    input.clientSerialNumber,
    input.processType,
    input.processData,
    String(input.transactionNumber),
    String(input.signatureCounter),
    tseTime(input.start),
    tseTime(input.end),
    input.signatureAlgorithm,
    input.logTimeFormat,
    input.signature,
    input.publicKey,
  ].join(';')
}

/** The parts of a receipt QR code, or null when it is not one. */
export function parseReceiptQrCode(value: string): ReceiptQrInput | null {
  const parts = value.split(';')
  if (parts.length !== 12 || parts[0] !== 'V0') return null
  const number = Number(parts[4])
  const counter = Number(parts[5])
  if (!Number.isSafeInteger(number) || !Number.isSafeInteger(counter)) return null
  return {
    clientSerialNumber: parts[1]!,
    processType: parts[2] as ReceiptQrInput['processType'],
    processData: parts[3]!,
    transactionNumber: number,
    signatureCounter: counter,
    start: parts[6]!,
    end: parts[7]!,
    signatureAlgorithm: parts[8]!,
    logTimeFormat: parts[9]!,
    signature: parts[10]!,
    publicKey: parts[11]!,
  }
}

/** The VAT lines a receipt prints: per key, the gross, net and VAT, and the rate. */
export function receiptVatLines(vat: readonly TseVatAmount[]): Array<{ key: DeVatKey, rate: number, description: string, grossCents: number, netCents: number, vatCents: number }> {
  const byKey = new Map<DeVatKey, number>()
  for (const amount of vat) byKey.set(amount.key, (byKey.get(amount.key) ?? 0) + amount.grossCents)
  return [...byKey.entries()].sort(([a], [b]) => a - b).map(([key, grossCents]) => {
    const info = DE_VAT_KEYS[key]
    const split = splitGross(grossCents, info.rate)
    return { key, rate: info.rate, description: info.description, grossCents, netCents: split.net, vatCents: split.vat }
  })
}

/** What a receipt must say when the TSE failed (AEAO zu § 146a, Nr. 1.14.2): the failure, unmistakably. */
export const TSE_FAILURE_NOTICE = 'TSE ausgefallen'
