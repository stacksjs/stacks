import User from '../../../orm/src/models/User'

interface Credentials {
  password: string | number | undefined
  [key: string]: string | number | undefined
}

const authConfig = { username: 'email', password: 'password' }

export async function attempt(credentials: Credentials, remember?: boolean) {
  const exists = await User.where(authConfig.username, credentials[authConfig.username])
    .where(authConfig.password, credentials[authConfig.password])
    .exists()

  if (exists) {
    return true
  }

  return false
}
