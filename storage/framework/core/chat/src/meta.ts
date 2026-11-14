import type { ChatTransportOptions } from './transport'
import { chatJson, chatRequest, ChatTransportError } from './transport'

export interface MetaMessagingConfig {
  accessToken: string
  accountId: string
  /** Pin the provider version approved for this application, for example v27.0. */
  apiVersion: string
  /** Instagram Login uses graph.instagram.com; Facebook Login uses graph.facebook.com. */
  provider: 'messenger' | 'instagram' | 'instagram-facebook'
}

export interface MetaSendResult {
  outcome: 'accepted' | 'rejected' | 'unknown'
  messageId?: string
  recipientId?: string
  error?: string
  httpStatus?: number
}

/** Scoped text replies. Account permissions, consent and messaging windows remain caller policy. */
export class MetaMessagingClient {
  private readonly config: MetaMessagingConfig
  private readonly fetcher: typeof fetch

  constructor(config: MetaMessagingConfig, transport: ChatTransportOptions = {}) {
    if (!/^v\d+\.\d+$/.test(config.apiVersion) || !/^\d+$/.test(config.accountId) || !config.accessToken)
      throw new Error('Meta messaging requires a version, numeric account ID and access token')
    if (!['messenger', 'instagram', 'instagram-facebook'].includes(config.provider))
      throw new Error('Unsupported Meta messaging provider')
    this.config = { ...config }
    this.fetcher = transport.fetch ?? ((input, init) => fetch(input, init)) as typeof fetch
  }

  private endpoint(path: string): string {
    const host = this.config.provider === 'instagram' ? 'graph.instagram.com' : 'graph.facebook.com'
    return `https://${host}/${this.config.apiVersion}/${path}`
  }

  /** Verify the token can read this exact configured account. Does not imply app-review approval. */
  async identity(): Promise<{ id: string, name?: string }> {
    const response = await chatRequest(this.fetcher, this.endpoint(`${this.config.accountId}?fields=id,name`), {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    })
    const data = await chatJson<{ id: string, name?: string, error?: unknown }>(response)
    if (data.error || data.id !== this.config.accountId)
      throw new Error('Meta account verification did not match configured account')
    return { id: data.id, name: data.name }
  }

  async sendText(recipientId: string, text: string): Promise<MetaSendResult> {
    if (!/^\d+$/.test(recipientId) || !text || text.length > 1000)
      return { outcome: 'rejected', error: 'Numeric scoped recipient and text of 1–1000 characters required' }
    try {
      const response = await chatRequest(this.fetcher, this.endpoint(`${this.config.accountId}/messages`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text },
          ...(this.config.provider === 'messenger' ? { messaging_type: 'RESPONSE' } : {}) }),
      })
      const data = await chatJson<{ message_id?: string, recipient_id?: string, error?: { code?: number } }>(response)
      if (data.error)
        return { outcome: 'rejected', error: `Meta error ${data.error.code ?? 'unknown'}`, httpStatus: response.status }
      if (!data.message_id)
        return { outcome: 'unknown', error: 'Meta acknowledgement has no message ID', httpStatus: response.status }
      return { outcome: 'accepted', messageId: data.message_id, recipientId: data.recipient_id, httpStatus: response.status }
    }
    catch (error) {
      return { outcome: error instanceof ChatTransportError ? error.outcome : 'unknown',
        httpStatus: error instanceof ChatTransportError ? error.httpStatus : undefined,
        error: error instanceof Error ? error.message : 'Meta acknowledgement unavailable' }
    }
  }
}
