import type { Validator } from '@stacksjs/ts-validation'
import { MessageProvider, setCustomMessages } from '@stacksjs/ts-validation'
import { HttpError } from '@stacksjs/error-handling/http-error'
import { objectWithContext } from './object-with-context'

/**
 * Shape of a validation rule set understood by `validate()`. Each key maps to
 * either a raw validator or the model-attribute form with a custom message.
 */
export type ValidationRules = Record<string, Validator<any> | { rule: Validator<any>, message?: string | Record<string, string> }>

interface RequestLike {
  all?: () => Record<string, unknown> | Promise<Record<string, unknown>>
  jsonBody?: Record<string, unknown>
  formBody?: Record<string, unknown>
  query?: Record<string, unknown>
  params?: Record<string, unknown>
  url?: string
}

async function gatherRequestInput(source: RequestLike | Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!source || typeof source !== 'object') return {}
  if (typeof (source as RequestLike).all === 'function') {
    const all = (source as RequestLike).all!()
    return all instanceof Promise ? await all : all
  }

  const request = source as RequestLike
  const input: Record<string, unknown> = {}
  if (request.url) {
    try {
      const parsed = new URL(request.url)
      parsed.searchParams.forEach((value, key) => { input[key] = value })
    }
    catch { /* Ignore malformed URLs. */ }
  }
  if (request.query && typeof request.query === 'object') Object.assign(input, request.query)
  if (request.jsonBody && typeof request.jsonBody === 'object') Object.assign(input, request.jsonBody)
  if (request.formBody && typeof request.formBody === 'object') Object.assign(input, request.formBody)
  if (request.params && typeof request.params === 'object') Object.assign(input, request.params)
  if (Object.keys(input).length === 0 && !('all' in source) && !('jsonBody' in source))
    return source as Record<string, unknown>
  return input
}

/**
 * Validate request input against schema rules and return the cleaned payload.
 *
 * Throws `HttpError(422, 'Validation failed', { errors })` when a rule fails.
 */
export async function validate<T = Record<string, unknown>>(
  request: RequestLike | Record<string, unknown>,
  rules: ValidationRules,
): Promise<T> {
  const input = await gatherRequestInput(request)
  const ruleObject: Record<string, Validator<any>> = {}
  const messageObject: Record<string, string> = {}

  for (const [field, definition] of Object.entries(rules)) {
    if (!definition) continue
    if (typeof (definition as { rule?: unknown }).rule === 'object' || typeof (definition as { rule?: unknown }).rule === 'function') {
      ruleObject[field] = (definition as { rule: Validator<any> }).rule
      const message = (definition as { message?: string | Record<string, string> }).message
      if (typeof message === 'string') {
        messageObject[`${field}.default`] = message
      }
      else if (message && typeof message === 'object') {
        for (const [key, value] of Object.entries(message)) messageObject[`${field}.${key}`] = value
      }
    }
    else {
      ruleObject[field] = definition as Validator<any>
    }
  }

  try {
    if (Object.keys(messageObject).length > 0)
      setCustomMessages(new MessageProvider(messageObject))

    const result = await objectWithContext(ruleObject).validate(input)
    if (!result.valid) {
      const errors = normalizeValidationErrors(result.errors)
      throw new HttpError(422, 'Validation failed', { errors })
    }

    const validated = (result as { value?: unknown }).value ?? input
    return validated as T
  }
  catch (error: unknown) {
    if (isHttpErrorLike(error)) throw error
    throw new HttpError(500, getErrorMessage(error) || 'An unexpected validation error occurred')
  }
}

function isHttpErrorLike(error: unknown): error is Error & { status: number } {
  return error instanceof HttpError
    || (error instanceof Error
      && typeof (error as Error & { status?: unknown }).status === 'number')
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'number' || typeof error === 'boolean') return String(error)
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message
  if (error == null) return 'Unknown error'
  try {
    return String(error)
  }
  catch {
    return 'Unknown error'
  }
}

function normalizeValidationErrors(value: unknown): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue
      const field = typeof entry.field === 'string' ? entry.field : '_'
      const message = typeof entry.message === 'string' ? entry.message : 'Validation failed'
      ;(errors[field] ??= []).push(message)
    }
    return errors
  }

  if (!value || typeof value !== 'object') return errors
  for (const [field, entries] of Object.entries(value)) {
    const list = Array.isArray(entries) ? entries : [entries]
    for (const entry of list) {
      const message = typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof entry.message === 'string'
          ? entry.message
          : 'Validation failed'
      ;(errors[field] ??= []).push(message)
    }
  }
  return errors
}
