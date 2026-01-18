# Affiliates Program

The Affiliates Program module provides functionality for creating and managing affiliate marketing programs. This guide covers affiliate tracking, commission management, and payout processing.

## Getting Started

Import the affiliate functionality:

```ts
import { Affiliate, AffiliateLink, Commission, Payout } from '@stacksjs/commerce'
```

## Affiliate Registration

### Creating an Affiliate Account

```ts
async function registerAffiliate(userId: number, data: {
  company_name?: string
  website?: string
  payment_email: string
  tax_id?: string
}) {
  // Generate unique affiliate code
  const affiliateCode = generateAffiliateCode()

  const affiliate = await Affiliate.create({
    user_id: userId,
    code: affiliateCode,
    company_name: data.company_name,
    website: data.website,
    payment_email: data.payment_email,
    tax_id: data.tax_id,
    status: 'pending', // Requires approval
    commission_rate: 0.10, // Default 10%
    created_at: new Date().toISOString(),
  })

  // Send welcome email
  await sendAffiliateWelcomeEmail(affiliate)

  return affiliate
}

function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

### Approving Affiliates

```ts
async function approveAffiliate(affiliateId: number) {
  const affiliate = await Affiliate.find(affiliateId)

  if (!affiliate) throw new Error('Affiliate not found')

  await affiliate.update({
    status: 'active',
    approved_at: new Date().toISOString(),
  })

  // Send approval notification
  await sendAffiliateApprovedEmail(affiliate)

  return affiliate
}

async function rejectAffiliate(affiliateId: number, reason: string) {
  const affiliate = await Affiliate.find(affiliateId)

  if (!affiliate) throw new Error('Affiliate not found')

  await affiliate.update({
    status: 'rejected',
    rejection_reason: reason,
  })

  // Send rejection notification
  await sendAffiliateRejectedEmail(affiliate, reason)

  return affiliate
}
```

## Affiliate Links

### Creating Tracking Links

```ts
async function createAffiliateLink(
  affiliateId: number,
  data: {
    name: string
    destination_url: string
    campaign?: string
  }
) {
  const affiliate = await Affiliate.find(affiliateId)

  if (!affiliate) throw new Error('Affiliate not found')

  const trackingCode = generateTrackingCode()

  const link = await AffiliateLink.create({
    affiliate_id: affiliateId,
    name: data.name,
    tracking_code: trackingCode,
    destination_url: data.destination_url,
    campaign: data.campaign,
    clicks: 0,
    conversions: 0,
    status: 'active',
  })

  return {
    ...link,
    tracking_url: `${process.env.APP_URL}/ref/${trackingCode}`,
  }
}

function generateTrackingCode(): string {
  return `ref_${randomUUIDv7().split('-')[0]}`
}
```

### Tracking Link Redirect

```ts
// routes/web.ts
router.get('/ref/:code', async (request) => {
  const { code } = request.params

  const link = await AffiliateLink
    .where('tracking_code', '=', code)
    .where('status', '=', 'active')
    .first()

  if (!link) {
    return Response.redirect('/') // Fallback to homepage
  }

  // Record click
  await link.update({ clicks: link.clicks + 1 })

  // Record click details
  await AffiliateClick.create({
    affiliate_link_id: link.id,
    affiliate_id: link.affiliate_id,
    ip_address: request.headers.get('x-forwarded-for') || request.ip,
    user_agent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    clicked_at: new Date().toISOString(),
  })

  // Set tracking cookie (30 days)
  const response = Response.redirect(link.destination_url)
  response.headers.set(
    'Set-Cookie',
    `affiliate_ref=${link.affiliate_id}; Max-Age=${30 * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax`
  )

  return response
})
```

## Commission Tracking

### Attribution Models

```ts
// config/affiliates.ts
export default {
  attribution: {
    model: 'last_click', // 'first_click', 'last_click', or 'linear'
    cookie_duration: 30, // Days
  },
  commissions: {
    default_rate: 0.10, // 10%
    minimum_payout: 5000, // $50.00 in cents
    payout_schedule: 'monthly', // 'weekly', 'biweekly', 'monthly'
  },
}
```

### Recording Commissions on Purchase

```ts
async function recordAffiliateCommission(order: OrderModel, request: Request) {
  // Get affiliate ID from cookie
  const cookies = parseCookies(request.headers.get('cookie') || '')
  const affiliateId = cookies.affiliate_ref

  if (!affiliateId) return null

  const affiliate = await Affiliate
    .where('id', '=', parseInt(affiliateId))
    .where('status', '=', 'active')
    .first()

  if (!affiliate) return null

  // Calculate commission
  const commissionAmount = Math.floor(order.subtotal * affiliate.commission_rate)

  const commission = await Commission.create({
    affiliate_id: affiliate.id,
    order_id: order.id,
    user_id: order.user_id,
    amount: commissionAmount,
    rate: affiliate.commission_rate,
    status: 'pending',
    source: 'order',
    created_at: new Date().toISOString(),
  })

  // Update affiliate link stats if applicable
  if (cookies.affiliate_link) {
    await AffiliateLink
      .where('id', '=', parseInt(cookies.affiliate_link))
      .update({ conversions: sql`conversions + 1` })
  }

  return commission
}

