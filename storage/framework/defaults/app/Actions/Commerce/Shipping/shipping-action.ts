import type { RequestInstance } from '@stacksjs/types'
import { response } from '@stacksjs/router'

export type ShippingIdentifierResult =
  | { id: number, error?: never }
  | { id?: never, error: Response }

export function shippingIdentifier(
  request: RequestInstance,
  resource: string,
): ShippingIdentifierResult {
  const id = Number(request.getParam('id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    return {
      error: response.json({ message: `${resource} id must be a positive integer.` }, 422),
    }
  }
  return { id }
}

export function shippingNotFound(resource: string, id: number): Response {
  return response.json({ message: `${resource} ${id} was not found.` }, 404)
}
