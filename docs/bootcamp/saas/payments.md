# Payment Processing

The Payments module provides comprehensive payment processing capabilities using Stripe as the payment provider. This guide covers setting up payments, handling transactions, webhooks, and invoices.

## Getting Started

First, configure your Stripe credentials in the environment file:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Import the payment functionality:

```ts
import {
  manageCharge,
  manageCheckout,
  manageCustomer,
  manageInvoice,
  managePaymentMethod,
  manageTransaction,
} from '@stacksjs/payments'
```

## Customer Management

### Creating a Stripe Customer

```ts
import { manageCustomer } from '@stacksjs/payments'

// Create or get existing Stripe customer for a user
const customer = await manageCustomer.createOrGetStripeUser(user, {
  name: user.name,
  email: user.email,
  metadata: {
    user_id: user.id.toString(),
  },
})
```

### Updating Customer Information

```ts
const updatedCustomer = await manageCustomer.update(user.stripeId(), {
  name: 'New Name',
  email: 'newemail@example.com',
  address: {
    line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country: 'US',
  },
})
```

## One-Time Payments

### Creating a Charge

```ts
const charge = await manageCharge.create(user, {
  amount: 2999, // Amount in cents ($29.99)
  currency: 'usd',
  description: 'Premium feature purchase',
  metadata: {
    product_id: 'prod_123',
    order_id: 'order_456',
  },
})
```

### Using Checkout Sessions

For a hosted payment page:

```ts
const session = await manageCheckout.create(user, {
  mode: 'payment',
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Premium Package',
          description: 'Access to all premium features',
        },
        unit_amount: 4999, // $49.99
      },
      quantity: 1,
    },
  ],
  success_url: 'https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://yourapp.com/cancel',
})

// Redirect user to session.url
```

## Payment Methods

### Adding a Payment Method

```ts
// Attach a payment method to a customer
await managePaymentMethod.attach(user, paymentMethodId)

// Set as default payment method
await managePaymentMethod.setDefault(user, paymentMethodId)
```

### Listing Payment Methods

```ts
const paymentMethods = await managePaymentMethod.list(user, {
  type: 'card',
  limit: 10,
})

// Returns array of payment methods
paymentMethods.data.forEach((pm) => {
  console.log(`${pm.card.brand} ending in ${pm.card.last4}`)
})
```

### Removing a Payment Method

```ts
await managePaymentMethod.detach(paymentMethodId)
```

## Invoices

### Creating an Invoice

```ts
const invoice = await manageInvoice.create(user, {
  collection_method: 'send_invoice',
  days_until_due: 30,
  description: 'Services for January 2024',
})

// Add invoice items
await manageInvoice.addItem(invoice.id, {
  customer: user.stripeId(),
  amount: 10000, // $100.00
  description: 'Consulting services',
})

// Finalize and send the invoice
await manageInvoice.finalize(invoice.id)
await manageInvoice.send(invoice.id)
```

### Retrieving Invoices

```ts
// Get a specific invoice
const invoice = await manageInvoice.retrieve(invoiceId)

// List all invoices for a customer
const invoices = await manageInvoice.list(user, {
  limit: 10,
  status: 'paid',
})
```

### Downloading Invoice PDF

```ts
const invoice = await manageInvoice.retrieve(invoiceId)
const pdfUrl = invoice.invoice_pdf

// Redirect user to download
```

## Transactions

### Recording Transactions

```ts
const transaction = await manageTransaction.store({
  user_id: user.id,
  stripe_id: charge.id,
  amount: charge.amount,
  currency: charge.currency,
  status: charge.status,
  type: 'charge',
  description: 'One-time payment',
})
```

### Fetching Transaction History

```ts
// Get all transactions for a user
const transactions = await manageTransaction.fetchByUser(user.id)

// Get transaction by Stripe ID
const transaction = await manageTransaction.fetchByStripeId(stripeChargeId)
```

## Webhook Handling

### Setting Up the Webhook Endpoint

```ts
// routes/api.ts
import { webhookHandler } from '@stacksjs/payments'

router.post('/webhooks/stripe', webhookHandler)
```

### Webhook Event Handler

```ts
// app/Events/StripeWebhook.ts
import type Stripe from 'stripe'
import { stripe } from '@stacksjs/payments'

export async function handleWebhook(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const body = await request.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed')
    return new Response('Webhook Error', { status: 400 })
  }

  // Handle specific events
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object)
      break

    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object)
      break

    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return new Response('Received', { status: 200 })
}
```

### Event Handlers

```ts
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata.user_id

  // Update order status
  await Order.where('payment_intent_id', '=', paymentIntent.id)
    .update({ status: 'paid' })

  // Send confirmation email
  await sendPaymentConfirmationEmail(userId, paymentIntent)

  // Record transaction
  await manageTransaction.store({
    user_id: parseInt(userId),
    stripe_id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'succeeded',
    type: 'payment',
  })
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata.user_id

  // Update order status
  await Order.where('payment_intent_id', '=', paymentIntent.id)
    .update({ status: 'failed' })

  // Notify user
  await sendPaymentFailedEmail(userId, paymentIntent)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Update subscription status if applicable
  if (invoice.subscription) {
    await Subscription
      .where('provider_id', '=', invoice.subscription)
      .update({ provider_status: 'active' })
  }

  // Send receipt
  await sendInvoiceReceiptEmail(invoice)
}
```

## Refunds

### Processing a Refund

```ts
import { stripe } from '@stacksjs/payments'

// Full refund
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
})

// Partial refund
const partialRefund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: 1000, // Refund $10.00
})
```

## API Endpoints

The Payments module provides RESTful API endpoints:

```
POST   /api/payments/charge           # Create a one-time charge
POST   /api/payments/checkout         # Create checkout session
GET    /api/payments/methods          # List payment methods
POST   /api/payments/methods          # Add payment method
DELETE /api/payments/methods/{id}     # Remove payment method
GET    /api/invoices                  # List invoices
GET    /api/invoices/{id}             # Get invoice details
GET    /api/invoices/{id}/pdf         # Download invoice PDF
POST   /api/webhooks/stripe           # Stripe webhook endpoint
```

### Example API Usage

```ts
// Create a checkout session
const response = await fetch('/api/payments/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    items: [
      { price_id: 'price_123', quantity: 1 },
    ],
    success_url: 'https://yourapp.com/success',
    cancel_url: 'https://yourapp.com/cancel',
  }),
})
const { url } = await response.json()

// Redirect to Stripe Checkout
window.location.href = url
```

## Error Handling

The Payments module includes comprehensive error handling:

```ts
try {
  const charge = await manageCharge.create(user, {
    amount: 2999,
    currency: 'usd',
  })
} catch (error) {
  if (error.type === 'StripeCardError') {
    // Card was declined
    console.error('Payment failed:', error.message)
  } else if (error.type === 'StripeInvalidRequestError') {
    // Invalid parameters
    console.error('Invalid request:', error.message)
  } else {
    // Other error
    console.error('Payment error:', error.message)
  }
}
```

## Testing Payments

Use Stripe test mode and test card numbers:

```
4242 4242 4242 4242  - Succeeds
4000 0000 0000 0002  - Declined
4000 0000 0000 3220  - 3D Secure required
```

Test webhook events using Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This documentation covers the essential payment processing functionality. Each function is type-safe and designed for seamless integration with Stripe.