function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) cookies[name] = value
  })
  return cookies
}
```

### Commission Status Updates

```ts
async function approveCommission(commissionId: number) {
  const commission = await Commission.find(commissionId)

  if (!commission) throw new Error('Commission not found')

  await commission.update({
    status: 'approved',
    approved_at: new Date().toISOString(),
  })

  return commission
}

async function rejectCommission(commissionId: number, reason: string) {
  const commission = await Commission.find(commissionId)

  if (!commission) throw new Error('Commission not found')

  await commission.update({
    status: 'rejected',
    rejection_reason: reason,
  })

  return commission
}

// Auto-approve after refund period
async function processCommissionApprovals() {
  const refundPeriodDays = 30

  const pendingCommissions = await Commission
    .where('status', '=', 'pending')
    .where('created_at', '<', new Date(Date.now() - refundPeriodDays * 24 * 60 * 60 * 1000).toISOString())
    .get()

  for (const commission of pendingCommissions) {
    // Check if order was refunded
    const order = await Order.find(commission.order_id)

    if (order?.status === 'refunded') {
      await commission.update({ status: 'rejected', rejection_reason: 'Order refunded' })
    } else {
      await commission.update({ status: 'approved', approved_at: new Date().toISOString() })
    }
  }
}
```

## Payout Processing

### Calculate Pending Earnings

```ts
async function getAffiliateEarnings(affiliateId: number) {
  const approved = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('status', '=', 'approved')
    .sum('amount')

  const pending = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('status', '=', 'pending')
    .sum('amount')

  const paid = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('status', '=', 'paid')
    .sum('amount')

  return {
    available: approved,
    pending,
    total_earned: paid + approved + pending,
    total_paid: paid,
  }
}
```

### Creating Payouts

```ts
async function createPayout(affiliateId: number) {
  const affiliate = await Affiliate.find(affiliateId)

  if (!affiliate) throw new Error('Affiliate not found')

  // Get approved commissions
  const approvedCommissions = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('status', '=', 'approved')
    .get()

  const totalAmount = approvedCommissions.reduce((sum, c) => sum + c.amount, 0)

  if (totalAmount < config.affiliates.commissions.minimum_payout) {
    throw new Error(`Minimum payout is $${config.affiliates.commissions.minimum_payout / 100}`)
  }

  // Create payout record
  const payout = await Payout.create({
    affiliate_id: affiliateId,
    amount: totalAmount,
    payment_method: 'paypal', // or 'bank_transfer', 'stripe'
    payment_email: affiliate.payment_email,
    status: 'pending',
    created_at: new Date().toISOString(),
  })

  // Link commissions to payout
  for (const commission of approvedCommissions) {
    await commission.update({
      payout_id: payout.id,
      status: 'processing',
    })
  }

  return payout
}
```

### Process PayPal Payout

```ts
import paypal from '@paypal/payouts-sdk'

