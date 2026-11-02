import { AsyncLocalStorage } from 'node:async_hooks'

interface MessageObject { message: string, value: string, field: string }
interface ValidationReport { messages: MessageObject[] }
const key = Symbol.for('stacks.validation.reportStorage')
const reports = ((globalThis as Record<symbol, unknown>)[key] ??= new AsyncLocalStorage<ValidationReport>()) as AsyncLocalStorage<ValidationReport>

/** Called synchronously before a validation operation's first await. */
export function beginValidation(): void {
  reports.enterWith({ messages: [] })
}

/** Explicit scope for standalone tasks or adapters that report errors themselves. */
export function withValidationContext<T>(run: () => T): T {
  return reports.run({ messages: [] }, run)
}

export function reportError(errors: MessageObject[]): void {
  if (!reports.getStore()) beginValidation()
  reports.getStore()!.messages = errors.map(error => ({ ...error }))
}

export function getErrors(): MessageObject[] {
  return reports.getStore()?.messages.map(error => ({ ...error })) ?? []
}
