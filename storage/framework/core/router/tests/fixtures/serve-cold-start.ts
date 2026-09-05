import { createStacksRouter } from '../../src/stacks-router'

const router = createStacksRouter()
router.get('/__cold_start', () => ({ ready: true }))
const server = await router.serve({ port: 0 })
try {
  const response = await fetch(`http://localhost:${server.port}/__cold_start`)
  const body = await response.json()
  if (response.status !== 200 || body.ready !== true)
    throw new Error(`Unexpected cold-start response: ${response.status}`)
  console.log('router-cold-start-ok')
}
finally {
  await server.stop(true)
}
