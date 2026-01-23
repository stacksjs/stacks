import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RSS Feed',
  description: 'Generate RSS feed for blog posts',
  method: 'GET',
  async handle() {
    const allPosts = await Post.where('status', '=', 'published')
      .orderBy('published_at', 'desc')
      .take(20)
      .get()
    const siteUrl = config.app.url || 'https://example.com'
    const siteName = config.app.name || 'Stacks Blog'
    const siteDescription = config.app.description || 'A blog powered by Stacks'

    const rssItems = allPosts
      .slice(0, 20) // Limit to 20 most recent
      .map((post) => {
        const pubDate = post.published_at
          ? new Date(post.published_at).toUTCString()
          : new Date(post.created_at || Date.now()).toUTCString()

        return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/blog/${post.id}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${post.id}</guid>
      <description><![CDATA[${post.excerpt || post.content?.substring(0, 200) || ''}]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>`
      })
      .join('\n')

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}</link>
    <description>${siteDescription}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`

    return response.send(rssFeed, 200, {
      'Content-Type': 'application/xml; charset=utf-8',
    })
  },
})
