import { Request } from '../core/router/src/request'
import type { VineType } from '@stacksjs/types'

interface ValidationField {
    rule: VineType
    message: Record<string, string>
  }

interface CustomAttributes {
    [key: string]: ValidationField
  }

interface RequestDataProject {
       id?: number
 name: string
      description: string
      url: string
      status: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface ProjectRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name'): string
 get(key: 'description'): string
 get(key: 'url'): string
 get(key: 'status'): string

      all(): RequestDataProject
       id?: number
 name: string
      description: string
      url: string
      status: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataSubscriberEmail {
       id?: number
 email: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface SubscriberEmailRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'email'): string

      all(): RequestDataSubscriberEmail
       id?: number
 email: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataAccessToken {
       id?: number
 name: string
      token: string
      plainTextToken: string
      abilities: string[]
      team_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface AccessTokenRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name'): string
 get(key: 'token'): string
 get(key: 'plainTextToken'): string
 get(key: 'abilities'): string[]
 get(key: 'team_id'): string 

      all(): RequestDataAccessToken
       id?: number
 name: string
      token: string
      plainTextToken: string
      abilities: string[]
      team_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataTeam {
       id?: number
 name: string
      companyName: string
      email: string
      billingEmail: string
      status: string
      description: string
      path: string
      isPersonal: boolean
      accesstoken_id: number
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface TeamRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name'): string
 get(key: 'companyName'): string
 get(key: 'email'): string
 get(key: 'billingEmail'): string
 get(key: 'status'): string
 get(key: 'description'): string
 get(key: 'path'): string
 get(key: 'isPersonal'): boolean
 get(key: 'accesstoken_id'): string 
 get(key: 'user_id'): string 

      all(): RequestDataTeam
       id?: number
 name: string
      companyName: string
      email: string
      billingEmail: string
      status: string
      description: string
      path: string
      isPersonal: boolean
      accesstoken_id: number
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataSubscriber {
       id?: number
 subscribed: boolean
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface SubscriberRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'subscribed'): boolean
 get(key: 'user_id'): string 

      all(): RequestDataSubscriber
       id?: number
 subscribed: boolean
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataDeployment {
       id?: number
 commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface DeploymentRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'commitSha'): string
 get(key: 'commitMessage'): string
 get(key: 'branch'): string
 get(key: 'status'): string
 get(key: 'executionTime'): number
 get(key: 'deployScript'): string
 get(key: 'terminalOutput'): string
 get(key: 'user_id'): string 

      all(): RequestDataDeployment
       id?: number
 commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataRelease {
       id?: number
 version: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface ReleaseRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'version'): string

      all(): RequestDataRelease
       id?: number
 version: string
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataUser {
       id?: number
 name: string
      email: string
      jobTitle: string
      password: string
      team_id: number
      deployment_id: number
      post_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface UserRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name'): string
 get(key: 'email'): string
 get(key: 'jobTitle'): string
 get(key: 'password'): string
 get(key: 'team_id'): string 
 get(key: 'deployment_id'): string 
 get(key: 'post_id'): string 

      all(): RequestDataUser
       id?: number
 name: string
      email: string
      jobTitle: string
      password: string
      team_id: number
      deployment_id: number
      post_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

interface RequestDataPost {
       id?: number
 title: string
      body: string
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }
export interface PostRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'title'): string
 get(key: 'body'): string
 get(key: 'user_id'): string 

      all(): RequestDataPost
       id?: number
 title: string
      body: string
      user_id: number
     created_at?: string
      updated_at?: string
      deleted_at?: string
    }

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestType