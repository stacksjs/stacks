import { ray } from '..'

export default defineEventHandler(async () => {
  ray('foo bar test')

  return { status: 'success' }
})

