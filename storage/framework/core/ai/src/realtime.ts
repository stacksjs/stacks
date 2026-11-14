import type { AITool } from './types'

export type RealtimeFailure = 'configuration' | 'transport' | 'protocol' | 'timeout' | 'closed' | 'backpressure' | 'provider'

export class RealtimeError extends Error {
  constructor(public readonly code: RealtimeFailure) {
    super(`Realtime audio session failed (${code}).`)
    this.name = 'RealtimeError'
  }
}

export interface RealtimeSocket {
  readonly readyState: number
  readonly bufferedAmount: number
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
}

export type RealtimeEvent =
  | { type: 'audio', audio: string, itemId: string }
  | { type: 'transcript', text: string, role: 'assistant' | 'customer', final: boolean }
  | { type: 'speech_started', itemId: string }
  | { type: 'tool_call', id: string, name: string, arguments: Record<string, unknown> }
  | { type: 'usage', responseId: string, usage: Record<string, unknown> }
  | { type: 'error', code: RealtimeFailure }

export interface RealtimeOptions {
  apiKey: string
  model: string
  instructions: string
  voice?: string
  inputTranscriptionModel?: string
  safetyIdentifier?: string
  tools?: AITool[]
  format?: 'audio/pcmu' | 'audio/pcma' | 'audio/pcm'
  timeoutMs?: number
  maxDurationMs?: number
  onEvent: (event: RealtimeEvent) => void
  socket?: (url: string, headers: Record<string, string>) => RealtimeSocket
}

export interface RealtimeSession {
  appendAudio: (base64: string) => void
  interrupt: (itemId?: string, playedMilliseconds?: number) => void
  submitToolResult: (callId: string, result: unknown) => void
  close: () => void
  closed: Promise<{ reason: RealtimeFailure }>
}

