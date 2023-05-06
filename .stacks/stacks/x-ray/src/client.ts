import request from './http'
import type { Log } from './types'

// should be an .env value
const apiURL = 'http://127.0.0.1'

// should be an .env value
const apiPort = '3000'

function send(content: Log, url: string): void {
  request(`${apiURL}:${apiPort}${url}`, 'POST', content)
}

export { send }
