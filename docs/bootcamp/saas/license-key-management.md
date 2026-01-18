# License Key Management

The License Key Management module provides comprehensive software licensing capabilities for selling and managing software licenses. This guide covers key generation, validation, activation management, and license types.

## Getting Started

Import the license key functionality:

```ts
import { shippings } from '@stacksjs/commerce'
```

## License Key Types

### Available License Types

```ts
// config/licenses.ts
export default {
  types: {
    perpetual: {
      name: 'Perpetual License',
      description: 'One-time purchase, lifetime access',
      has_expiry: false,
    },
    subscription: {
      name: 'Subscription License',
      description: 'Recurring billing with time-limited access',
      has_expiry: true,
    },
    trial: {
      name: 'Trial License',
      description: 'Limited-time evaluation license',
      has_expiry: true,
      default_duration_days: 14,
    },
  },
}
```

## Creating License Keys

### Generate a Single License Key

```ts
import { randomUUIDv7 } from 'bun'

function generateLicenseKey(): string {
  // Generate a formatted license key: XXXX-XXXX-XXXX-XXXX
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const segments = 4
  const segmentLength = 4

  const segments_arr = []
  for (let i = 0; i < segments; i++) {
    let segment = ''
    for (let j = 0; j < segmentLength; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    segments_arr.push(segment)
  }

  return segments_arr.join('-')
}

// Store the license key
const licenseKey = await shippings.licenses.store({
  product_id: 1,
  key: generateLicenseKey(),
  activation_limit: 3,
  expiry_date: '2025-12-31',
  status: 'active',
  type: 'perpetual',
  features: JSON.stringify(['feature1', 'feature2']),
})
```

### Bulk Generate License Keys

```ts
async function generateBulkLicenseKeys(
  productId: number,
  quantity: number,
  options: {
    type: string
    activation_limit: number
    expiry_date?: string
    features?: string[]
  }
) {
  const licenses = []

  for (let i = 0; i < quantity; i++) {
    licenses.push({
      product_id: productId,
      key: generateLicenseKey(),
      activation_limit: options.activation_limit,
      expiry_date: options.expiry_date,
      status: 'inactive', // Not activated until purchased
      type: options.type,
      features: JSON.stringify(options.features || []),
    })
  }

  await shippings.licenses.bulkStore(licenses)

  return licenses
}

// Generate 100 license keys
const newLicenses = await generateBulkLicenseKeys(1, 100, {
  type: 'perpetual',
  activation_limit: 3,
  features: ['pro', 'support'],
})
```

## License Validation

### Validate a License Key

```ts
async function validateLicenseKey(
  key: string,
  productId: number
): Promise<{
  valid: boolean
  message: string
  license?: LicenseKeyModel
}> {
  const license = await shippings.licenses.fetchByKey(key)

  if (!license) {
    return { valid: false, message: 'Invalid license key' }
  }

  if (license.product_id !== productId) {
    return { valid: false, message: 'License key is not valid for this product' }
  }

  if (license.status !== 'active') {
    return { valid: false, message: `License is ${license.status}` }
  }

  if (license.expiry_date) {
    const expiryDate = new Date(license.expiry_date)
    if (expiryDate < new Date()) {
      return { valid: false, message: 'License has expired' }
    }
  }

  if (license.activation_count >= license.activation_limit) {
    return { valid: false, message: 'Activation limit reached' }
  }

  return { valid: true, message: 'License is valid', license }
}
```

### Online Validation Endpoint

```ts
// routes/api.ts
router.post('/api/licenses/validate', async (request) => {
  const { key, product_id, machine_id } = await request.json()

  const validation = await validateLicenseKey(key, product_id)

  if (!validation.valid) {
    return Response.json({
      valid: false,
      message: validation.message,
    }, { status: 400 })
  }

  // Check if already activated on this machine
  const existingActivation = await LicenseActivation
    .where('license_key_id', '=', validation.license!.id)
    .where('machine_id', '=', machine_id)
    .first()

  return Response.json({
    valid: true,
    already_activated: !!existingActivation,
    features: JSON.parse(validation.license!.features || '[]'),
    expiry_date: validation.license!.expiry_date,
  })
})
```

