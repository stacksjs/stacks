import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Page, Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Sitemap',
  description: 'Generate XML sitemap for SEO',
  method: 'GET',
  async handle() {
    const allPosts = await Post.where('status', '=', 'published').get()
    const allCategories = await Category.all()
    const allPages = await Page.where('status', '=', 'published').get()
    const siteUrl = config.app.url || 'https://example.com'

    const postUrls = allPosts
      .map((post) => {
        const lastmod = post.updated_at
          ? new Date(post.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

        // Slug-first now that posts carry one; id keeps pre-slug rows reachable.
        return `
  <url>
    <loc>${siteUrl}/blog/${post.slug || post.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      })
      .join('\n')

    // CMS pages: published block documents served at their materialized path.
    const pageUrls = allPages
      .filter(page => page.path && page.path !== '/')
      .map((page) => {
        const lastmod = page.updated_at
          ? new Date(page.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

        return `
  <url>
    <loc>${siteUrl}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
      })
      .join('\n')

    const categoryUrls = allCategories
      .map((category) => {
        return `
  <url>
    <loc>${siteUrl}/blog/category/${category.slug || category.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
      })
      .join('\n')

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${postUrls}
${categoryUrls}
${pageUrls}
</urlset>`

    return response.xml(sitemap)
  },
})
