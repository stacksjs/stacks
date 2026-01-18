# Subscription Billing

The Subscriptions module provides comprehensive subscription billing functionality using Stripe. This guide covers creating subscription plans, managing trials, handling upgrades/downgrades, and tracking subscription status.

## Getting Started

Import the subscription functionality:

```ts
import { manageSubscription, managePrice } from '@stacksjs/payments'
import { Subscription, User } from '@stacksjs/orm'
```

## Subscription Plans

### Defining Plans in Stripe

First, create your products and prices in Stripe:

```ts
import { stripe } from '@stacksjs/payments'

// Create a product
const product = await stripe.products.create({
  name: 'Pro Plan',
  description: 'Access to all pro features',
  metadata: {
    plan_type: 'pro',
  },
})

// Create monthly price
const monthlyPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 2999, // $29.99
  currency: 'usd',
  recurring: {
    interval: 'month',
  },
  lookup_key: 'pro_monthly',
})

// Create yearly price
const yearlyPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 29900, // $299.00 (save ~17%)
  currency: 'usd',
  recurring: {
    interval: 'year',
  },
  lookup_key: 'pro_yearly',
})
```

### Plan Configuration

```ts
// config/subscriptions.ts
export default {
  plans: {
    free: {
      name: 'Free',
      features: ['5 projects', 'Basic support'],
      limits: {
        projects: 5,
        storage: '1GB',
      },
    },
    pro: {
      name: 'Pro',
      lookup_keys: {
        monthly: 'pro_monthly',
        yearly: 'pro_yearly',
      },
      features: ['Unlimited projects', 'Priority support', 'Advanced analytics'],
      limits: {
        projects: -1, // unlimited
        storage: '100GB',
      },
    },
    enterprise: {
      name: 'Enterprise',
      lookup_keys: {
        monthly: 'enterprise_monthly',
        yearly: 'enterprise_yearly',
      },
      features: ['Custom integrations', 'Dedicated support', 'SLA'],
      limits: {
        projects: -1,
        storage: 'unlimited',
      },
    },
  },
}
```

## Creating Subscriptions

### Basic Subscription

```ts
const subscription = await manageSubscription.create(
  user,
  'default', // subscription type
  'pro_monthly', // price lookup key
  {} // additional Stripe params
)
```

### Subscription with Trial Period

```ts
const subscription = await manageSubscription.create(
  user,
  'default',
  'pro_monthly',
  {
    trial_period_days: 14,
  }
)
```

### Subscription with Existing Payment Method

```ts
const subscription = await manageSubscription.create(
  user,
  'default',
  'pro_monthly',
  {
    default_payment_method: paymentMethodId,
    payment_behavior: 'default_incomplete',
  }
)
```

### Using Checkout for Subscriptions

```ts
import { manageCheckout } from '@stacksjs/payments'

const session = await manageCheckout.create(user, {
  mode: 'subscription',
  line_items: [
    {
      price: 'price_123', // Stripe price ID
      quantity: 1,
    },
  ],
  subscription_data: {
    trial_period_days: 14,
    metadata: {
      user_id: user.id.toString(),
    },
  },
  success_url: 'https://yourapp.com/subscription/success',
  cancel_url: 'https://yourapp.com/subscription/cancel',
})
```

## Trial Management

### Checking Trial Status

```ts
async function isOnTrial(user: UserModel): Promise<boolean> {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .where('provider_status', '=', 'trialing')
    .first()

  return !!subscription
}

async function trialEndsAt(user: UserModel): Promise<Date | null> {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription?.trial_ends_at) return null

  return new Date(subscription.trial_ends_at)
}

async function daysLeftInTrial(user: UserModel): Promise<number> {
  const endsAt = await trialEndsAt(user)
  if (!endsAt) return 0

  const now = new Date()
  const diff = endsAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
```

### Extending a Trial

```ts
import { stripe } from '@stacksjs/payments'

async function extendTrial(user: UserModel, additionalDays: number) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  const currentTrialEnd = subscription.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime() / 1000
    : Math.floor(Date.now() / 1000)

  const newTrialEnd = currentTrialEnd + (additionalDays * 24 * 60 * 60)

  await stripe.subscriptions.update(subscription.provider_id, {
    trial_end: newTrialEnd,
  })

  await subscription.update({
    trial_ends_at: new Date(newTrialEnd * 1000).toISOString(),
  })
}
```

### Ending a Trial Early

```ts
async function endTrialNow(user: UserModel) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  await stripe.subscriptions.update(subscription.provider_id, {
    trial_end: 'now',
  })

  await subscription.update({
    trial_ends_at: new Date().toISOString(),
    provider_status: 'active',
  })
}
```

## Subscription Status

### Checking Subscription Status

```ts
// Check if user has a valid subscription
const isValid = await manageSubscription.isValid(user, 'default')

// Check if subscription is incomplete (payment pending)
const isIncomplete = await manageSubscription.isIncomplete(user, 'default')
```

