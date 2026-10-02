/**
 * Money at the import boundary.
 *
 * Sources hand prices over in two shapes. Shopify sends decimal strings in the
 * shop's currency (`"19.99"`); the WooCommerce Store API sends an integer
 * string already in minor units, plus how many decimals the STORE is
 * configured with (`currency_minor_unit`), which is not always the ISO number.
 *
 * Both are converted by the commerce-wide money module (`../money`), which the
 * dashboard and the order export use as well, so an imported `1999` and a
 * dashboard-entered `19.99` land as the same integer and read back the same
 * way (stacksjs/stacks#2851). This file only keeps the importer's import path.
 */

export {
  currencyExponent,
  decimalToMinor,
  formatMinor,
  minorToDecimal,
  PriceFormatError,
  rescaleMinor,
} from '../money'
