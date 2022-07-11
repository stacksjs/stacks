// catch all pages

export default eventHandler((event) => {
  // eslint-disable-next-line no-console
  console.log('event', event)

  return 'Default page'
})
