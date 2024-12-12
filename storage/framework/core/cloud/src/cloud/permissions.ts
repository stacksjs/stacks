import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import { string } from '@stacksjs/strings'
import { aws_iam as iam, SecretValue } from 'aws-cdk-lib'

export interface PermissionsStackProps extends NestedCloudProps {
  //
}

export class PermissionsStack {
  constructor(scope: Construct) {
    const teamName = config.team.name
    const users = config.team.members
    const password = env.AWS_DEFAULT_PASSWORD || string.random()

    for (const name in users) {
      // const userEmail = users[userName]
      const id = `User${string.pascalCase(teamName)}${string.pascalCase(name)}`
      const userName = string.slug(`${teamName}-${name}`)
      const user = new iam.User(scope, id, {
        userName,
        password: SecretValue.unsafePlainText(password),
        passwordResetRequired: true,
      })

      user.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

      // TODO: email the userEmail their credentials
    }
  }
}
