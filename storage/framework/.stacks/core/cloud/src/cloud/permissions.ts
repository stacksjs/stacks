import { SecretValue, aws_iam as iam } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { config } from '@stacksjs/config'
import { string } from '@stacksjs/strings'
import { env } from '@stacksjs/env'
import type { NestedCloudProps } from '../types'

export interface PermissionsStackProps extends NestedCloudProps {
  //
}

export class PermissionsStack {
  constructor(scope: Construct) {
    const teamName = config.team.name
    const users = config.team.members
    const password = env.AWS_DEFAULT_PASSWORD || string.random()

    for (const userName in users) {
      // const userEmail = users[userName]
      const name = `User${string.pascalCase(teamName)}${string.pascalCase(userName)}`
      const user = new iam.User(scope, name, {
        userName,
        password: SecretValue.unsafePlainText(password),
        passwordResetRequired: true,
      })

      user.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

      // TODO: email the userEmail their credentials
    }
  }
}