async function processPayPalPayout(payoutId: number) {
  const payout = await Payout.with(['affiliate']).find(payoutId)

  if (!payout) throw new Error('Payout not found')

  const client = new paypal.core.PayPalHttpClient(
    new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    )
  )

  const request = new paypal.payouts.PayoutsPostRequest()
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: `payout_${payout.id}_${Date.now()}`,
      email_subject: 'You have received a payment!',
    },
    items: [{
      recipient_type: 'EMAIL',
      amount: {
        value: (payout.amount / 100).toFixed(2),
        currency: 'USD',
      },
      receiver: payout.payment_email,
      note: `Affiliate commission payout #${payout.id}`,
    }],
  })

  try {
    const response = await client.execute(request)

    await payout.update({
      status: 'completed',
      provider_id: response.result.batch_header.payout_batch_id,
      processed_at: new Date().toISOString(),
    })

    // Update commission statuses
    await Commission
      .where('payout_id', '=', payout.id)
      .update({ status: 'paid' })

    return payout
  } catch (error) {
    await payout.update({
      status: 'failed',
      error_message: error.message,
    })
    throw error
  }
}
```

## Affiliate Dashboard

### Dashboard Stats

```ts
async function getAffiliateDashboardStats(affiliateId: number) {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Clicks in last 30 days
  const clicks = await AffiliateClick
    .where('affiliate_id', '=', affiliateId)
    .where('clicked_at', '>=', thirtyDaysAgo.toISOString())
    .count()

  // Conversions in last 30 days
  const conversions = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('created_at', '>=', thirtyDaysAgo.toISOString())
    .count()

  // Earnings in last 30 days
  const earnings = await Commission
    .where('affiliate_id', '=', affiliateId)
    .where('created_at', '>=', thirtyDaysAgo.toISOString())
    .sum('amount')

  // Calculate conversion rate
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0

  return {
    clicks,
    conversions,
    earnings,
    conversion_rate: conversionRate.toFixed(2),
    average_commission: conversions > 0 ? earnings / conversions : 0,
  }
}
```

### Performance by Link

```ts
async function getLinkPerformance(affiliateId: number) {
  const links = await AffiliateLink
    .where('affiliate_id', '=', affiliateId)
    .get()

  return links.map(link => ({
    id: link.id,
    name: link.name,
    tracking_url: `${process.env.APP_URL}/ref/${link.tracking_code}`,
    clicks: link.clicks,
    conversions: link.conversions,
    conversion_rate: link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(2) : '0.00',
  }))
}
```

## API Endpoints

```
POST   /api/affiliates/register       # Register as affiliate
GET    /api/affiliates/dashboard      # Dashboard stats
GET    /api/affiliates/links          # List affiliate links
POST   /api/affiliates/links          # Create affiliate link
DELETE /api/affiliates/links/{id}     # Delete affiliate link
GET    /api/affiliates/commissions    # List commissions
GET    /api/affiliates/payouts        # List payouts
POST   /api/affiliates/payouts/request # Request payout

# Admin endpoints
GET    /api/admin/affiliates          # List all affiliates
PATCH  /api/admin/affiliates/{id}     # Update affiliate
POST   /api/admin/affiliates/{id}/approve # Approve affiliate
POST   /api/admin/commissions/{id}/approve # Approve commission
POST   /api/admin/payouts/{id}/process # Process payout
```

### Example API Usage

```ts
// Register as affiliate
const response = await fetch('/api/affiliates/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    company_name: 'My Blog',
    website: 'https://myblog.com',
    payment_email: 'payments@myblog.com',
  }),
})

// Create tracking link
const response = await fetch('/api/affiliates/links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'Homepage Banner',
    destination_url: 'https://yourapp.com/pricing',
    campaign: 'summer_2024',
  }),
})
const { tracking_url } = await response.json()

// Request payout
const response = await fetch('/api/affiliates/payouts/request', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
```

## Webhook Events

Handle affiliate-related events:

```ts
// When order is completed
event.on('order.completed', async (order) => {
  await recordAffiliateCommission(order, request)
})

// When order is refunded
event.on('order.refunded', async (order) => {
  await Commission
    .where('order_id', '=', order.id)
    .update({ status: 'rejected', rejection_reason: 'Order refunded' })
})
```

## Error Handling

```ts
try {
  const payout = await createPayout(affiliateId)
} catch (error) {
  if (error.message.includes('Minimum payout')) {
    // Not enough earnings for payout
    showError('You need at least $50 in approved commissions to request a payout.')
  } else if (error.message.includes('not found')) {
    // Affiliate doesn't exist
    showError('Affiliate account not found.')
  } else {
    // Generic error
    console.error('Payout error:', error)
    showError('An error occurred while processing your payout request.')
  }
}
```

## Response Formats

### Affiliate Response

```json
{
  "id": 1,
  "user_id": 123,
  "code": "ABCD1234",
  "company_name": "My Blog",
  "website": "https://myblog.com",
  "payment_email": "payments@myblog.com",
  "commission_rate": 0.10,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Commission Response

```json
{
  "id": 1,
  "affiliate_id": 1,
  "order_id": 456,
  "amount": 999,
  "rate": 0.10,
  "status": "approved",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

This documentation covers the essential affiliate program functionality for referral marketing. Each function is type-safe and designed for tracking and rewarding affiliate partners.
