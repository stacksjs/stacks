import {
  commerceEmail,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalString,
  commerceRequiredString,
  commerceValue,
} from './commerce-record'

/**
 * The products and customers a commerce dialog offers, as the dialog shows
 * them (stacksjs/stacks#3218). Kept apart from the search in
 * commerce-choices.ts, which reads the database: the waitlist records modules
 * re-export these, and dashboard components import values from those modules,
 * so anything here ends up in a browser bundle.
 */
export interface ProductChoice {
  id: string
  label: string
  detail: string
}

export interface CustomerChoice extends ProductChoice {
  email: string
  phone: string
}

export function normalizeProductChoice(record: any): ProductChoice {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Product')
  const source = `Product ${id}`
  const inventory = commerceNumber(
    commerceValue(record, 'inventory_count', 'inventoryCount'),
    source,
    'inventory_count',
    { min: 0, integer: true },
  )
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: `${inventory} in inventory`,
  }
}

export function normalizeCustomerChoice(record: any): CustomerChoice {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  const email = commerceEmail(commerceValue(record, 'email'), source)
  const phone = commerceOptionalString(commerceValue(record, 'phone'), source, 'phone')
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: email || phone,
    email,
    phone,
  }
}
