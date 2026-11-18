import { Action } from '@stacksjs/actions'
import { createBroadcastHub } from '@stacksjs/realtime'
import { emit } from '@stacksjs/realtime/emit'
import { createBroadcastResponse } from '@stacksjs/realtime/stream'
import { enhanceRequest, getCurrentRequest, runWithRequest } from '@stacksjs/router'

const action = new Action({
  name: 'PortableStreamProbe',
  method: 'GET',
  handle(request) {
    return createBroadcastResponse({
      channels: ['private-portable-probe'],
      authorize: () => getCurrentRequest() === request,
    })
  },
})

export default action

export function open() {
  createBroadcastHub()
  const request = enhanceRequest(new Request('https://portable.invalid/subscriber'))
  return runWithRequest(request, () => action.handle(request))
}

export function publish() {
  emit('private-portable-probe', 'probe', { portable: true })
}