## License Activation

### Activating a License

```ts
async function activateLicense(
  key: string,
  machineId: string,
  machineInfo: {
    hostname?: string
    os?: string
    ip_address?: string
  }
): Promise<{ success: boolean, message: string, activation?: any }> {
  const validation = await validateLicenseKey(key, productId)

  if (!validation.valid) {
    return { success: false, message: validation.message }
  }

  const license = validation.license!

  // Check if already activated on this machine
  const existingActivation = await LicenseActivation
    .where('license_key_id', '=', license.id)
    .where('machine_id', '=', machineId)
    .first()

  if (existingActivation) {
    // Update last used timestamp
    await existingActivation.update({
      last_used_at: new Date().toISOString(),
    })

    return {
      success: true,
      message: 'License already activated on this machine',
      activation: existingActivation,
    }
  }

  // Create new activation
  const activation = await LicenseActivation.create({
    license_key_id: license.id,
    machine_id: machineId,
    hostname: machineInfo.hostname,
    os: machineInfo.os,
    ip_address: machineInfo.ip_address,
    activated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  })

  // Increment activation count
  await license.update({
    activation_count: license.activation_count + 1,
  })

  return {
    success: true,
    message: 'License activated successfully',
    activation,
  }
}
```

### Deactivating a License

```ts
async function deactivateLicense(
  key: string,
  machineId: string
): Promise<{ success: boolean, message: string }> {
  const license = await shippings.licenses.fetchByKey(key)

  if (!license) {
    return { success: false, message: 'Invalid license key' }
  }

  const activation = await LicenseActivation
    .where('license_key_id', '=', license.id)
    .where('machine_id', '=', machineId)
    .first()

  if (!activation) {
    return { success: false, message: 'License not activated on this machine' }
  }

  await activation.delete()

  // Decrement activation count
  await license.update({
    activation_count: Math.max(0, license.activation_count - 1),
  })

  return { success: true, message: 'License deactivated successfully' }
}
```

### List Active Activations

```ts
async function getActiveActivations(key: string) {
  const license = await shippings.licenses.fetchByKey(key)

  if (!license) return []

  const activations = await LicenseActivation
    .where('license_key_id', '=', license.id)
    .get()

  return activations.map(a => ({
    machine_id: a.machine_id,
    hostname: a.hostname,
    os: a.os,
    activated_at: a.activated_at,
    last_used_at: a.last_used_at,
  }))
}
```

## License Management

### Update License Status

```ts
// Suspend a license
await shippings.licenses.updateStatus(licenseId, 'suspended')

// Revoke a license
await shippings.licenses.updateStatus(licenseId, 'revoked')

// Reactivate a license
await shippings.licenses.updateStatus(licenseId, 'active')
```

### Update License Expiration

```ts
// Extend license by 1 year
const newExpiry = new Date()
newExpiry.setFullYear(newExpiry.getFullYear() + 1)

await shippings.licenses.updateExpiration(
  licenseId,
  newExpiry.toISOString().split('T')[0]
)
```

### Upgrade License Features

```ts
async function upgradeLicenseFeatures(
  licenseId: number,
  newFeatures: string[]
) {
  const license = await shippings.licenses.fetchById(licenseId)

  if (!license) throw new Error('License not found')

  const currentFeatures = JSON.parse(license.features || '[]')
  const mergedFeatures = [...new Set([...currentFeatures, ...newFeatures])]

  await license.update({
    features: JSON.stringify(mergedFeatures),
  })
}
```

## API Endpoints

```
POST   /api/licenses/validate        # Validate a license key
POST   /api/licenses/activate        # Activate a license
POST   /api/licenses/deactivate      # Deactivate a license
GET    /api/licenses/{key}/activations # List activations
GET    /api/licenses/{key}           # Get license details
PATCH  /api/licenses/{id}            # Update license
DELETE /api/licenses/{id}            # Delete license
POST   /api/licenses/bulk            # Generate bulk licenses
```

### Example API Usage

