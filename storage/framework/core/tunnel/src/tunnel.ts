export async function localTunnel(options?: { port: number }) {
  const port = 3000

  if (!options?.port) options = { port }

  // eslint-disable-next-line no-console
  console.log('Creating local tunnel', options.port)

  return 'localTunnel'
}
