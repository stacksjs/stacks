export interface WhatsAppCloudConfig {
  accessToken: string
  phoneNumberId: string
  apiVersion: string
}

export interface WhatsAppCloudResult {
  outcome: 'accepted' | 'rejected' | 'unknown'
  messageId?: string
  error?: string
  httpStatus?: number
}

/** Per-account Cloud API client. Acceptance is not a delivery receipt. */
export class WhatsAppCloudClient {
  private readonly config: WhatsAppCloudConfig
  private readonly fetcher: typeof fetch

  constructor(config: WhatsAppCloudConfig, transport: { fetch?: typeof fetch } = {}) {
    if (!/^v\d+\.\d+$/.test(config.apiVersion) || !/^\d+$/.test(config.phoneNumberId) || !config.accessToken)
      throw new Error('WhatsApp Cloud requires a version, numeric phone number ID and access token')
    this.config = { ...config }
    this.fetcher = transport.fetch ?? ((input, init) => fetch(input, init)) as typeof fetch
  }

  private endpoint(suffix = ''): string {
    return `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}${suffix}`
  }

  async identity(): Promise<{ id: string, displayPhoneNumber?: string, verifiedName?: string }> {
    const response = await this.fetcher(this.endpoint('?fields=id,display_phone_number,verified_name'), {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok)
      throw new Error(`WhatsApp identity HTTP ${response.status}`)
    const data = await response.json() as { id?: string, display_phone_number?: string, verified_name?: string }
    if (data.id !== this.config.phoneNumberId)
      throw new Error('WhatsApp identity did not match configured phone number ID')
    return { id: data.id, displayPhoneNumber: data.display_phone_number, verifiedName: data.verified_name }
  }

  /** Session text replies only; templates and consent/window decisions are deliberately explicit caller policy. */
  async sendText(to: string, text: string, options: { replyTo?: string, callbackData?: string } = {}): Promise<WhatsAppCloudResult> {
    if (!/^\+?[1-9]\d{6,14}$/.test(to) || !text || text.length > 4096 || (options.callbackData?.length ?? 0) > 512)
      return { outcome: 'rejected', error: 'Valid international recipient and text of 1–4096 characters required' }
    let response: Response
    try {
      response = await this.fetcher(this.endpoint('/messages'), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''),
          type: 'text', text: { preview_url: false, body: text },
          ...(options.replyTo ? { context: { message_id: options.replyTo } } : {}),
          ...(options.callbackData ? { biz_opaque_callback_data: options.callbackData } : {}) }),
      })
    }
    catch {
      return { outcome: 'unknown', error: 'WhatsApp acknowledgement unavailable' }
    }
    if (!response.ok)
      return { outcome: response.status >= 500 || response.status === 408 ? 'unknown' : 'rejected', error: `WhatsApp HTTP ${response.status}`, httpStatus: response.status }
    try {
      const data = await response.json() as { messages?: Array<{ id?: string }>, error?: { code?: number } }
      if (data.error)
        return { outcome: 'rejected', error: `WhatsApp error ${data.error.code ?? 'unknown'}`, httpStatus: response.status }
      const messageId = data.messages?.[0]?.id
      return messageId ? { outcome: 'accepted', messageId, httpStatus: response.status }
        : { outcome: 'unknown', error: 'WhatsApp acknowledgement has no message ID', httpStatus: response.status }
    }
    catch {
      return { outcome: 'unknown', error: 'WhatsApp acknowledgement is not valid JSON', httpStatus: response.status }
    }
  }
}
