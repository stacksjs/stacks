import type { SaasConfig } from '@stacksjs/types'

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
      productName: 'Stacks Hobby',
      description: 'All the Stacks features.',
      pricing: [
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
        {
          key: 'stacks_hobby_early_monthly',
          price: 1900, // Early bird pricing for monthly
          interval: 'month',
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_early_yearly',
          price: 19000, // Early bird pricing for yearly
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
      productName: 'Stacks Pro',
      description: 'All the Stacks features, including being able to invite team members.',
      pricing: [
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
          key: 'stacks_pro_early_monthly',
          price: 3900, // Early bird pricing for monthly
          interval: 'month',
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
      productName: 'Stacks Lifetime',
      description: 'One-time lifetime access to all Stacks features.',
      pricing: [
        {
          key: 'stacks_lifetime',
          price: 74900, // Lifetime pricing for $749
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
      name: 'Stacks Hobby',
      description: 'All the Stacks features.',
      images: ['image-url'],
    },
    {
      name: 'Stacks Pro',
      description: 'All the Stacks features, including team invites.',
      images: ['image-url'],
    },
    {
      name: 'Stacks Lifetime',
      description: 'Lifetime access to Stacks features.',
      images: ['image-url'],
    },
  ],
} satisfies SaasConfig
