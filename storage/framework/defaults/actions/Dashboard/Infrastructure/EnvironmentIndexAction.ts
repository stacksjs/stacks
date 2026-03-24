import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'EnvironmentIndexAction',
  description: 'Returns environment variable data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      variables: [
        { key: 'APP_NAME', value: 'Stacks', isSecret: false },
        { key: 'APP_ENV', value: 'production', isSecret: false },
        { key: 'APP_URL', value: 'https://stacksjs.com', isSecret: false },
        { key: 'DB_CONNECTION', value: 'sqlite', isSecret: false },
        { key: 'APP_KEY', value: '***hidden***', isSecret: true },
        { key: 'STRIPE_SECRET', value: '***hidden***', isSecret: true },
      ],
      environment: 'production',
    }
  },
})
