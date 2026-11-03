// recordPageview() with the requests it really receives (stacksjs/stacks#3154):
// behind rpx the URL's host is the upstream address and the site's own host
// arrives on X-Forwarded-Host.
import { db } from '@stacksjs/database/runtime'
import { recordPageview } from '../../src/capture'

await db.unsafe(`CREATE TABLE analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'custom', path TEXT, properties TEXT, created_at TEXT, updated_at TEXT)`).execute()

const browser = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const view = (url: string, headers: Record<string, string>) =>
  recordPageview(new Request(url, { headers: { 'accept': 'text/html', 'user-agent': browser, ...headers } }))

// Through rpx: a click from the home page to /pricing, then a visitor from a search engine.
await view('http://127.0.0.1:3000/pricing', { 'host': '127.0.0.1:3000', 'x-forwarded-host': 'shop.example.com', 'referer': 'https://shop.example.com/' })
await view('http://127.0.0.1:3000/', { 'host': '127.0.0.1:3000', 'x-forwarded-host': 'shop.example.com, edge.internal', 'referer': 'https://www.google.com/' })
// Served directly, with no proxy in front.
await view('https://shop.example.com/about', { referer: 'https://shop.example.com/pricing' })

const rows = await db.unsafe('SELECT path, properties FROM analytics_events ORDER BY id').execute() as Array<{ path: string, properties: string }>
console.log(JSON.stringify(rows.map(row => ({ path: row.path, ...JSON.parse(row.properties) }))))
