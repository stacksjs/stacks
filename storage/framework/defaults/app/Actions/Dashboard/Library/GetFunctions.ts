import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetFunctions',
  description: 'Gets your utility functions.',
  method: 'GET',

  async handle() {
    const functions = [
      { name: 'formatDate', category: 'Date', calls: 1247, description: 'Format dates in various formats' },
      { name: 'validateEmail', category: 'Validation', calls: 892, description: 'Validate email addresses' },
      { name: 'slugify', category: 'String', calls: 456, description: 'Convert strings to URL slugs' },
      { name: 'debounce', category: 'Utility', calls: 234, description: 'Debounce function calls' },
      { name: 'formatCurrency', category: 'Number', calls: 678, description: 'Format numbers as currency' },
      { name: 'parseJSON', category: 'Data', calls: 345, description: 'Safely parse JSON strings' },
      { name: 'truncate', category: 'String', calls: 567, description: 'Truncate strings with ellipsis' },
      { name: 'capitalize', category: 'String', calls: 423, description: 'Capitalize first letter' },
    ]

    return { functions }
  },
})
