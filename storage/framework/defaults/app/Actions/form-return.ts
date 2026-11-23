/**
 * Sending a plain HTML form back to the page it came from.
 *
 * The public forms (newsletter signup, contact) post straight to the API with
 * no JavaScript in between. Answered with JSON, a visitor who submits one is
 * left on a page of raw `{"success":true,...}` with no way back but the back
 * button. A browser form post asks for HTML, so it gets a 303 back to the page
 * instead, with the outcome in the query string for that page to render. A
 * `fetch()` asks for anything (`Accept: *\/*`) and keeps getting JSON.
 */

/** Whether the request is a browser submitting a `<form>`, rather than a script. */
export function wantsFormRedirect(headers: Headers): boolean {
  const accept = headers.get('accept') || ''
  const type = headers.get('content-type') || ''
  const isForm = type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')
  return isForm && accept.includes('text/html')
}

/**
 * A same-site path, or null. Only a path is ever accepted, never a host: a
 * return address that could name another site would make this endpoint an
 * open redirect for anyone who can link to it.
 */
function sitePath(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const path = value.trim()
  // `//host` and `/\host` are both read as another origin by browsers.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(path))
    return null

  return path
}

/** The path, query and fragment of a Referer, or null when there is none. */
function refererPath(referer: string | null): string | null {
  if (!referer)
    return null

  try {
    const url = new URL(referer)
    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return null
  }
}

/**
 * Where to send the browser: the form's own `return` field when it names a
 * path on this site, else the page in the Referer, else the home page, with
 * `?<param>=<outcome>` set on it. A fragment in `return` is kept, so a page
 * with two forms can bring the reader back to the one they used.
 */
export function formReturnLocation(options: { target?: unknown, referer?: string | null, param: string, outcome: string }): string {
  const path = sitePath(options.target) ?? sitePath(refererPath(options.referer ?? null)) ?? '/'
  const url = new URL(path, 'http://return.invalid')
  url.searchParams.set(options.param, options.outcome)
  return `${url.pathname}${url.search}${url.hash}`
}
