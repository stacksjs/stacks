const config = {
  suffix: '.html',
  removeTrailingSlash: false,
}

const regexSuffixless = /\/[^/.]+$/ // e.g. "/some/page" but not "/", "/some/" or "/some.jpg"
const regexTrailingSlash = /.+\/$/ // e.g. "/some/" or "/some/page/" but not root "/"

/**
 * The slice of a CloudFront origin-request event this handler touches.
 *
 * Lambda@Edge hands the function an event, a context and a callback, and all
 * three were `any` behind a `TODO: narrow types here`. Only `uri` is read and
 * only `uri` is written, so that is what is described - a handler this small
 * does not need the whole AWS event surface to be checked.
 */
interface CloudFrontRequest {
  uri: string
  method?: string
  querystring?: string
  headers?: Record<string, Array<{ key?: string, value: string }>>
}

interface CloudFrontResponse {
  status: string
  statusDescription?: string
  headers?: Record<string, Array<{ key?: string, value: string }>>
}

interface CloudFrontOriginRequestEvent {
  Records: Array<{ cf: { request: CloudFrontRequest } }>
}

type CloudFrontCallback = (_error: Error | null, _result?: CloudFrontRequest | CloudFrontResponse) => void

export function handler(event: CloudFrontOriginRequestEvent, _context: unknown, callback: CloudFrontCallback): void {
  // `Records[0]` is `… | undefined` once the event has a type. CloudFront
  // always sends exactly one record, but reading it blind would have thrown a
  // TypeError inside the edge function - the one place where a stack trace is
  // hardest to get at - rather than failing the request cleanly.
  const record = event.Records[0]

  if (!record) {
    callback(new Error('CloudFront origin-request event carried no records'))
    return
  }

  const { request } = record.cf
  const { uri } = request
  const { suffix } = config

  if (uri === '/') {
    request.uri = '/index.html'
    callback(null, request)
    return
  }

  // Append ".html" to origin request
  if (uri.match(regexSuffixless)) {
    request.uri = uri + suffix
    callback(null, request)
    return
  }

  // Remove trailing slash and append ".html" to origin request
  if (uri.match(regexTrailingSlash)) {
    request.uri = `${uri.slice(0, -1)}.html`
    callback(null, request)
    return
  }

  // Redirect (301) non-root requests ending in "/" to URI without trailing slash
  // if (removeTrailingSlash && uri.match(/.+\/$/)) {
  //   const response = {
  //     // body: '',
  //     // bodyEncoding: 'text',
  //     headers: {
  //       location: [{
  //         key: 'Location',
  //         value: uri.slice(0, -1),
  //       }],
  //     },
  //     status: '301',
  //     statusDescription: 'Moved Permanently',
  //   }
  //   callback(null, response)
  //   return
  // }

  // If nothing matches, return request unchanged
  callback(null, request)
}
