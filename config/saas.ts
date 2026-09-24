import type { SaasConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

// Plan and product names are what customers see at checkout and on invoices,
// so they follow the app's name rather than naming the framework.
const appName = env.APP_NAME || 'Stacks'

/**
 * **Payment Configuration**
 *
 * This configuration defines all of your Payment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  plans: [
    {
      productName: `${appName} Hobby`,
      description: `All the ${appName} features.`,
      pricing: [
        {
          key: 'stacks_hobby_early_monthly',
          price: 1900,
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_launch_monthly',
          price: 2900,
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_monthly',
          price: 3900,
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_yearly',
          price: 37900,
          interval: 'year',
          currency: 'usd',
        },
      ],
      metadata: {
        createdBy: 'admin',
        version: '1.0.0',
      },
    },
    {
      productName: `${appName} Pro`,
      description: `All the ${appName} features, including being able to invite team members.`,
      pricing: [
        {
          key: 'stacks_pro_early_monthly',
          price: 3900,
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_pro_monthly',
          price: 5900,
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_pro_yearly',
          price: 57900,
          interval: 'year',
          currency: 'usd',
        },
        {
          key: 'stacks_pro_early_yearly',
          price: 39000, // Early bird pricing for yearly
          interval: 'year',
          currency: 'usd',
        },
      ],
      metadata: {
        createdBy: 'admin',
        version: '1.0.0',
      },
    },
    {
      productName: `${appName} Lifetime`,
      description: `One-time lifetime access to all ${appName} features.`,
      pricing: [
        {
          key: 'stacks_hobby_early_lifetime',
          price: 17900,
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_launch_lifetime',
          price: 27900,
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_lifetime',
          price: 47900,
          currency: 'usd',
        },
        {
          key: 'stacks_pro_early_lifetime',
          price: 27900,
          currency: 'usd',
        },
        {
          key: 'stacks_pro_launch_lifetime',
          price: 37900,
          currency: 'usd',
        },
        {
          key: 'stacks_pro_lifetime',
          price: 74900,
          currency: 'usd',
        },
      ],
      metadata: {
        createdBy: 'admin',
        version: '1.0.0',
      },
    },
  ],
  webhook: {
    endpoint: 'your-webhook-endpoint',
    secret: 'your-webhook-secret',
  },
  currencies: ['usd'],
  coupons: [],
  products: [
    {
      name: `${appName} Hobby`,
      description: `All the ${appName} features.`,
      images: ['image-url'],
    },
    {
      name: `${appName} Pro`,
      description: `All the ${appName} features, including team invites.`,
      images: ['image-url'],
    },
    {
      name: `${appName} Lifetime`,
      description: `Lifetime access to ${appName} features.`,
      images: ['image-url'],
    },
  ],
} satisfies SaasConfig
