import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'FetchPublishableKeyAction',
  description: 'Fetch stripe publishable key',
  method: 'POST',
  async handle() {
    const apiKey = process.env.STRIPE_PUBLIC_KEY || ''

    return { publishableKey: apiKey }
  },
})