```ts
// Validate license from your application
const response = await fetch('https://api.yourapp.com/api/licenses/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    key: 'XXXX-YYYY-ZZZZ-WWWW',
    product_id: 1,
    machine_id: getMachineId(),
  }),
})

const result = await response.json()

if (result.valid) {
  // License is valid, proceed with app
  enableFeatures(result.features)
} else {
  // Show error message
  showLicenseError(result.message)
}
```

### Client-Side Integration

```ts
// license-manager.ts
class LicenseManager {
  private apiUrl: string
  private productId: number

  constructor(apiUrl: string, productId: number) {
    this.apiUrl = apiUrl
    this.productId = productId
  }

  async validate(key: string): Promise<LicenseValidationResult> {
    const response = await fetch(`${this.apiUrl}/api/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        product_id: this.productId,
        machine_id: this.getMachineId(),
      }),
    })

    return response.json()
  }

  async activate(key: string): Promise<ActivationResult> {
    const response = await fetch(`${this.apiUrl}/api/licenses/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        product_id: this.productId,
        machine_id: this.getMachineId(),
        machine_info: this.getMachineInfo(),
      }),
    })

    return response.json()
  }

  async deactivate(key: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiUrl}/api/licenses/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        machine_id: this.getMachineId(),
      }),
    })

    return response.json()
  }

  private getMachineId(): string {
    // Generate unique machine identifier
    // This varies by platform (electron, browser, etc.)
    return crypto.randomUUID()
  }

  private getMachineInfo(): MachineInfo {
    return {
      hostname: os.hostname?.() || 'unknown',
      os: os.platform?.() || navigator.platform,
    }
  }
}
```

## Offline License Validation

For applications that need offline validation:

```ts
import { createSign, createVerify } from 'crypto'

// Generate a signed license file
async function generateOfflineLicense(license: LicenseKeyModel): Promise<string> {
  const privateKey = process.env.LICENSE_PRIVATE_KEY!

  const licenseData = {
    key: license.key,
    product_id: license.product_id,
    features: JSON.parse(license.features || '[]'),
    expiry_date: license.expiry_date,
    activation_limit: license.activation_limit,
    issued_at: new Date().toISOString(),
  }

  const sign = createSign('RSA-SHA256')
  sign.update(JSON.stringify(licenseData))
  const signature = sign.sign(privateKey, 'base64')

  return Buffer.from(JSON.stringify({
    data: licenseData,
    signature,
  })).toString('base64')
}

// Verify an offline license
function verifyOfflineLicense(encodedLicense: string): {
  valid: boolean
  data?: any
  message?: string
} {
  const publicKey = process.env.LICENSE_PUBLIC_KEY!

  try {
    const decoded = JSON.parse(Buffer.from(encodedLicense, 'base64').toString())
    const { data, signature } = decoded

    const verify = createVerify('RSA-SHA256')
    verify.update(JSON.stringify(data))

    if (!verify.verify(publicKey, signature, 'base64')) {
      return { valid: false, message: 'Invalid signature' }
    }

    // Check expiry
    if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
      return { valid: false, message: 'License expired' }
    }

    return { valid: true, data }
  } catch (error) {
    return { valid: false, message: 'Invalid license format' }
  }
}
```

## Error Handling

```ts
try {
  const result = await activateLicense(key, machineId, machineInfo)

  if (!result.success) {
    switch (result.message) {
      case 'Invalid license key':
        // Show invalid key error
        break
      case 'Activation limit reached':
        // Prompt to deactivate another machine
        break
      case 'License has expired':
        // Prompt to renew
        break
      default:
        // Generic error
    }
  }
} catch (error) {
  console.error('License activation failed:', error)
}
```

## Response Format

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "key": "XXXX-YYYY-ZZZZ-WWWW",
  "activation_limit": 3,
  "activation_count": 1,
  "expiry_date": "2025-12-31T00:00:00.000Z",
  "type": "perpetual",
  "features": ["pro", "support"],
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

This documentation covers the essential license key management functionality for software licensing. Each function is type-safe and designed for seamless integration with your digital product sales.
