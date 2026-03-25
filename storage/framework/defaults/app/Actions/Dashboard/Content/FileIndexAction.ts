import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'FileIndexAction',
  description: 'Returns file/media data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      files: [
        { name: 'images', type: 'folder', items: 247, size: '1.2 GB', modified: '2024-01-10' },
        { name: 'documents', type: 'folder', items: 89, size: '456 MB', modified: '2024-01-09' },
        { name: 'videos', type: 'folder', items: 34, size: '4.8 GB', modified: '2024-01-08' },
        { name: 'hero-banner.png', type: 'image', items: null, size: '2.4 MB', modified: '2024-01-10' },
        { name: 'style-guide.pdf', type: 'document', items: null, size: '892 KB', modified: '2024-01-07' },
        { name: 'product-demo.mp4', type: 'video', items: null, size: '124 MB', modified: '2024-01-05' },
      ],
      storage: {
        used: 12.4,
        total: 50,
        percentage: 24.8,
      },
    }
  },
})
