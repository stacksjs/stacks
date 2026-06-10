/**
 * Test Error Action
 *
 * Browse /test-error for a visual index of every error scenario.
 * Append ?type=<scenario> to trigger a specific exception.
 */

import type { EnhancedRequest } from 'bun-router'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

class DatabaseError extends Error {
  constructor(message: string, public query?: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const ERROR_SCENARIOS = [
  {
    type: 'database',
    title: 'DatabaseError',
    description: 'Deep call stack with a missing-table SQL error — shows code snippets and collapsed framework frames.',
    status: 500,
  },
  {
    type: 'validation',
    title: 'ValidationError',
    description: '422-style validation failure with a field hint.',
    status: 422,
  },
  {
    type: 'auth',
    title: 'AuthenticationError',
    description: 'Unauthorized access with an expired token message.',
    status: 401,
  },
  {
    type: 'notfound',
    title: 'NotFoundError',
    description: 'Missing resource — useful for testing 404-style traces.',
    status: 404,
  },
  {
    type: 'generic',
    title: 'Error',
    description: 'Plain unhandled exception with a minimal stack.',
    status: 500,
  },
] as const

function innerDatabaseCall(): never {
  throw new DatabaseError(
    `SQLSTATE[42S02]: Base table or view not found: 1146 Table 'app.nonexistent_table' doesn't exist`,
    `SELECT * FROM nonexistent_table WHERE id = 1`,
  )
}

function queryBuilder() {
  return innerDatabaseCall()
}

function repository() {
  return queryBuilder()
}

function service() {
  return repository()
}

async function renderPreviewIndex(requestUrl: string): Promise<Response> {
  const base = new URL(requestUrl)
  base.search = ''

  const scenarios = ERROR_SCENARIOS.map(s => ({
    ...s,
    href: `${base.pathname}?type=${s.type}`,
  }))

  const viewsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources/views/errors')
  const { renderTemplate } = await import('@stacksjs/stx')
  const body = await renderTemplate(join(viewsRoot, 'tester.stx'), {
    context: { scenarios },
    injectCSS: true,
    templateOnly: true,
    processClientScripts: false,
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error Page Tester — Stacks</title>
</head>
<body class="min-h-dvh antialiased font-sans dark:text-white bg-neutral-50 dark:bg-neutral-900 scheme-light-dark">
  ${body}
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export default {
  name: 'Test Error Action',
  description: 'Demonstrates the Laravel-style error page',

  async handle(request: EnhancedRequest): Promise<Response> {
    // Production short-circuits to 404 so even an accidental or userland
    // re-registration can't expose the exception generator in prod —
    // mirrors the mailable-preview guard in defaults/routes/core.ts
    // (stacksjs/stacks#1900 A3; added for #1955). Production-only (not
    // the registration gate's local-env allowlist) so a deliberate
    // re-registration in staging still works.
    const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
    if (env === 'production')
      return new Response('Not Found', { status: 404 })

    const url = new URL(request.url)
    const errorType = url.searchParams.get('type')

    if (!errorType) {
      return await renderPreviewIndex(request.url)
    }

    switch (errorType) {
      case 'validation':
        throw new ValidationError('The email field must be a valid email address.', 'email')

      case 'auth': {
        const authError = new Error('Unauthorized: Invalid or expired authentication token.')
        authError.name = 'AuthenticationError'
        throw authError
      }

      case 'notfound': {
        const notFoundError = new Error('Resource not found: User with ID 42 does not exist.')
        notFoundError.name = 'NotFoundError'
        throw notFoundError
      }

      case 'generic':
        throw new Error('Something went wrong while processing your request.')

      case 'database':
      default:
        service()
    }

    return Response.json({ message: 'No error occurred' })
  },
}
