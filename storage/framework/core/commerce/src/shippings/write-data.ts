type ShippingWriteInput = Record<string, unknown>

type ShippingColumnAliases = Readonly<Record<string, readonly string[]>>

function normalizedColumns(
  input: ShippingWriteInput,
  aliases: ShippingColumnAliases,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [column, candidates] of Object.entries(aliases)) {
    for (const candidate of candidates) {
      if (!Object.prototype.hasOwnProperty.call(input, candidate) || input[candidate] === undefined)
        continue
      result[column] = input[candidate]
      break
    }
  }
  return result
}

export function shippingMethodWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    name: ['name'],
    description: ['description'],
    base_rate: ['base_rate', 'baseRate'],
    free_shipping: ['free_shipping', 'freeShipping'],
    status: ['status'],
  })
}

export function shippingRateWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    weight_from: ['weight_from', 'weightFrom'],
    weight_to: ['weight_to', 'weightTo'],
    rate: ['rate'],
    shipping_method_id: ['shipping_method_id', 'shippingMethodId', 'shippingmethod_id'],
    shipping_zone_id: ['shipping_zone_id', 'shippingZoneId', 'shippingzone_id'],
  })
}

export function shippingZoneWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    name: ['name'],
    countries: ['countries'],
    regions: ['regions'],
    postal_codes: ['postal_codes', 'postalCodes'],
    status: ['status'],
    shipping_method_id: ['shipping_method_id', 'shippingMethodId', 'shippingmethod_id'],
  })
}

export function digitalDeliveryWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    name: ['name'],
    description: ['description'],
    download_limit: ['download_limit', 'downloadLimit'],
    expiry_days: ['expiry_days', 'expiryDays'],
    requires_login: ['requires_login', 'requiresLogin'],
    automatic_delivery: ['automatic_delivery', 'automaticDelivery'],
    status: ['status'],
  })
}

export function licenseKeyWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    key: ['key'],
    template: ['template'],
    expiry_date: ['expiry_date', 'expiryDate'],
    status: ['status'],
    customer_id: ['customer_id', 'customerId'],
    product_id: ['product_id', 'productId'],
    order_id: ['order_id', 'orderId'],
  })
}

export function driverWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    name: ['name'],
    phone: ['phone'],
    vehicle_number: ['vehicle_number', 'vehicleNumber'],
    license: ['license'],
    status: ['status'],
    user_id: ['user_id', 'userId'],
  })
}

export function deliveryRouteWriteData(input: ShippingWriteInput): Record<string, unknown> {
  return normalizedColumns(input, {
    driver: ['driver'],
    vehicle: ['vehicle'],
    stops: ['stops'],
    delivery_time: ['delivery_time', 'deliveryTime'],
    total_distance: ['total_distance', 'totalDistance'],
    last_active: ['last_active', 'lastActive'],
  })
}
