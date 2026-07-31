import type { RequestInstance } from '@stacksjs/types'
import { response } from '@stacksjs/router'

export type CommerceIdentifierResult =
  | { id: number, error?: never }
  | { id?: never, error: Response }

export function commerceIdentifier(
  request: RequestInstance,
  resource: string,
): CommerceIdentifierResult {
  const id = Number(request.getParam('id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    return {
      error: response.json({ message: `${resource} id must be a positive integer.` }, 422),
    }
  }
  return { id }
}

export function commerceNotFound(resource: string, id: number): Response {
  return response.json({ message: `${resource} ${id} was not found.` }, 404)
}
