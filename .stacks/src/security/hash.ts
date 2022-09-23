import bcrypt from 'bcrypt'

async function make(password: string) {
  const salt = await bcrypt.genSalt(10)
  return await bcrypt.hash(password, salt)
}

export default { make }
