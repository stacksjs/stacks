import { fetcher } from '../../src/fetcher'
import { digestServer } from './digest-server'
import { exerciseClient } from './client-contracts'
const server = digestServer()
try {
  await exerciseClient(fetcher, `http://127.0.0.1:${server.port}`)
  console.log('client runtime OK')
}
finally { server.stop(true) }
