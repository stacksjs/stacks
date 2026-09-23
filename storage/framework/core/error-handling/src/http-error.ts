export class HttpError extends Error {
  /**
   * Optional structured payload that will be serialized into the JSON
   * error response (`{ error: message, details: ... }`). Used by validation
   * to attach the per-field error map so clients can render inline messages
   * instead of having to parse `JSON.stringify(errors)` out of `.message`.
   */
  public details?: unknown

  constructor(public status: number, message: string, details?: unknown) {
    super(message)
    // Name maps to the standard HTTP reason phrase so clients see
    // `{ "error": "Unauthorized" }` for 401, `"Forbidden"` for 403, etc.
    // Used to be the literal string "Server Error!" for every status,
    // which made every 4xx look like a 5xx in dashboards and logs.
    this.name = httpStatusName(status)
    if (details !== undefined) this.details = details
  }
}

function httpStatusName(status: number): string {
  switch (status) {
    case 400: return 'Bad Request'
    case 401: return 'Unauthorized'
    case 402: return 'Payment Required'
    case 403: return 'Forbidden'
    case 404: return 'Not Found'
    case 405: return 'Method Not Allowed'
    case 408: return 'Request Timeout'
    case 409: return 'Conflict'
    case 410: return 'Gone'
    case 413: return 'Payload Too Large'
    case 415: return 'Unsupported Media Type'
    case 422: return 'Unprocessable Entity'
    case 423: return 'Locked'
    case 425: return 'Too Early'
    case 426: return 'Upgrade Required'
    case 428: return 'Precondition Required'
    case 429: return 'Too Many Requests'
    case 431: return 'Request Header Fields Too Large'
    case 451: return 'Unavailable For Legal Reasons'
    case 500: return 'Internal Server Error'
    case 501: return 'Not Implemented'
    case 502: return 'Bad Gateway'
    case 503: return 'Service Unavailable'
    case 504: return 'Gateway Timeout'
    case 507: return 'Insufficient Storage'
    case 508: return 'Loop Detected'
    case 511: return 'Network Authentication Required'
    default: return status >= 400 && status < 500 ? 'Client Error' : 'Server Error'
  }
}
