import type { RequestInstance } from '@stacksjs/types'
import { str } from './content-input'

export interface PageInput {
  title: string
  template: string
}

export function parsePublished(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

// eslint-disable-next-line
export function parsePageInput(inputRequest: RequestInstance): { data: PageInput } | { message: string } {
  const data = {
    title: str(inputRequest.get('title')).trim(),
    template: str(inputRequest.get('template')).trim() || 'default',
  }

  if (data.title.length < 3 || data.title.length > 255)
    return { message: 'Title must be between 3 and 255 characters.' }

  if (data.template.length < 3)
    return { message: 'Template must have at least 3 characters.' }

  return { data }
}
