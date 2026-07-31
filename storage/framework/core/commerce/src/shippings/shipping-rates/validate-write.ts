import { fetchById as fetchShippingMethodById } from '../shipping-methods/fetch'
import { fetchById as fetchShippingZoneById } from '../shipping-zones/fetch'

type ShippingRateWriteData = Record<string, unknown>

export class ShippingRateInputError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'ShippingRateInputError'
  }
}

function numericValue(
  input: ShippingRateWriteData,
  current: ShippingRateWriteData | undefined,
  key: string,
): number {
  return Number(input[key] ?? current?.[key])
}

export async function validateShippingRateWrite(
  input: ShippingRateWriteData,
  current?: ShippingRateWriteData,
): Promise<void> {
  const methodId = numericValue(input, current, 'shipping_method_id')
  const zoneId = numericValue(input, current, 'shipping_zone_id')
  const weightFrom = numericValue(input, current, 'weight_from')
  const weightTo = numericValue(input, current, 'weight_to')
  const rate = numericValue(input, current, 'rate')

  if (!Number.isSafeInteger(methodId) || methodId < 1)
    throw new ShippingRateInputError('Shipping method must be a positive integer.')
  if (!Number.isSafeInteger(zoneId) || zoneId < 1)
    throw new ShippingRateInputError('Shipping zone must be a positive integer.')
  if (!Number.isFinite(weightFrom) || weightFrom < 0)
    throw new ShippingRateInputError('Weight from must be a non-negative number.')
  if (!Number.isFinite(weightTo) || weightTo < weightFrom)
    throw new ShippingRateInputError('Weight to must be greater than or equal to weight from.')
  if (!Number.isSafeInteger(rate) || rate < 0)
    throw new ShippingRateInputError('Rate must be a non-negative integer in minor currency units.')

  const [method, zone] = await Promise.all([
    fetchShippingMethodById(methodId),
    fetchShippingZoneById(zoneId),
  ])
  if (!method)
    throw new ShippingRateInputError(`Shipping method ${methodId} was not found.`)
  if (!zone)
    throw new ShippingRateInputError(`Shipping zone ${zoneId} was not found.`)
  if (Number(zone.shipping_method_id) !== methodId) {
    throw new ShippingRateInputError(
      `Shipping zone ${zoneId} is not assigned to shipping method ${methodId}.`,
    )
  }
}
