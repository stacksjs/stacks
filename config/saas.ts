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
      productName: 'Stacks Pro',
      description: 'Access to all premium features of Stacks.',
      pricing: [
        {
          key: 'stacks_pro_monthly',
          price: 2000,
          interval: 'monthly',
          currency: 'usd',
        },
        {
          key: 'stacks_pro_yearly',
          price: 20000,
          interval: 'yearly',
          currency: 'usd',
        },
      ],
      metadata: {
        createdBy: 'admin',
        version: '1.0.0',
      },
    },
    // Add other plans as needed
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
      description: 'Access to all premium features of Stacks.',
      images: ['url_to_image'],
    },
  ],
} satisfies any
