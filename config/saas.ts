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
          interval: 'monthly',
          currency: 'usd',
        },
        {
          key: 'stacks_hobby_yearly',
          price: 37900,
          interval: 'yearly',
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
          interval: 'monthly',
          currency: 'usd',
        },
        {
          key: 'stacks_pro_yearly',
          price: 57900,
          interval: 'yearly',
          currency: 'usd',
        },
      ],
      metadata: {
        createdBy: 'admin',
        version: '1.0.0',
      },
    }
  ],

  webhook: {
    endpoint: '/webhooks/stripe',
    secret: '',
  },

  currencies: ['usd'],

  coupons: [
    {
      code: 'SUMMER2024',
      amountOff: 500,
      duration: 'once',
    },
  ],

  products: [
    {
      name: 'Stacks Pro',
      description: 'All the Stacks features.',
      images: ['url_to_image'],
    },
  ],
} satisfies any
