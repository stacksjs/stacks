export interface ProjectRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'name' |'description' |'url' |'status'): number | string | null
       id: number
 name: string
      description: string
      url: string
      status: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface SubscriberEmailRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'email'): number | string | null
       id: number
 email: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface AccessTokenRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'name' |'token' |'plainTextToken' |'abilities'): number | string | null
       id: number
 name: string
      token: string
      plainTextToken: string
      abilities: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface TeamRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'name' |'companyName' |'email' |'billingEmail' |'status' |'description' |'path' |'isPersonal'): number | string | null
       id: number
 name: string
      companyName: string
      email: string
      billingEmail: string
      status: string
      description: string
      path: string
      isPersonal: boolean
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface SubscriberRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'subscribed'): number | string | null
       id: number
 subscribed: boolean
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface DeploymentRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'commitSha' |'commitMessage' |'branch' |'status' |'executionTime' |'deployScript' |'terminalOutput'): number | string | null
       id: number
 commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface UserRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'name' |'email' |'jobTitle' |'password'): number | string | null
       id: number
 name: string
      email: string
      jobTitle: string
      password: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface PostRequestType extends RequestInstance {
      validate(): void
      getParam(key: 'id' |'title' |'body'): number | string | null
       id: number
 title: string
      body: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

