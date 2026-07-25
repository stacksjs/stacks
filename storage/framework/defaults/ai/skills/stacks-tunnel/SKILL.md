---
name: stacks-tunnel
description: Use when setting up tunnels in Stacks — local development tunnels for webhook testing, custom cloud tunnel deployment to AWS EC2, tunnel event callbacks (onConnect, onRequest, onResponse, onError), subdomain configuration, or the buddy share command. Covers @stacksjs/tunnel.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Tunnel

Local and cloud-deployed development tunnels for exposing local servers.

## Key Paths
- Core package: `storage/framework/core/tunnel/src/`
- External tool: ~/Code/Tools/localtunnels/

## Local Tunnel (Quick)

```typescript
import { createLocalTunnel } from '@stacksjs/tunnel'

const url = await createLocalTunnel(3000)
// Returns: 'https://abc123.loca.lt'
console.log(`Share this URL: ${url}`)
```

## Advanced Local Tunnel

```typescript
import { localTunnel } from '@stacksjs/tunnel'

const tunnel = await localTunnel({
  port: 3000,                          // required
  server: 'https://localtunnel.me',   // tunnel server
  subdomain: 'my-app',                // request specific subdomain
  verbose: true,
  timeout: 30000,                      // connection timeout (ms)
  maxReconnectAttempts: 5,

  // Event callbacks
  onConnect: (url) => {
    console.log(`Tunnel connected: ${url}`)
  },
  onRequest: (info) => {
    console.log(`Request: ${info.method} ${info.path}`)
  },
  onResponse: (info) => {
    console.log(`Response: ${info.status}`)
  },
  onError: (error) => {
    console.error('Tunnel error:', error)
  },
  onReconnecting: (attempt) => {
    console.log(`Reconnecting... attempt ${attempt}`)
  }
})

// Access tunnel info
console.log(tunnel.url)          // public URL
console.log(tunnel.subdomain)   // assigned subdomain

// Close tunnel
tunnel.close()
```

## Cloud Tunnel Deployment (AWS)

```typescript
import { deployTunnelServer, destroyTunnelServer } from '@stacksjs/tunnel'

// Deploy custom tunnel server to EC2
await deployTunnelServer({
  region: 'us-east-1',
  instanceType: 't3.micro',
  domain: 'tunnel.myapp.com'
})

// Tear down
await destroyTunnelServer({
  region: 'us-east-1'
})
```

## CLI Command

```bash
buddy share              # start tunnel for dev server
```

## TunnelOptions Interface

```typescript
interface TunnelOptions {
  port: number                        // local port to tunnel
  server?: string                     // tunnel relay server URL
  subdomain?: string                  // requested subdomain
  verbose?: boolean                   // debug output
  timeout?: number                    // connection timeout (ms)
  maxReconnectAttempts?: number       // retry limit

  onConnect?: (url: string) => void
  onRequest?: (info: RequestInfo) => void
  onResponse?: (info: ResponseInfo) => void
  onError?: (error: Error) => void
  onReconnecting?: (attempt: number) => void
}

interface LocalTunnel {
  url: string                         // public tunnel URL
  subdomain: string                   // assigned subdomain
  client: TunnelClient               // underlying client
  close: () => void                   // close tunnel
}
```

## Gotchas
- Tunnels are for development only — not production use
- `createLocalTunnel()` is the simple version — returns just the URL
- `localTunnel()` is the full version with callbacks and control
- Cloud deployment creates an EC2 instance — incurs AWS costs
- Tunnel URLs are temporary — change between sessions unless subdomain is configured
- Ensure dev server is running before starting the tunnel
- `maxReconnectAttempts` prevents infinite reconnection loops
- The underlying tool is from ~/Code/Tools/localtunnels/
- `buddy share` wraps `createLocalTunnel()` for the configured dev port
