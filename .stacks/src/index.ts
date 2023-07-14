// the reason we disable the eslint rule here is that those "same-named exports" will never be bundled together
// all we do here is just import all the packages directly so that the vite plugin can generate all the
// auto imports
export * from '../core/actions/src'
export * from '../core/ai/src'
export * from '../core/alias/src'
export * from '../core/analytics/src'
// eslint-disable-next-line import/export
export * from '../core/arrays/src'
export * from '../core/auth/src'
export * as buddy from '../core/buddy/src'
export * from '../core/build/src'
// eslint-disable-next-line import/export
export * from '../core/cache/src'
// eslint-disable-next-line import/export
export * from '../core/chat/src'
export * from '../core/cli/src'
// eslint-disable-next-line import/export
export * from '../core/cloud/src'
export * from '../core/collections/src'
export * as config from '../core/config/src'
export * from '../core/database/src'
export * from '../core/datetime/src'
export * from '../core/desktop/src'
export * from '../core/development/src'
export * from '../core/dns/src'
export { default as docsConfig } from '../core/docs/src'
// eslint-disable-next-line import/export
export * from '../core/email/src'
export * from '../core/error-handling/src'
export * from '../core/events/src'
export * from '../core/faker/src'
export * from '../core/git/src'
export * from '../core/health/src'
export * from '../core/lint/src'
// eslint-disable-next-line import/export
export * from '../core/logging/src'
export * from '../core/notifications/src'
export * from '../core/objects/src'
export * from '../core/orm/src'
export * from '../core/path/src'
export * from '../core/payments/src'
export * from '../core/push/src'
export * from '../core/query-builder/src'
export * from '../core/queue/src'
export * from '../core/realtime/src'
export * from '../core/repl/src'
export * from '../core/router/src'
export * from '../core/scheduler/src'
// eslint-disable-next-line import/export
export * from '../core/search-engine/src'
export * from '../core/security/src'
export * from '../core/server/src'
export * from '../core/signals/src'
export * from '../core/slug/src'
// eslint-disable-next-line import/export
export * from '../core/sms/src'
// eslint-disable-next-line import/export
export * from '../core/storage/src'
// @ts-expect-error we are not exporting the types here — must be a Vine related issue?
export * from '../core/strings/src'
export * from '../core/testing/src'
export * from '../core/types/src'
export * from '../core/ui/src'
// eslint-disable-next-line import/export
export * from '../core/utils/src'
// @ts-expect-error we are not exporting the types here — must be a Vine related issue
export * from '../core/validation/src'
