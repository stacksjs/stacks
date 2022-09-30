import bcrypt from 'bcrypt'
import { bcrypt as bcryptOptions } from '../../../config/hashing'

async function make(password: string) {
  const salt = await bcrypt.genSalt(bcryptOptions.rounds)
  return await bcrypt.hash(password, salt)
}

export default { make }
