/**
 * Discord's gateway, as a user account's client holds it: one WebSocket that
 * delivers the account's state on connecting (READY: DMs, servers, read
 * states) and every event after it.
 *
 * The protocol, in brief: the server says HELLO with a heartbeat interval;
 * the client heartbeats with the last sequence number it saw and IDENTIFYs
 * (or RESUMEs a dropped session). Events arrive as op 0 with a type and a
 * sequence number. Op 7 asks the client to reconnect; op 9 says the session
 * is gone and a fresh IDENTIFY is needed.
 */

export interface GatewayIdentity {
  token: string
  /** The client's self-description, sent on IDENTIFY. */
  properties: Record<string, unknown>
  /** Feature flags that change the shape of READY. */
  capabilities?: number
}

export interface GatewayOptions {
  url?: string
  WebSocket?: new (url: string) => WebSocket
  /** Called with every dispatched event. */
  onDispatch: (type: string, data: any) => void
  /** Called when the token is refused; the gateway stops. */
  onAuthFailed?: (reason: string) => void
}

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const

/** Close codes after which reconnecting cannot help. */
const FATAL_CLOSE = new Set([4004, 4010, 4011, 4012, 4013, 4014])

export class DiscordGateway {
  private socket: WebSocket | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private sequence: number | null = null
  private sessionId: string | null = null
  private resumeUrl: string | null = null
  private acknowledged = true
  private stopped = false
  private failures = 0
  private readonly Socket: new (url: string) => WebSocket
  private readonly url: string
  private readyResolvers: Array<(data: any) => void> = []
  /** The most recent READY payload, kept for the driver's listings. */
  ready: any = null

  constructor(private readonly identity: GatewayIdentity, private readonly options: GatewayOptions) {
    this.Socket = options.WebSocket ?? (globalThis as { WebSocket: new (url: string) => WebSocket }).WebSocket
    this.url = options.url ?? 'wss://gateway.discord.gg/?encoding=json&v=9'
  }

  /** Resolves with READY, connecting first if needed. */
  whenReady(timeoutMs = 20_000): Promise<any> {
    if (this.ready)
      return Promise.resolve(this.ready)
    if (!this.socket && !this.stopped)
      this.connect()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Discord did not answer in time.')), timeoutMs)
      this.readyResolvers.push((data) => {
        clearTimeout(timer)
        resolve(data)
      })
    })
  }

  connect(): void {
    if (this.stopped)
      return
    const url = this.sessionId && this.resumeUrl ? `${this.resumeUrl}/?encoding=json&v=9` : this.url
    const socket = new this.Socket(url)
    this.socket = socket
    socket.onmessage = event => this.onMessage(socket, String(event.data))
    socket.onclose = (event: { code?: number, reason?: string }) => this.onClose(socket, event?.code ?? 0, event?.reason ?? '')
  }

  stop(): void {
    this.stopped = true
    this.clearHeartbeat()
    this.socket?.close()
    this.socket = null
  }

  private send(payload: unknown): void {
    this.socket?.send(JSON.stringify(payload))
  }

  private onMessage(socket: WebSocket, raw: string): void {
    if (socket !== this.socket)
      return
    let packet: { op: number, d?: any, s?: number | null, t?: string | null }
    try {
      packet = JSON.parse(raw)
    }
    catch {
      return
    }
    if (packet.s != null)
      this.sequence = packet.s
    switch (packet.op) {
      case OP.HELLO:
        this.startHeartbeat(packet.d?.heartbeat_interval ?? 41_250)
        if (this.sessionId)
          this.send({ op: OP.RESUME, d: { token: this.identity.token, session_id: this.sessionId, seq: this.sequence } })
        else
          this.identify()
        break
      case OP.HEARTBEAT:
        this.send({ op: OP.HEARTBEAT, d: this.sequence })
        break
      case OP.HEARTBEAT_ACK:
        this.acknowledged = true
        break
      case OP.RECONNECT:
        socket.close()
        break
      case OP.INVALID_SESSION:
        // Resumable (d === true): reconnect and resume. Otherwise identify afresh.
        if (!packet.d) {
          this.sessionId = null
          this.sequence = null
        }
        setTimeout(() => (this.sessionId ? socket.close() : this.identify()), 1000 + Math.random() * 4000)
        break
      case OP.DISPATCH:
        this.failures = 0
        if (packet.t === 'READY') {
          this.sessionId = packet.d?.session_id ?? null
          this.resumeUrl = packet.d?.resume_gateway_url ?? null
          this.ready = packet.d
          for (const resolve of this.readyResolvers.splice(0))
            resolve(packet.d)
        }
        if (packet.t)
          this.options.onDispatch(packet.t, packet.d)
        break
    }
  }

  private identify(): void {
    this.send({
      op: OP.IDENTIFY,
      d: {
        token: this.identity.token,
        capabilities: this.identity.capabilities ?? 0,
        properties: this.identity.properties,
        presence: { status: 'unknown', since: 0, activities: [], afk: false },
        compress: false,
        client_state: { guild_versions: {} },
      },
    })
  }

  private startHeartbeat(interval: number): void {
    this.clearHeartbeat()
    this.acknowledged = true
    // The first beat is jittered, as the protocol asks.
    const beat = (): void => {
      if (!this.acknowledged) {
        // No answer to the last beat: the connection is dead even if it looks open.
        this.socket?.close()
        return
      }
      this.acknowledged = false
      this.send({ op: OP.HEARTBEAT, d: this.sequence })
    }
    setTimeout(beat, interval * Math.random())
    this.heartbeat = setInterval(beat, interval)
  }

  private clearHeartbeat(): void {
    if (this.heartbeat)
      clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  private onClose(socket: WebSocket, code: number, reason: string): void {
    if (socket !== this.socket)
      return
    this.socket = null
    this.clearHeartbeat()
    if (this.stopped)
      return
    if (FATAL_CLOSE.has(code)) {
      this.stopped = true
      this.options.onAuthFailed?.(reason || `closed with ${code}`)
      return
    }
    if (code === 4007 || code === 4009) {
      // Sequence or session no longer valid: start a new session.
      this.sessionId = null
      this.sequence = null
    }
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(this.failures++, 6))
    setTimeout(() => this.connect(), delay)
  }
}
