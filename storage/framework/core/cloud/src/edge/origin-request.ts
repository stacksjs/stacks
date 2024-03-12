const config = {
  suffix: '.html',
  appendToDirs: 'index.html',
  removeTrailingSlash: false,
}

const regexSuffixless = /\/[^/.]+$/ // e.g. "/some/page" but not "/", "/some/" or "/some.jpg"
const regexTrailingSlash = /.+\/$/ // e.g. "/some/" or "/some/page/" but not root "/"

// TODO: need to improve types here
export function handler(event: any, context: any, callback: any) {
  const { request } = event.Records[0].cf
  const { uri } = request
  const { suffix, appendToDirs } = config

  // Append ".html" to origin request
  if (suffix && uri.match(regexSuffixless)) {
    request.uri = uri + suffix
    callback(null, request)
    return
  }

  // Append "index.html" to origin request
  if (appendToDirs && uri.match(regexTrailingSlash)) {
    request.uri = uri + appendToDirs
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
