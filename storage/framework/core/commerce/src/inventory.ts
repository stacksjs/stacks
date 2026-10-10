import { InputValidationError, parseNumberInput } from '@stacksjs/validation/input'

/** Add delivered whole units without converting untracked stock into counted stock. */
export function restockedQuantity(stock: unknown, units: unknown, maximum = 2_147_483_647): number {
  const current = parseNumberInput(stock, 'Inventory', 0, maximum, true)
  const incoming = parseNumberInput(units, 'Restock', 1, maximum, true)
  if (current === null) throw new InputValidationError('Set inventory before restocking an untracked product')
  if (incoming === null) throw new InputValidationError('Restock is required')
  const quantity = current + incoming
  if (!Number.isSafeInteger(quantity) || quantity > maximum) throw new InputValidationError(`Restocked inventory must not exceed ${maximum} units`)
  return quantity
}