function row(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validAudio(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 87384
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    && Buffer.from(value, 'base64').toString('base64') === value
}

/** Server-only GA Realtime audio transport. Business authorization stays with the caller. */
export function connectRealtime(options: RealtimeOptions): Promise<RealtimeSession> {
  if (!options.apiKey?.trim() || /[\r\n]/.test(options.apiKey) || !/^[\w.:-]{1,128}$/.test(options.model)
    || !options.instructions?.trim() || options.instructions.length > 32000
    || (options.safetyIdentifier !== undefined && !/^[\w.-]{1,128}$/.test(options.safetyIdentifier)))
    throw new RealtimeError('configuration')
  const timeout = options.timeoutMs ?? 10000
  const duration = options.maxDurationMs ?? 900000
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120000 || !Number.isSafeInteger(duration) || duration < 1 || duration > 3600000)
    throw new RealtimeError('configuration')
  const tools = options.tools ?? []
  const allowed = new Set(tools.map(tool => tool.name))
  if (allowed.size !== tools.length || tools.some(tool => !/^[\w-]{1,64}$/.test(tool.name))) throw new RealtimeError('configuration')
  const format = options.format ?? 'audio/pcmu'
  if (!['audio/pcmu', 'audio/pcma', 'audio/pcm'].includes(format)) throw new RealtimeError('configuration')
  const audioFormat = format === 'audio/pcm' ? { type: format, rate: 24000 } : { type: format }
  const headers: Record<string, string> = { Authorization: `Bearer ${options.apiKey}` }
  if (options.safetyIdentifier) headers['OpenAI-Safety-Identifier'] = options.safetyIdentifier
  // Bun's client accepts server-side headers; the shared DOM declaration only
  // describes the browser overload. Keep this host-specific type at the seam.
  const NativeSocket = WebSocket as unknown as { new(url: string, options: { headers: Record<string, string> }): RealtimeSocket }
  const factory = options.socket ?? ((url, authentication) => new NativeSocket(url, { headers: authentication }))
  let socket: RealtimeSocket
  try { socket = factory(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(options.model)}`, headers) }
  catch { throw new RealtimeError('transport') }

  return new Promise((resolve, reject) => {
    let ready = false
    let ended = false
    let responseActive = false
    const seenCalls = new Set<string>()
    const pendingCalls = new Set<string>()
    const seenUsage = new Set<string>()
    let complete: (value: { reason: RealtimeFailure }) => void = () => {}
    const closed = new Promise<{ reason: RealtimeFailure }>((finish) => { complete = finish })
    let lifetime: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => end('timeout'), timeout)

    function end(reason: RealtimeFailure): void {
      if (ended) return
      ended = true
      clearTimeout(timer)
      clearTimeout(lifetime)
      for (const [type, listener] of listeners) socket.removeEventListener(type, listener)
      try { socket.close(1000, 'Session ended') }
      catch { /* Cleanup must settle even when the socket is already closed. */ }
      complete({ reason })
      if (!ready) reject(new RealtimeError(reason))
      if (reason !== 'closed') {
        try { options.onEvent({ type: 'error', code: reason }) }
        catch { /* An observer cannot prevent transport cleanup. */ }
      }
    }

    function send(value: unknown, initialization = false): void {
      if (ended || socket.readyState !== 1 || (!initialization && !ready)) throw new RealtimeError('closed')
      const data = JSON.stringify(value)
      if (Buffer.byteLength(data) + socket.bufferedAmount > 1048576) throw new RealtimeError('backpressure')
      try { socket.send(data) }
      catch { end('transport'); throw new RealtimeError('transport') }
    }

    const session: RealtimeSession = {
      appendAudio(audio) {
        if (!validAudio(audio)) throw new RealtimeError('protocol')
        send({ type: 'input_audio_buffer.append', audio })
      },
      interrupt(itemId, playedMilliseconds) {
        if (itemId !== undefined && (!/^[\w-]{1,255}$/.test(itemId) || !Number.isSafeInteger(playedMilliseconds) || playedMilliseconds! < 0)) throw new RealtimeError('protocol')
        if (responseActive) send({ type: 'response.cancel' })
        if (itemId !== undefined) send({ type: 'conversation.item.truncate', item_id: itemId, content_index: 0, audio_end_ms: playedMilliseconds })
      },
      submitToolResult(callId, result) {
        if (!pendingCalls.has(callId)) throw new RealtimeError('protocol')
        const output = JSON.stringify(result)
        if (output === undefined || output.length > 16000) throw new RealtimeError('protocol')
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output } })
        pendingCalls.delete(callId)
        send({ type: 'response.create' })
      },
      close() { end('closed') },
      closed,
    }

    const open: EventListener = () => {
      try {
        send({ type: 'session.update', session: {
          type: 'realtime', model: options.model, instructions: options.instructions,
          output_modalities: ['audio'],
          audio: { input: { format: audioFormat, turn_detection: { type: 'server_vad', interrupt_response: false }, ...(options.inputTranscriptionModel ? { transcription: { model: options.inputTranscriptionModel } } : {}) }, output: { format: audioFormat, voice: options.voice ?? 'marin' } },
          tools: tools.map(tool => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters })),
        } }, true)
      }
      catch { end('transport') }
    }

    const receive: EventListener = (event) => {
      if (ended) return
      try {
        const data: unknown = (event as MessageEvent).data
        if (typeof data !== 'string' || Buffer.byteLength(data) > 1048576) throw new RealtimeError('protocol')
        const value: unknown = JSON.parse(data)
        if (!row(value) || typeof value.type !== 'string') throw new RealtimeError('protocol')
        if (value.type === 'error') return end('provider')
        if (value.type === 'session.updated' && !ready) {
          if (!row(value.session) || typeof value.session.id !== 'string') throw new RealtimeError('protocol')
          ready = true
          clearTimeout(timer)
          lifetime = setTimeout(() => end('timeout'), duration)
          resolve(session)
          return
        }
        if (!ready) return
        if (value.type === 'response.created') responseActive = true
        if (value.type === 'response.output_audio.delta') {
          if (!validAudio(value.delta) || typeof value.item_id !== 'string') throw new RealtimeError('protocol')
          options.onEvent({ type: 'audio', audio: value.delta, itemId: value.item_id })
        }
        else if (value.type === 'input_audio_buffer.speech_started') {
          options.onEvent({ type: 'speech_started', itemId: typeof value.item_id === 'string' ? value.item_id : '' })
        }
        else if (value.type === 'response.function_call_arguments.done') {
          if (typeof value.name !== 'string' || !allowed.has(value.name) || typeof value.call_id !== 'string' || typeof value.arguments !== 'string' || value.arguments.length > 16000) throw new RealtimeError('protocol')
          if (seenCalls.has(value.call_id)) return
          if (seenCalls.size >= 100) throw new RealtimeError('protocol')
          const args: unknown = JSON.parse(value.arguments)
          if (!row(args)) throw new RealtimeError('protocol')
          seenCalls.add(value.call_id)
          pendingCalls.add(value.call_id)
          options.onEvent({ type: 'tool_call', id: value.call_id, name: value.name, arguments: args })
        }
        else if (value.type === 'response.done' && row(value.response)) {
          responseActive = false
          const response = value.response
          if (typeof response.id === 'string' && row(response.usage) && !seenUsage.has(response.id)) {
            if (seenUsage.size >= 1000) throw new RealtimeError('protocol')
            seenUsage.add(response.id)
            options.onEvent({ type: 'usage', responseId: response.id, usage: response.usage })
          }
        }
        else if (value.type === 'response.output_audio_transcript.delta' && typeof value.delta === 'string') {
          options.onEvent({ type: 'transcript', role: 'assistant', text: value.delta, final: false })
        }
        else if (value.type === 'conversation.item.input_audio_transcription.completed' && typeof value.transcript === 'string') {
          options.onEvent({ type: 'transcript', role: 'customer', text: value.transcript, final: true })
        }
      }
      catch { end('protocol') }
    }
    const listeners: Array<[string, EventListener]> = [
      ['open', open], ['message', receive], ['error', () => end('transport')], ['close', () => end('closed')],
    ]
    for (const [type, listener] of listeners) socket.addEventListener(type, listener)
  })
}
