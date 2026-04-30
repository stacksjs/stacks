import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Action } from '@stacksjs/actions'
import { log as logDriver } from '@stacksjs/email'
import { logsPath } from '@stacksjs/path'
import { request } from '@stacksjs/router'

const { LogEmailDriver } = logDriver

function formatAddress(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatAddress).filter(Boolean).join(', ')
  const obj = value as { name?: string, address?: string }
  if (obj.address) return obj.name ? `${obj.name} <${obj.address}>` : obj.address
  return ''
}

export default new Action({
  name: 'InboxShowAction',
  description: 'Returns the body of a single captured transactional email.',
  method: 'GET',
  async handle() {
    // bun-router exposes route params as `request.params` (Record). The
    // Stacks `request` proxy returns undefined for any function that doesn't
    // exist on the underlying request, so older `getParam` callers in the
    // codebase silently get '' — that's why we read params directly.
    const id = String((request as any).params?.id || '')

    if (id.startsWith('mem:')) {
      const idx = Number(id.slice(4))
      const list = LogEmailDriver.captured()
      const entry = list[idx]
      if (!entry) return { error: 'Email not found in memory store' }

      return {
        id,
        from: formatAddress(entry.from),
        to: formatAddress(entry.to),
        cc: formatAddress(entry.cc),
        bcc: formatAddress(entry.bcc),
        subject: entry.subject,
        sent_at: entry.sentAt.toISOString(),
        html: entry.rendered?.html ?? entry.html ?? '',
        text: entry.rendered?.text ?? entry.text ?? '',
      }
    }

    if (id.startsWith('disk:')) {
      // Reject path traversal — only accept the basename, no slashes.
      const raw = id.slice(5)
      const safe = basename(raw)
      if (safe !== raw) return { error: 'Invalid email id' }

      const dir = process.env.LOG_MAIL_DIR || logsPath('mail')
      try {
        // Re-list to confirm the file exists in the inbox directory.
        const names = await readdir(dir)
        if (!names.includes(safe)) return { error: 'Email not found on disk' }

        const body = await readFile(join(dir, safe), 'utf8')
        const headerMatch = body.match(/<!--([\s\S]*?)-->/)
        const header = headerMatch?.[1] || ''
        const grab = (label: string) => {
          const m = header.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'))
          return (m?.[1] || '').trim()
        }
        const visible = body.replace(/<!--[\s\S]*?-->/, '').trim()

        return {
          id,
          from: grab('From'),
          to: grab('To'),
          cc: grab('Cc'),
          bcc: grab('Bcc'),
          subject: grab('Subject') || safe.replace(/\.html$/, ''),
          sent_at: (header.match(/at\s+([^\n]+)/)?.[1] || '').trim(),
          html: visible,
          text: '',
        }
      }
      catch {
        return { error: 'Email not found on disk' }
      }
    }

    return { error: 'Unknown email id format' }
  },
})
