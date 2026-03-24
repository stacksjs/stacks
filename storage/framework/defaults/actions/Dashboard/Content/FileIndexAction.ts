import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'FileIndexAction',
  description: 'Returns file/media data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'hero-image.png', path: '/uploads/images/', size: '2.4 MB', type: 'image/png', uploadedAt: '2024-03-15' },
        { id: 2, name: 'product-catalog.pdf', path: '/uploads/documents/', size: '5.1 MB', type: 'application/pdf', uploadedAt: '2024-03-14' },
        { id: 3, name: 'logo.svg', path: '/uploads/images/', size: '12 KB', type: 'image/svg+xml', uploadedAt: '2024-03-10' },
      ],
      totalSize: '45.2 MB',
      totalFiles: 156,
    }
  },
})
