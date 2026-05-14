import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'

// Mock data used when the ORM is unavailable (e.g. dashboard dev with no DB
// seeded). Shape matches the `Author` interface in
// storage/framework/defaults/views/dashboard/content/authors/index.stx so
// the page can hydrate directly from this response.
const mockAuthors = [
  { id: 1, name: 'Jane Doe', email: 'jane@example.com', role: 'Editor', avatar: 'https://i.pravatar.cc/150?img=1', bio: 'Tech writer with 10+ years of experience covering web frameworks and performance.', postCount: 24, totalViews: 145000, totalComments: 312, created_at: '2022-01-15' },
  { id: 2, name: 'John Smith', email: 'john@example.com', role: 'Author', avatar: 'https://i.pravatar.cc/150?img=2', bio: 'Specialist in TypeScript and frontend tooling.', postCount: 18, totalViews: 98000, totalComments: 220, created_at: '2022-04-08' },
  { id: 3, name: 'Michael Brown', email: 'michael@example.com', role: 'Author', avatar: 'https://i.pravatar.cc/150?img=3', bio: 'Reviews hardware and software for developers.', postCount: 12, totalViews: 64000, totalComments: 145, created_at: '2022-09-21' },
  { id: 4, name: 'Emily Davis', email: 'emily@example.com', role: 'Author', avatar: 'https://i.pravatar.cc/150?img=4', bio: 'Accessibility advocate and design systems engineer.', postCount: 9, totalViews: 41000, totalComments: 88, created_at: '2023-02-14' },
  { id: 5, name: 'Sarah Williams', email: 'sarah@example.com', role: 'Author', avatar: 'https://i.pravatar.cc/150?img=5', bio: 'Backend engineer focused on API design and databases.', postCount: 6, totalViews: 22000, totalComments: 47, created_at: '2023-06-30' },
]

export default new Action({
  name: 'AuthorIndexAction',
  description: 'Returns authors data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allAuthors = await Author.all()

      // Empty result from a real ORM still falls through to mock data so the
      // dev dashboard always has something to render.
      if (!allAuthors || allAuthors.length === 0)
        return { authors: mockAuthors }

      const authors = allAuthors.map((a, idx) => {
        const name = String(a.get('name') || '')
        return {
          id: Number(a.get('id') || idx + 1),
          name,
          email: String(a.get('email') || ''),
          role: String(a.get('role') || 'Writer'),
          avatar: String(a.get('avatar') || `https://i.pravatar.cc/150?img=${idx + 1}`),
          bio: String(a.get('bio') || ''),
          postCount: Number(a.get('post_count') || a.get('posts') || 0),
          totalViews: Number(a.get('total_views') || 0),
          totalComments: Number(a.get('total_comments') || 0),
          created_at: String(a.get('created_at') || ''),
        }
      })

      return { authors }
    }
    catch {
      return { authors: mockAuthors }
    }
  },
})
