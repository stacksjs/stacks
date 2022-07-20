export default eventHandler(async (event) => {
  // eslint-disable-next-line no-console
  console.log('event', event)

  // const body = await useBody()

  // console.log('body', body)

  // TODO: Handle body and update user

  return 'User updated!'
})
