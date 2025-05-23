import type { UserJsonResponse } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { Authentication } from './authentication'

export type AuthUser = UserJsonResponse

export class User {
  private static currentUser: AuthUser | undefined = undefined

  public static async getCurrentUser(): Promise<AuthUser | undefined> {
    if (this.currentUser)
      return this.currentUser

    const token = request.bearerToken()
    if (!token)
      return undefined

    this.currentUser = await Authentication.getUserFromToken(token)
    return this.currentUser
  }

  public static async check(): Promise<boolean> {
    return !!(await this.getCurrentUser())
  }

  public static async id(): Promise<number | undefined> {
    return (await this.getCurrentUser())?.id
  }

  public static async email(): Promise<string | undefined> {
    return (await this.getCurrentUser())?.email
  }

  public static async name(): Promise<string | undefined> {
    return (await this.getCurrentUser())?.name
  }

  public static async isAuthenticated(): Promise<boolean> {
    return await this.check()
  }

  public static async logout(): Promise<void> {
    await Authentication.logout()
    this.currentUser = undefined
  }

  public static async refresh(): Promise<void> {
    this.currentUser = undefined
    await this.getCurrentUser()
  }
}
