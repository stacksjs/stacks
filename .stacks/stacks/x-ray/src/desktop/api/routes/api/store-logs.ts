// import storage from '../../storage'
// import type { Log } from '~/api/src/types'
//
// export default eventHandler(async (event) => {
//   const body = await readBody(event)
//
//   await appendLogs(body)
//
//   return { status: 'success' }
// })

// async function appendLogs(log: Log) {
//   const storageLogs: any = await storage.getItem('logs') || []
//
//   const newLogs = [...storageLogs, log]
//
//   await storage.setItem('logs', newLogs)
// }

// function clearStorage() {
//   storage.clear()
// }
