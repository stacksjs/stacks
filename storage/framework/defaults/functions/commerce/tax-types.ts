/**
 * Tax types as a reader meets them in the dashboard.
 *
 * A tax rate's `type` is free text the store owner chooses, and the common
 * ones are acronyms: "GST" and "VAT" mean nothing to someone who has never
 * run a shop in a country that charges them. A known type reads with its
 * meaning beside it; anything else reads exactly as written.
 */
const MEANINGS: Record<string, string> = {
  GST: 'goods and services tax',
  HST: 'harmonized sales tax',
  PST: 'provincial sales tax',
  QST: 'Quebec sales tax',
  VAT: 'value-added tax',
}

/** `GST` reads as "GST (goods and services tax)"; an unknown type is unchanged. */
export function taxTypeLabel(type: string): string {
  const meaning = MEANINGS[type.trim().toUpperCase()]
  return meaning ? `${type} (${meaning})` : type
}
