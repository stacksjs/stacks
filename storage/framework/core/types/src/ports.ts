/**
 * **Stacks Ports**
 *
 * This port is used by the Stacks servers when running your application, library, email services,
 * and other services. You may change this port to any other port that is free
 * on your machine, as long as the following 6 ports are also available.
 */
export interface Ports {
  frontend: number
  backend: number // proxies api
  admin: number
  library: number
  desktop: number
  email: number
  docs: number
  inspect: number
  api: number // the bun server
  systemTray: number
  database: number // i.e. DynamoDB local
}
