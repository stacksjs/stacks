---
name: stacks-tunnel
description: Use when setting up tunnels in Stacks - local development tunnels for webhook testing, custom cloud tunnel deployment to AWS EC2, tunnel event callbacks (onConnect, onRequest, onResponse, onError), subdomain configuration, or the buddy share command. Covers @stacksjs/tunnel.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Tunnel

Local and cloud-deployed development tunnels for exposing local servers.

## Key Paths
- Core package: `storage/framework/core/tunnel/src/`
- Runtime dependency: localtunnels; cloud helpers use localtunnels/cloud

## Local Tunnel (Quick)

```typescript
import { createLocalTunnel } from '@stacksjs/tunnel'

const url = await createLocalTunnel(3000)
// Returns the URL assigned by the configured/shared relay
console.log(`Share this URL: ${url}`)
```

## Advanced Local Tunnel

```typescript
import { localTunnel } from '@stacksjs/tunnel'

const tunnel = await localTunnel({
  port: 3000,                          // required
  server: 'https://api.localtunnel.dev',   // tunnel server
  subdomain: 'my-app',                // request specific subdomain
  verbose: true,
  timeout: 30000,                      // connection timeout (ms)
  maxReconnectAttempts: 5,

  // Event callbacks
  onConnect: (info) => {
    console.log(`Tunnel connected: ${info.url}`)
  },
  onRequest: (info) => {
    console.log(`Request: ${info.method} ${info.url}`)
  },
  onResponse: (info) => {
    console.log(`Response: ${info.status}`)
  },
  onError: (error) => {
    console.error('Tunnel error:', error)
  },
  onReconnecting: (info) => {
    console.log(`Reconnecting... attempt ${info.attempt}`)
  }
})

// Access tunnel info
console.log(tunnel.url)          // public URL
console.log(tunnel.subdomain)   // assigned subdomain

// Close tunnel
await tunnel.close()
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

  onConnect?: (info: { url: string, subdomain: string }) => void
  onRequest?: (info: { method: string, url: string }) => void
  onResponse?: (info: { status: number, size: number, duration?: number }) => void
  onError?: (error: Error) => void
  onReconnecting?: (info: { attempt: number, delay: number }) => void
}

interface LocalTunnel {
  url: string                         // public tunnel URL
  subdomain: string                   // assigned subdomain
  client: TunnelClient               // underlying client
  close: () => Promise<void>                   // close tunnel
}
```

## Gotchas
- Tunnels are for development only - not production use
- `createLocalTunnel()` is the simple version - returns just the URL
- `localTunnel()` is the full version with callbacks and control
- Cloud deployment creates an EC2 instance - incurs AWS costs
- Tunnel URLs are temporary - change between sessions unless subdomain is configured
- Ensure dev server is running before starting the tunnel
- `maxReconnectAttempts` prevents infinite reconnection loops
- The underlying tool is the declared localtunnels dependency, not a machine-specific source checkout
- `buddy share` wraps `createLocalTunnel()` for the configured dev port


## Lifecycle and evidence

The simple createLocalTunnel returns only a URL and discards the close handle;
use localTunnel when the application needs deterministic cleanup. Relay defaults
come from the installed localtunnels client. Starting a tunnel exposes the chosen
service externally; choose that service within the task scope. Cloud provisioning
and destruction are real provider mutations, separate from request callback tests.
Source: core/tunnel/src/index.ts and tunnel.ts; evidence: core/tunnel/tests/tunnel.test.ts.
