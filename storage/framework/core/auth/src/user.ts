import type { UserJsonResponse, UserModel } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { Auth } from './authentication'

export type AuthUser = UserJsonResponse

let currentUser: UserModel | undefined

export async function getCurrentUser(): Promise<UserModel | undefined> {
  if (currentUser)
    return currentUser

  const token = request.bearerToken()
  if (!token)
    return undefined

  currentUser = await Auth.getUserFromToken(token)
  return currentUser
}

export async function check(): Promise<boolean> {
  return !!(await getCurrentUser())
}

export async function id(): Promise<number | undefined> {
  return (await getCurrentUser())?.id
}

export async function email(): Promise<string | undefined> {
  return (await getCurrentUser())?.email
}

export async function name(): Promise<string | undefined> {
  return (await getCurrentUser())?.name
}

export async function isAuthenticated(): Promise<boolean> {
  return await check()
}

export async function logout(): Promise<void> {
  await Auth.logout()
  currentUser = undefined
}

export async function refresh(): Promise<void> {
  currentUser = undefined
  await getCurrentUser()
}
