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
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface ProjectRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name' | 'description' | 'url' | 'status'): string

      all(): RequestDataProject
       id?: number
 name: string
      description: string
      url: string
      status: string
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataSubscriberEmail {
       id?: number
 email: string
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface SubscriberEmailRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'email'): string

      all(): RequestDataSubscriberEmail
       id?: number
 email: string
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataAccessToken {
       id?: number
 name: string
      token: string
      plain_text_token: string
      abilities: string[]
      team_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface AccessTokenRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name' | 'token' | 'plain_text_token'): string
 get(key: 'abilities'): string[]
 get(key: 'team_id'): string 

      all(): RequestDataAccessToken
       id?: number
 name: string
      token: string
      plain_text_token: string
      abilities: string[]
      team_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataTeam {
       id?: number
 name: string
      company_name: string
      email: string
      billing_email: string
      status: string
      description: string
      path: string
      is_personal: boolean
      accesstoken_id: number
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface TeamRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name' | 'company_name' | 'email' | 'billing_email' | 'status' | 'description' | 'path'): string
 get(key: 'is_personal'): boolean
 get(key: 'accesstoken_id'): string 
 get(key: 'user_id'): string 

      all(): RequestDataTeam
       id?: number
 name: string
      company_name: string
      email: string
      billing_email: string
      status: string
      description: string
      path: string
      is_personal: boolean
      accesstoken_id: number
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataSubscriber {
       id?: number
 subscribed: boolean
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
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
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataDeployment {
       id?: number
 commit_sha: string
      commit_message: string
      branch: string
      status: string
      execution_time: number
      deploy_script: string
      terminal_output: string
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface DeploymentRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'commit_sha' | 'commit_message' | 'branch' | 'status' | 'deploy_script' | 'terminal_output'): string
 get(key: 'execution_time'): number
 get(key: 'user_id'): string 

      all(): RequestDataDeployment
       id?: number
 commit_sha: string
      commit_message: string
      branch: string
      status: string
      execution_time: number
      deploy_script: string
      terminal_output: string
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataRelease {
       id?: number
 version: string
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface ReleaseRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'version'): string

      all(): RequestDataRelease
       id?: number
 version: string
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataUser {
       id?: number
 name: string
      email: string
      job_title: string
      password: string
      team_id: number
      deployment_id: number
      post_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface UserRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'name' | 'email' | 'job_title' | 'password'): string
 get(key: 'team_id'): string 
 get(key: 'deployment_id'): string 
 get(key: 'post_id'): string 

      all(): RequestDataUser
       id?: number
 name: string
      email: string
      job_title: string
      password: string
      team_id: number
      deployment_id: number
      post_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

interface RequestDataPost {
       id?: number
 title: string
      body: string
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }
export interface PostRequestType extends Request {
      validate(attributes?: CustomAttributes): void
       get(key: 'id'): number
 get(key: 'title' | 'body'): string
 get(key: 'user_id'): string 

      all(): RequestDataPost
       id?: number
 title: string
      body: string
      user_id: number
     created_at?: Date
      updated_at?: Date
      deleted_at?: Date
    }

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestType