import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetComponents',
  description: 'Gets your UI components.',
  method: 'GET',

  async handle() {
    const components = [
      { name: 'Button', category: 'Forms', instances: 47, description: 'Interactive button component with variants' },
      { name: 'Input', category: 'Forms', instances: 38, description: 'Text input with validation support' },
      { name: 'Card', category: 'Layout', instances: 23, description: 'Container card with header and footer slots' },
      { name: 'Modal', category: 'Overlay', instances: 12, description: 'Dialog modal with backdrop' },
      { name: 'Table', category: 'Data', instances: 18, description: 'Data table with sorting and pagination' },
      { name: 'Badge', category: 'Display', instances: 34, description: 'Status badge with color variants' },
      { name: 'Avatar', category: 'Display', instances: 21, description: 'User avatar with fallback' },
      { name: 'Dropdown', category: 'Navigation', instances: 15, description: 'Dropdown menu with items' },
    ]

    const categories = ['All', 'Forms', 'Layout', 'Overlay', 'Data', 'Display', 'Navigation']

    return { components, categories }
  },
})
