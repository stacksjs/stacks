import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SeoIndexAction',
  description: 'Returns SEO data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      seoData: {
        title: 'Stacks - Build better web applications',
        description: 'A modern full-stack framework for building web applications with TypeScript.',
        keywords: ['stacks', 'typescript', 'framework', 'web development'],
        ogImage: '/images/og-image.png',
      },
    }
  },
})
