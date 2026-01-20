/**
 * Test Error Action
 *
 * This action is used to test the Ignition-style error pages.
 * Visit /api/test-error to see the error page in action.
 */

import type { EnhancedRequest } from 'bun-router'

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

// Simulate a deep call stack
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

export default {
  name: 'Test Error Action',
  description: 'Demonstrates the Ignition-style error page',

  async handle(request: EnhancedRequest): Promise<Response> {
    const url = new URL(request.url)
    const errorType = url.searchParams.get('type') || 'database'

    switch (errorType) {
      case 'validation':
        throw new ValidationError('The email field must be a valid email address.', 'email')

      case 'auth':
        const authError = new Error('Unauthorized: Invalid or expired authentication token.')
        authError.name = 'AuthenticationError'
        throw authError

      case 'notfound':
        const notFoundError = new Error('Resource not found: User with ID 42 does not exist.')
        notFoundError.name = 'NotFoundError'
        throw notFoundError

      case 'generic':
        throw new Error('Something went wrong while processing your request.')

      case 'database':
      default:
        // This will create a deep stack trace
        service()
    }

    // This should never be reached
    return Response.json({ message: 'No error occurred' })
  },
}
