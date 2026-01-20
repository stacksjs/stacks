export * from './handler'
export * from './http'
export * from './model'
export * from './utils'

// Result type exports
export type {
  Err,
  Ok,
  Result,
  ResultAsync,
} from 'ts-error-handling'

export {
  err,
  fromPromise,
  ok,
} from 'ts-error-handling'

// Error page exports (Ignition-style)
export type {
  CodeSnippet,
  EnvironmentContext,
  ErrorPageConfig,
  ErrorPageData,
  HttpError as HttpErrorInfo,
  HttpStatusCode,
  QueryInfo,
  RequestContext,
  RoutingContext,
  StackFrame,
} from 'ts-error-handling'

export {
  createErrorHandler,
  ERROR_PAGE_CSS,
  ErrorHandler as ErrorPageHandler,
  errorResponse,
  HTTP_ERRORS,
  renderError,
  renderErrorPage,
  renderProductionErrorPage,
} from 'ts-error-handling'
