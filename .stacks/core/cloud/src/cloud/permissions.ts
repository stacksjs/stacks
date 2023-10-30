
  // manageUsers() {
  //   const teamName = config.team.name
  //   const users = config.team.members
  //   const password = env.AWS_DEFAULT_PASSWORD || string.random()

  //   for (const userName in users) {
  //     // const userEmail = users[userName]
  //     const name = `User${string.pascalCase(teamName)}${string.pascalCase(userName)}`
  //     const user = new iam.User(this, name, {
  //       userName,
  //       password: SecretValue.unsafePlainText(password),
  //       passwordResetRequired: true,
  //     })

  //     user.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

  //     // TODO: email the userEmail their credentials
  //   }
  // }