### Status Helper Functions

```ts
async function subscriptionStatus(user: UserModel): Promise<string> {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) return 'none'

  return subscription.provider_status // 'active', 'trialing', 'past_due', 'canceled', etc.
}

async function isSubscribed(user: UserModel, plan?: string): Promise<boolean> {
  const query = Subscription
    .where('user_id', '=', user.id)
    .where('provider_status', 'in', ['active', 'trialing'])

  if (plan) {
    query.where('type', '=', plan)
  }

  const subscription = await query.first()
  return !!subscription
}
```

## Plan Changes

### Upgrading a Subscription

```ts
async function upgradePlan(user: UserModel, newPlanLookupKey: string) {
  const subscription = await manageSubscription.update(
    user,
    'default',
    newPlanLookupKey
  )

  return subscription
}
```

### Downgrading a Subscription

```ts
async function downgradePlan(user: UserModel, newPlanLookupKey: string) {
  // Downgrade at period end to honor remaining time
  const activeSubscription = await user.activeSubscription()

  if (!activeSubscription) throw new Error('No active subscription')

  await stripe.subscriptions.update(activeSubscription.subscription.provider_id, {
    proration_behavior: 'none', // Don't prorate
    items: [{
      id: (await stripe.subscriptions.retrieve(
        activeSubscription.subscription.provider_id
      )).items.data[0].id,
      price: await managePrice.retrieveByLookupKey(newPlanLookupKey).then(p => p.id),
    }],
    billing_cycle_anchor: 'unchanged',
  })
}
```

### Switching Billing Interval

```ts
async function switchToYearly(user: UserModel) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  // Get the yearly price for the same plan
  const yearlyLookupKey = `${subscription.type}_yearly`

  await manageSubscription.update(user, subscription.type, yearlyLookupKey)
}
```

## Cancellation

### Cancel at Period End

```ts
async function cancelAtPeriodEnd(user: UserModel) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  await stripe.subscriptions.update(subscription.provider_id, {
    cancel_at_period_end: true,
  })

  // Store cancellation date
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.provider_id
  )

  await subscription.update({
    ends_at: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
  })
}
```

### Cancel Immediately

```ts
async function cancelImmediately(user: UserModel) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  await manageSubscription.cancel(subscription.provider_id)
}
```

### Resume a Cancelled Subscription

```ts
async function resumeSubscription(user: UserModel) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  await stripe.subscriptions.update(subscription.provider_id, {
    cancel_at_period_end: false,
  })

  await subscription.update({ ends_at: null })
}
```

## Quantity-Based Subscriptions

### Updating Quantity (Seats)

```ts
async function updateSeats(user: UserModel, quantity: number) {
  const subscription = await Subscription
    .where('user_id', '=', user.id)
    .first()

  if (!subscription) throw new Error('No subscription found')

  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.provider_id
  )

  await stripe.subscriptionItems.update(stripeSubscription.items.data[0].id, {
    quantity,
    proration_behavior: 'create_prorations',
  })

  await subscription.update({ quantity })
}
```

## API Endpoints

```
GET    /api/subscriptions             # Get user's subscriptions
POST   /api/subscriptions             # Create subscription
PATCH  /api/subscriptions/{id}        # Update subscription
DELETE /api/subscriptions/{id}        # Cancel subscription
POST   /api/subscriptions/{id}/resume # Resume cancelled subscription
GET    /api/plans                     # List available plans
```

### Example API Usage

```ts
// Subscribe to a plan
const response = await fetch('/api/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    plan: 'pro_monthly',
    payment_method_id: 'pm_123',
  }),
})

// Cancel subscription
const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})

// Upgrade plan
const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    plan: 'enterprise_monthly',
  }),
})
```

## Webhook Events

Handle subscription-related webhooks:

```ts
switch (event.type) {
  case 'customer.subscription.created':
    // New subscription created
    break

  case 'customer.subscription.updated':
    // Subscription updated (plan change, quantity, etc.)
    await updateStoredSubscription(event.data.object)
    break

  case 'customer.subscription.deleted':
    // Subscription cancelled
    await markSubscriptionCancelled(event.data.object)
    break

  case 'customer.subscription.trial_will_end':
    // Trial ending soon (3 days before)
    await sendTrialEndingEmail(event.data.object)
    break

  case 'invoice.payment_failed':
    // Subscription payment failed
    await handleFailedPayment(event.data.object)
    break
}
```

## Error Handling

```ts
try {
  const subscription = await manageSubscription.create(user, 'default', 'pro_monthly', {})
} catch (error) {
  if (error.message.includes('Price does not exist')) {
    console.error('Invalid plan selected')
  } else if (error.message.includes('Customer does not exist')) {
    console.error('User needs to set up payment first')
  } else {
    console.error('Subscription error:', error.message)
  }
}
```

This documentation covers the essential subscription billing functionality. Each function is type-safe and designed for seamless integration with Stripe subscriptions.
