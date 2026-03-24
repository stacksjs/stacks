import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SeoIndexAction',
  description: 'Returns SEO data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      pages: [
        { url: '/', title: 'Home | Stacks', score: 92, issues: 1, lastCrawled: '2024-03-15' },
        { url: '/docs', title: 'Documentation | Stacks', score: 88, issues: 3, lastCrawled: '2024-03-15' },
        { url: '/blog', title: 'Blog | Stacks', score: 95, issues: 0, lastCrawled: '2024-03-15' },
      ],
      overallScore: 91,
      totalIssues: 4,
    }
  },
})
