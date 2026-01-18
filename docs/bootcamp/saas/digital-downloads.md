# Digital Downloads

The Digital Downloads module provides functionality for selling and securely delivering digital products such as software, ebooks, media files, and other downloadable content. This guide covers product setup, secure delivery, and download management.

## Getting Started

Import the digital delivery functionality:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Creating Digital Products

### Store a Digital Product

```ts
const digitalProduct = await shippings.digital.store({
  product_id: 1,
  file_path: '/storage/products/ebook.pdf',
  download_limit: 5,
  expiry_days: 30,
  requires_login: true,
  automatic_delivery: true,
  status: 'active',
})
```

### Bulk Upload Digital Products

```ts
const products = await shippings.digital.bulkStore([
  {
    product_id: 1,
    file_path: '/storage/products/software-v1.zip',
    download_limit: 3,
    expiry_days: 365,
    requires_login: true,
  },
  {
    product_id: 2,
    file_path: '/storage/products/course-materials.zip',
    download_limit: 10,
    expiry_days: 90,
    requires_login: true,
  },
])
```

## Secure File Storage

### Storage Configuration

```ts
// config/storage.ts
export default {
  disks: {
    digital_products: {
      driver: 's3',
      bucket: 'your-digital-products-bucket',
      region: 'us-east-1',
      visibility: 'private', // Important: Keep files private
    },
  },
}
```

### Uploading Files

```ts
import { storage } from '@stacksjs/storage'

async function uploadDigitalProduct(file: File, productId: number) {
  const filename = `products/${productId}/${file.name}`

  await storage.disk('digital_products').put(filename, file)

  return filename
}
```

## Secure Download Links

### Generate Signed Download URL

```ts
import { storage } from '@stacksjs/storage'
import { sign } from '@stacksjs/security'

async function generateDownloadUrl(
  digitalDeliveryId: number,
  userId: number
): Promise<string> {
  const delivery = await shippings.digital.fetchById(digitalDeliveryId)

  if (!delivery) throw new Error('Digital product not found')

  // Check if user has access
  const purchase = await Purchase
    .where('product_id', '=', delivery.product_id)
    .where('user_id', '=', userId)
    .first()

  if (!purchase) throw new Error('Purchase not found')

  // Check download limits
  const downloadCount = await Download
    .where('purchase_id', '=', purchase.id)
    .count()

  if (downloadCount >= delivery.download_limit) {
    throw new Error('Download limit exceeded')
  }

  // Check expiry
  const purchaseDate = new Date(purchase.created_at)
  const expiryDate = new Date(purchaseDate)
  expiryDate.setDate(expiryDate.getDate() + delivery.expiry_days)

  if (new Date() > expiryDate) {
    throw new Error('Download link has expired')
  }

  // Generate signed URL valid for 1 hour
  const signedUrl = await storage
    .disk('digital_products')
    .temporaryUrl(delivery.file_path, 3600)

  // Record the download attempt
  await Download.create({
    purchase_id: purchase.id,
    digital_delivery_id: delivery.id,
    user_id: userId,
    ip_address: request.ip,
    downloaded_at: new Date().toISOString(),
  })

  return signedUrl
}
```

### Token-Based Download Links

```ts
import { encrypt, decrypt } from '@stacksjs/security'

async function generateDownloadToken(
  purchaseId: number,
  productId: number
): Promise<string> {
  const payload = {
    purchase_id: purchaseId,
    product_id: productId,
    expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  }

  return encrypt(JSON.stringify(payload))
}

async function validateDownloadToken(token: string): Promise<{
  valid: boolean
  purchase_id?: number
  product_id?: number
  message?: string
}> {
  try {
    const decrypted = decrypt(token)
    const payload = JSON.parse(decrypted)

    if (Date.now() > payload.expires_at) {
      return { valid: false, message: 'Download link has expired' }
    }

    return {
      valid: true,
      purchase_id: payload.purchase_id,
      product_id: payload.product_id,
    }
  } catch {
    return { valid: false, message: 'Invalid download token' }
  }
}
```

## Download Endpoint

```ts
// routes/api.ts
router.get('/download/:token', async (request) => {
  const { token } = request.params

  const validation = await validateDownloadToken(token)

  if (!validation.valid) {
    return Response.json({ error: validation.message }, { status: 400 })
  }

  const delivery = await shippings.digital
    .where('product_id', '=', validation.product_id)
    .first()

  if (!delivery) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  // Get the file
  const fileStream = await storage
    .disk('digital_products')
    .readStream(delivery.file_path)

  const filename = delivery.file_path.split('/').pop()

  return new Response(fileStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
```

## Automatic Delivery

### After Purchase Delivery

```ts
async function handleSuccessfulPurchase(purchase: PurchaseModel) {
  const delivery = await shippings.digital
    .where('product_id', '=', purchase.product_id)
    .where('automatic_delivery', '=', true)
    .first()

  if (!delivery) return

  // Generate download link
  const downloadToken = await generateDownloadToken(
    purchase.id,
    purchase.product_id
  )

  const downloadUrl = `${process.env.APP_URL}/download/${downloadToken}`

  // Send delivery email
  await sendDigitalDeliveryEmail({
    to: purchase.user.email,
    productName: purchase.product.name,
    downloadUrl,
    expiresIn: `${delivery.expiry_days} days`,
    downloadLimit: delivery.download_limit,
  })

  // Update purchase status
  await purchase.update({
    delivery_status: 'delivered',
    delivered_at: new Date().toISOString(),
  })
}
```

