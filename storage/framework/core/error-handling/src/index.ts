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

// Error page exports (Ignition-style) - local implementation
export type {
  CodeSnippet,
  EnvironmentContext,
  ErrorPageConfig,
  ErrorPageData,
  HttpError as HttpErrorInfo,
  HttpStatusCode,
  JobContext,
  QueryInfo,
  RequestContext,
  RoutingContext,
  StackFrame,
  UserContext,
} from './error-page'

export {
  createErrorHandler,
  ERROR_PAGE_CSS,
  ErrorPageHandler,
  errorResponse,
  HTTP_ERRORS,
  renderError,
  renderErrorPage,
  renderProductionErrorPage,
} from './error-page'
