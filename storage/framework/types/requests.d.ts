export interface ProjectRequestType extends RequestInstance {
      validate(): void
      get(key: 'id' |'name' |'description' |'url' |'status'): string | number | undefined;
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
      get(key: 'id' |'email'): string | number | undefined;
       id: number
 email: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface AccessTokenRequestType extends RequestInstance {
      validate(): void
      get(key: 'id' |'name' |'token' |'plainTextToken' |'abilities'): string | number | undefined;
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
      get(key: 'id' |'name' |'companyName' |'email' |'billingEmail' |'status' |'description' |'path' |'isPersonal'): string | number | undefined;
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
      get(key: 'id' |'subscribed'): string | number | undefined;
       id: number
 subscribed: boolean
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export interface DeploymentRequestType extends RequestInstance {
      validate(): void
      get(key: 'id' |'commitSha' |'commitMessage' |'branch' |'status' |'executionTime' |'deployScript' |'terminalOutput'): string | number | undefined;
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
      get(key: 'id' |'name' |'email' |'jobTitle' |'password'): string | number | undefined;
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
      get(key: 'id' |'title' |'body'): string | number | undefined;
       id: number
 title: string
      body: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | UserRequestType | PostRequestTypequestType | UserRequestType | PostRequestType