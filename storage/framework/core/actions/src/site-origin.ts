/**
 * The one answer to "which origin goes into an absolute link", shared by the
 * blog's feed and sitemap and the site-wide `/sitemap.xml` and `/robots.txt`
 * (see ./seo.ts), so the two cannot disagree about what counts as usable.
 */

/**
 * An origin safe to bake into absolute links, or '' when it is not usable.
 *
 * The deploy-time build takes its baseUrl from `APP_URL`, which is not always
 * plaintext: a release that loads an env file it cannot decrypt leaves the
 * literal ciphertext there, and prefixing it with `https://` produced feed and
 * sitemap URLs like `https://encrypted:tLq7…==/blog/introducing-stacks` on the
 * live site. Anything that is not a parseable http(s) origin with a dotted
 * hostname is rejected here so callers fall back to the configured site url.
 */
export function usableOrigin(value?: string): string {
  if (!value)
    return ''

  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`)

    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return ''
    if (!url.hostname.includes('.') || !/^[a-z0-9.-]+$/i.test(url.hostname))
      return ''

    return url.origin
  }
  catch {
    return ''
  }
}
