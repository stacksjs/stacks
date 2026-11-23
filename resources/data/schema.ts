/**
 * Structured data the inner pages share.
 *
 * Built as a string here, in TypeScript, so the `@`-prefixed schema.org keys
 * (`@context`, `@type`) never pass through the stx directive scanner, which
 * reads an `@word` in a template as a directive. A page hands the result to
 * the head partial as `jsonLd`, which emits it raw.
 */

const site = 'https://stacksjs.com'

export interface Crumb {
  name: string
  /** Site-relative, as the page's canonical path is. */
  path: string
}

/**
 * The trail a page already prints above its heading (Features, then the
 * feature), as a BreadcrumbList. It describes what a visitor can see and
 * nothing else, which is the condition for a search engine to show the trail
 * in place of the bare URL.
 */
export function breadcrumbJsonLd(trail: Crumb[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': trail.map((crumb, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': crumb.name,
      'item': `${site}${crumb.path}`,
    })),
  })
}
