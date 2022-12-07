import { ray } from '../src/index'

export default defineEventHandler(async () => {
  ray('foo bar test')

  return { status: 'success' }
})

