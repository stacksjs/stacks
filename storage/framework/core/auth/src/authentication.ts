import User from '../../../orm/src/models/User'

interface Credentials {
  password: string
  [key: string]: string
}

const authConfig = { username: 'email', password: 'password' }

export async function attempt(credentials: Credentials, remember?: boolean) {
  const exists = await User.where(authConfig.username, credentials.email)
    .where(authConfig.password, credentials.password)
    .first()

  if (exists) {
    return {
      apiToken: '132131232141231',
      message: 'success',
    }
  }
}