### Delivery Email Template

```ts
// emails/digital-delivery.ts
export function digitalDeliveryEmail(data: {
  productName: string
  downloadUrl: string
  expiresIn: string
  downloadLimit: number
}): string {
  return `
    <h1>Your download is ready!</h1>

    <p>Thank you for purchasing <strong>${data.productName}</strong>.</p>

    <p>Click the button below to download your product:</p>

    <a href="${data.downloadUrl}" style="
      display: inline-block;
      padding: 12px 24px;
      background-color: #4F46E5;
      color: white;
      text-decoration: none;
      border-radius: 6px;
    ">Download Now</a>

    <p><strong>Important:</strong></p>
    <ul>
      <li>This link expires in ${data.expiresIn}</li>
      <li>You can download this file ${data.downloadLimit} times</li>
    </ul>

    <p>If you have any issues, please contact our support team.</p>
  `
}
```

## Download Tracking

### Track Downloads

```ts
async function trackDownload(
  purchaseId: number,
  userId: number,
  request: Request
) {
  await Download.create({
    purchase_id: purchaseId,
    user_id: userId,
    ip_address: request.headers.get('x-forwarded-for') || request.ip,
    user_agent: request.headers.get('user-agent'),
    downloaded_at: new Date().toISOString(),
  })
}
```

### Get Download History

```ts
async function getDownloadHistory(userId: number) {
  const downloads = await Download
    .with(['purchase', 'purchase.product'])
    .where('user_id', '=', userId)
    .orderBy('downloaded_at', 'desc')
    .get()

  return downloads.map(d => ({
    product_name: d.purchase.product.name,
    downloaded_at: d.downloaded_at,
    ip_address: d.ip_address,
  }))
}
```

### Check Remaining Downloads

```ts
async function getRemainingDownloads(
  purchaseId: number,
  productId: number
): Promise<number> {
  const delivery = await shippings.digital
    .where('product_id', '=', productId)
    .first()

  if (!delivery) return 0

  const downloadCount = await Download
    .where('purchase_id', '=', purchaseId)
    .count()

  return Math.max(0, delivery.download_limit - downloadCount)
}
```

## Multiple File Products

### Products with Multiple Files

```ts
async function createMultiFileProduct(
  productId: number,
  files: Array<{
    file_path: string
    name: string
    description?: string
  }>
) {
  const deliveries = files.map(file => ({
    product_id: productId,
    file_path: file.file_path,
    file_name: file.name,
    file_description: file.description,
    download_limit: 5,
    expiry_days: 30,
    requires_login: true,
    automatic_delivery: true,
    status: 'active',
  }))

  await shippings.digital.bulkStore(deliveries)
}

// Get all files for a product
async function getProductFiles(productId: number) {
  return await shippings.digital
    .where('product_id', '=', productId)
    .where('status', '=', 'active')
    .get()
}
```

## Version Updates

### Add New Version

```ts
async function addProductVersion(
  productId: number,
  newFilePath: string,
  version: string
) {
  // Archive old version
  await shippings.digital
    .where('product_id', '=', productId)
    .where('status', '=', 'active')
    .update({ status: 'archived' })

  // Add new version
  const newDelivery = await shippings.digital.store({
    product_id: productId,
    file_path: newFilePath,
    version,
    download_limit: 5,
    expiry_days: 365,
    status: 'active',
  })

  // Notify existing customers
  await notifyCustomersOfUpdate(productId, version)

  return newDelivery
}
```

### Customer Update Notifications

```ts
async function notifyCustomersOfUpdate(productId: number, version: string) {
  const purchases = await Purchase
    .with(['user'])
    .where('product_id', '=', productId)
    .get()

  for (const purchase of purchases) {
    const downloadToken = await generateDownloadToken(
      purchase.id,
      productId
    )

    await sendProductUpdateEmail({
      to: purchase.user.email,
      productName: purchase.product.name,
      version,
      downloadUrl: `${process.env.APP_URL}/download/${downloadToken}`,
    })
  }
}
```

## API Endpoints

```
GET    /api/downloads                 # List user's purchased downloads
GET    /api/downloads/{id}            # Get download details
GET    /download/{token}              # Download file
POST   /api/downloads/{id}/regenerate # Generate new download link
GET    /api/downloads/{id}/history    # Download history
```

### Example API Usage

```ts
// Get user's downloads
const response = await fetch('/api/downloads', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
const downloads = await response.json()

// Regenerate download link
const response = await fetch(`/api/downloads/${downloadId}/regenerate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
const { download_url } = await response.json()
```

## Error Handling

```ts
try {
  const downloadUrl = await generateDownloadUrl(deliveryId, userId)
} catch (error) {
  switch (error.message) {
    case 'Download limit exceeded':
      // Show limit exceeded message
      break
    case 'Download link has expired':
      // Prompt to purchase again or contact support
      break
    case 'Purchase not found':
      // User hasn't purchased this product
      break
    default:
      // Generic error
      console.error('Download error:', error)
  }
}
```

## Response Format

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "file_path": "/storage/products/ebook.pdf",
  "download_limit": 5,
  "expiry_days": 30,
  "requires_login": true,
  "automatic_delivery": true,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

This documentation covers the essential digital download functionality. Each function is type-safe and designed for secure delivery of digital products.
