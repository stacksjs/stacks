import { config } from '@stacksjs/config'

/** The configured application base for emailed authentication links. */
export function authLinkBase(): string {
  const configured = config.app.url?.trim()
  if (!configured)
    return `http://localhost:${process.env.PORT || '3000'}`

  // Stacks accepts both bare hosts and complete URLs. Do not prepend a second
  // scheme, discard a development port, or duplicate a trailing path slash.
  const base = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return base.replace(/\/+$/, '')
}
