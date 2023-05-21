// import { makeUnifiedNetwork } from 'unified-network'
// import { ResponseType, fetch } from '@tauri-apps/api/http'
//
// let requestProcessor
//
// if (import.meta.env.VITE_NETWORK_PROCESSOR === 'tauri') {
//   requestProcessor = async ({ method, url, body, headers }) => {
//     const response = await fetch(url, {
//       method: method.toUpperCase(),
//       body,
//       headers,
//       responseType: ResponseType.Text,
//     })
//
//     const responseStatus = response.status
//     const responseHeaders = response.headers
//     let responseData: any = response.data
//
//     if (response.ok && responseHeaders['content-type']?.toLowerCase().includes('application/json')) {
//       try {
//         responseData = JSON.parse(responseData)
//       }
//       catch (error: any) {
//         throw new Error(`could not parse response data ${error.message}`)
//       }
//     }
//
//     return {
//       status: responseStatus,
//       headers: responseHeaders,
//       data: responseData,
//     }
//   }
// }
//
// export const $http = makeUnifiedNetwork({
//   _processor: requestProcessor,
// })
//
// export function generalHandleHttp(status: any, data: any) {
//   if (status !== 200) {
//     console.error(data?.message)
//     return true
//   }
// }
