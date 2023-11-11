import localtunnel from 'localtunnel'

export async function createLocalTunnel(port: number) {
  const tunnel = await localtunnel({ port })
  return tunnel.url
}

