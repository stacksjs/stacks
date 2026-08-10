import type { RequestInstance } from '@stacksjs/types'
import { isEmail, isURL } from '@stacksjs/strings'
import { str } from './content-input'

export interface AuthorInput {
  name: string
  email: string
  bio: string
  avatar: string
}

// eslint-disable-next-line
export function parseAuthorInput(inputRequest: RequestInstance): { data: AuthorInput } | { message: string } {
  const data = {
    name: str(inputRequest.get('name')).trim(),
    email: str(inputRequest.get('email')).trim(),
    bio: str(inputRequest.get('bio')).trim(),
    avatar: str(inputRequest.get('avatar')).trim(),
  }

  if (data.name.length < 5 || data.name.length > 255)
    return { message: 'Name must be between 5 and 255 characters.' }

  if (!isEmail(data.email))
    return { message: 'A valid email is required.' }

  if (data.bio.length > 500)
    return { message: 'Bio must have a maximum of 500 characters.' }

  if (data.avatar && !isURL(data.avatar))
    return { message: 'Avatar must be a valid HTTP or HTTPS URL.' }

  return { data }
}
