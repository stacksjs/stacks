/**
 * AWS SES (Simple Email Service) Operations
 * Direct API calls without AWS SDK dependency
 */

import { AWSClient } from './client'

export interface EmailIdentity {
  IdentityType?: 'EMAIL_ADDRESS' | 'DOMAIN' | 'MANAGED_DOMAIN'
  IdentityName?: string
  SendingEnabled?: boolean
  VerificationStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE' | 'NOT_STARTED'
  DkimAttributes?: {
    SigningEnabled?: boolean
    Status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE' | 'NOT_STARTED'
    Tokens?: string[]
    SigningAttributesOrigin?: 'AWS_SES' | 'EXTERNAL'
  }
  MailFromAttributes?: {
    MailFromDomain?: string
    MailFromDomainStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE'
    BehaviorOnMxFailure?: 'USE_DEFAULT_VALUE' | 'REJECT_MESSAGE'
  }
}

export interface SendEmailResult {
  MessageId?: string
}

/**
 * SES email service management using direct API calls
 */
export class SESClient {
  private client: AWSClient
  private region: string

  constructor(region: string = 'us-east-1') {
    this.region = region
    this.client = new AWSClient()
  }

  /**
   * Create email identity (domain or email address)
   * Uses SES v2 API
   */
  async createEmailIdentity(params: {
    EmailIdentity: string
    DkimSigningAttributes?: {
      DomainSigningSelector?: string
      DomainSigningPrivateKey?: string
    }
    Tags?: Array<{ Key: string, Value: string }>
  }): Promise<{
    IdentityType?: string
    VerifiedForSendingStatus?: boolean
    DkimAttributes?: {
      SigningEnabled?: boolean
      Status?: string
      Tokens?: string[]
      SigningAttributesOrigin?: string
    }
  }> {
    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'POST',
      path: '/v2/email/identities',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    return result
  }

  /**
   * Get email identity details
   */
  async getEmailIdentity(emailIdentity: string): Promise<EmailIdentity> {
    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'GET',
      path: `/v2/email/identities/${encodeURIComponent(emailIdentity)}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return {
      IdentityType: result.IdentityType,
      IdentityName: emailIdentity,
      SendingEnabled: result.VerifiedForSendingStatus,
      VerificationStatus: result.VerificationStatus,
      DkimAttributes: result.DkimAttributes,
      MailFromAttributes: result.MailFromAttributes,
    }
  }

  /**
   * Configure MAIL FROM domain for an email identity
   */
  async putEmailIdentityMailFromAttributes(emailIdentity: string, params: {
    MailFromDomain?: string
    BehaviorOnMxFailure?: 'USE_DEFAULT_VALUE' | 'REJECT_MESSAGE'
  }): Promise<void> {
    await this.client.request({
      service: 'email',
      region: this.region,
      method: 'PUT',
      path: `/v2/email/identities/${encodeURIComponent(emailIdentity)}/mail-from`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
  }

  /**
   * List email identities
   */
  async listEmailIdentities(params?: {
    PageSize?: number
    NextToken?: string
  }): Promise<{
    EmailIdentities?: Array<{
      IdentityType?: string
      IdentityName?: string
      SendingEnabled?: boolean
    }>
    NextToken?: string
  }> {
    let path = '/v2/email/identities'
    const queryParams: string[] = []

    if (params?.PageSize) {
      queryParams.push(`PageSize=${params.PageSize}`)
    }
    if (params?.NextToken) {
      queryParams.push(`NextToken=${encodeURIComponent(params.NextToken)}`)
    }

    if (queryParams.length > 0) {
      path += `?${queryParams.join('&')}`
    }

    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'GET',
      path,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return {
      EmailIdentities: result.EmailIdentities,
      NextToken: result.NextToken,
    }
  }

  /**
   * Delete email identity
   */
  async deleteEmailIdentity(emailIdentity: string): Promise<void> {
    await this.client.request({
      service: 'email',
      region: this.region,
      method: 'DELETE',
      path: `/v2/email/identities/${encodeURIComponent(emailIdentity)}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Enable/disable DKIM signing for identity
   */
  async putEmailIdentityDkimAttributes(params: {
    EmailIdentity: string
    SigningEnabled: boolean
  }): Promise<void> {
    await this.client.request({
      service: 'email',
      region: this.region,
      method: 'PUT',
      path: `/v2/email/identities/${encodeURIComponent(params.EmailIdentity)}/dkim`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ SigningEnabled: params.SigningEnabled }),
    })
  }

  /**
   * Send email
   */
  async sendEmail(params: {
    FromEmailAddress: string
    Destination: {
      ToAddresses?: string[]
      CcAddresses?: string[]
      BccAddresses?: string[]
    }
    Content: {
      Simple?: {
        Subject: { Data: string, Charset?: string }
        Body: {
          Text?: { Data: string, Charset?: string }
          Html?: { Data: string, Charset?: string }
        }
      }
      Raw?: {
        Data: string // Base64 encoded
      }
      Template?: {
        TemplateName: string
        TemplateData?: string
      }
    }
    ReplyToAddresses?: string[]
    ConfigurationSetName?: string
  }): Promise<SendEmailResult> {
    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'POST',
      path: '/v2/email/outbound-emails',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    return {
      MessageId: result.MessageId,
    }
  }

  /**
   * Send bulk email
   */
  async sendBulkEmail(params: {
    FromEmailAddress: string
    BulkEmailEntries: Array<{
      Destination: {
        ToAddresses?: string[]
        CcAddresses?: string[]
        BccAddresses?: string[]
      }
      ReplacementEmailContent?: {
        ReplacementTemplate?: {
          ReplacementTemplateData?: string
        }
      }
    }>
    DefaultContent: {
      Template: {
        TemplateName: string
        TemplateData?: string
      }
    }
    ConfigurationSetName?: string
  }): Promise<{
    BulkEmailEntryResults?: Array<{
      Status?: string
      Error?: string
      MessageId?: string
    }>
  }> {
    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'POST',
      path: '/v2/email/outbound-bulk-emails',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    return {
      BulkEmailEntryResults: result.BulkEmailEntryResults,
    }
  }

  /**
   * Create email template
   */
  async createEmailTemplate(params: {
    TemplateName: string
    TemplateContent: {
      Subject?: string
      Text?: string
      Html?: string
    }
  }): Promise<void> {
    await this.client.request({
      service: 'email',
      region: this.region,
      method: 'POST',
      path: '/v2/email/templates',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
  }

  /**
   * Get email template
   */
  async getEmailTemplate(templateName: string): Promise<{
    TemplateName?: string
    TemplateContent?: {
      Subject?: string
      Text?: string
      Html?: string
    }
  }> {
    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'GET',
      path: `/v2/email/templates/${encodeURIComponent(templateName)}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return result
  }

  /**
   * Delete email template
   */
  async deleteEmailTemplate(templateName: string): Promise<void> {
    await this.client.request({
      service: 'email',
      region: this.region,
      method: 'DELETE',
      path: `/v2/email/templates/${encodeURIComponent(templateName)}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * List email templates
   */
  async listEmailTemplates(params?: {
    PageSize?: number
    NextToken?: string
  }): Promise<{
    TemplatesMetadata?: Array<{
      TemplateName?: string
      CreatedTimestamp?: string
    }>
    NextToken?: string
  }> {
    let path = '/v2/email/templates'
    const queryParams: string[] = []

    if (params?.PageSize) {
      queryParams.push(`PageSize=${params.PageSize}`)
    }
    if (params?.NextToken) {
      queryParams.push(`NextToken=${encodeURIComponent(params.NextToken)}`)
    }

    if (queryParams.length > 0) {
      path += `?${queryParams.join('&')}`
    }

    const result = await this.client.request({
      service: 'email',
      region: this.region,
      method: 'GET',
      path,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return result
  }

  /**
   * Get sending statistics
   */
  async getSendStatistics(): Promise<{
    SendDataPoints?: Array<{
      Timestamp?: string
      DeliveryAttempts?: number
      Bounces?: number
      Complaints?: number
      Rejects?: number
    }>
  }> {
    // Use legacy v1 API for this
    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Action=GetSendStatistics&Version=2010-12-01',
    })

    return {
      SendDataPoints: result.GetSendStatisticsResponse?.GetSendStatisticsResult?.SendDataPoints?.member,
    }
  }

  /**
   * Get sending quota
   */
  async getSendQuota(): Promise<{
    Max24HourSend?: number
    MaxSendRate?: number
    SentLast24Hours?: number
  }> {
    // Use legacy v1 API for this
    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Action=GetSendQuota&Version=2010-12-01',
    })

    const quota = result.GetSendQuotaResponse?.GetSendQuotaResult
    return {
      Max24HourSend: quota?.Max24HourSend ? Number(quota.Max24HourSend) : undefined,
      MaxSendRate: quota?.MaxSendRate ? Number(quota.MaxSendRate) : undefined,
      SentLast24Hours: quota?.SentLast24Hours ? Number(quota.SentLast24Hours) : undefined,
    }
  }

  // Helper methods

  /**
   * Verify a domain identity
   */
  async verifyDomain(domain: string): Promise<{
    dkimTokens?: string[]
    verificationStatus?: string
  }> {
    const result = await this.createEmailIdentity({
      EmailIdentity: domain,
    })

    return {
      dkimTokens: result.DkimAttributes?.Tokens,
      verificationStatus: result.DkimAttributes?.Status,
    }
  }

  /**
   * Send a simple text email
   */
  async sendSimpleEmail(params: {
    from: string
    to: string | string[]
    subject: string
    text?: string
    html?: string
    replyTo?: string | string[]
  }): Promise<SendEmailResult> {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to]
    const replyToAddresses = params.replyTo
      ? (Array.isArray(params.replyTo) ? params.replyTo : [params.replyTo])
      : undefined

    const body: any = {}
    if (params.text) {
      body.Text = { Data: params.text }
    }
    if (params.html) {
      body.Html = { Data: params.html }
    }

    return this.sendEmail({
      FromEmailAddress: params.from,
      Destination: {
        ToAddresses: toAddresses,
      },
      Content: {
        Simple: {
          Subject: { Data: params.subject },
          Body: body,
        },
      },
      ReplyToAddresses: replyToAddresses,
    })
  }

  /**
   * Send a templated email
   */
  async sendTemplatedEmail(params: {
    from: string
    to: string | string[]
    templateName: string
    templateData: Record<string, any>
    replyTo?: string | string[]
  }): Promise<SendEmailResult> {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to]
    const replyToAddresses = params.replyTo
      ? (Array.isArray(params.replyTo) ? params.replyTo : [params.replyTo])
      : undefined

    return this.sendEmail({
      FromEmailAddress: params.from,
      Destination: {
        ToAddresses: toAddresses,
      },
      Content: {
        Template: {
          TemplateName: params.templateName,
          TemplateData: JSON.stringify(params.templateData),
        },
      },
      ReplyToAddresses: replyToAddresses,
    })
  }

  /**
   * Get DKIM DNS records for a domain
   */
  async getDkimRecords(domain: string): Promise<Array<{
    name: string
    type: string
    value: string
  }>> {
    const identity = await this.getEmailIdentity(domain)

    if (!identity.DkimAttributes?.Tokens) {
      return []
    }

    return identity.DkimAttributes.Tokens.map(token => ({
      name: `${token}._domainkey.${domain}`,
      type: 'CNAME',
      value: `${token}.dkim.amazonses.com`,
    }))
  }

  /**
   * Check if domain is verified
   */
  async isDomainVerified(domain: string): Promise<boolean> {
    try {
      const identity = await this.getEmailIdentity(domain)
      return identity.VerificationStatus === 'SUCCESS' && identity.SendingEnabled === true
    }
    catch {
      return false
    }
  }

  /**
   * Wait for domain verification
   */
  async waitForDomainVerification(
    domain: string,
    maxAttempts = 60,
    delayMs = 30000,
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const isVerified = await this.isDomainVerified(domain)

      if (isVerified) {
        return true
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    return false
  }

  // ============================================
  // SES v1 API - Receipt Rules (for inbound email)
  // Note: Receipt rules use the legacy SES v1 API
  // ============================================

  /**
   * Build form-encoded body for SES v1 API
   */
  private buildFormBody(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`)
    return entries.join('&')
  }

  /**
   * Create a receipt rule set
   * Uses SES v1 API
   */
  async createReceiptRuleSet(ruleSetName: string): Promise<void> {
    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'CreateReceiptRuleSet',
        Version: '2010-12-01',
        RuleSetName: ruleSetName,
      }),
    })
  }

  /**
   * Delete a receipt rule set
   */
  async deleteReceiptRuleSet(ruleSetName: string): Promise<void> {
    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'DeleteReceiptRuleSet',
        Version: '2010-12-01',
        RuleSetName: ruleSetName,
      }),
    })
  }

  /**
   * Set the active receipt rule set
   */
  async setActiveReceiptRuleSet(ruleSetName: string): Promise<void> {
    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'SetActiveReceiptRuleSet',
        Version: '2010-12-01',
        RuleSetName: ruleSetName,
      }),
    })
  }

  /**
   * List receipt rule sets
   */
  async listReceiptRuleSets(nextToken?: string): Promise<{
    RuleSets?: Array<{ Name?: string, CreatedTimestamp?: string }>
    NextToken?: string
  }> {
    const formParams: Record<string, string | undefined> = {
      Action: 'ListReceiptRuleSets',
      Version: '2010-12-01',
    }

    if (nextToken) {
      formParams.NextToken = nextToken
    }

    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody(formParams),
    })

    // Handle both response formats (with and without Response wrapper)
    const ruleSetsResult = result?.ListReceiptRuleSetsResponse?.ListReceiptRuleSetsResult
      || result?.ListReceiptRuleSetsResult
    const ruleSets = ruleSetsResult?.RuleSets?.member
    return {
      RuleSets: Array.isArray(ruleSets) ? ruleSets : ruleSets ? [ruleSets] : [],
      NextToken: ruleSetsResult?.NextToken,
    }
  }

  /**
   * Describe a receipt rule set
   */
  async describeReceiptRuleSet(ruleSetName: string): Promise<{
    Metadata?: { Name?: string, CreatedTimestamp?: string }
    Rules?: Array<{
      Name?: string
      Enabled?: boolean
      Recipients?: string[]
      Actions?: Array<{
        S3Action?: { BucketName?: string, ObjectKeyPrefix?: string }
        LambdaAction?: { FunctionArn?: string, InvocationType?: string }
        SNSAction?: { TopicArn?: string }
      }>
    }>
  }> {
    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'DescribeReceiptRuleSet',
        Version: '2010-12-01',
        RuleSetName: ruleSetName,
      }),
    })

    // Handle both response formats (with and without Response wrapper)
    const response = result?.DescribeReceiptRuleSetResponse?.DescribeReceiptRuleSetResult
      || result?.DescribeReceiptRuleSetResult
    const rules = response?.Rules?.member
    return {
      Metadata: response?.Metadata,
      Rules: Array.isArray(rules) ? rules : rules ? [rules] : [],
    }
  }

  /**
   * Create a receipt rule
   */
  async createReceiptRule(params: {
    RuleSetName: string
    Rule: {
      Name: string
      Enabled?: boolean
      TlsPolicy?: 'Require' | 'Optional'
      Recipients?: string[]
      ScanEnabled?: boolean
      Actions: Array<{
        S3Action?: {
          BucketName: string
          ObjectKeyPrefix?: string
          KmsKeyArn?: string
        }
        LambdaAction?: {
          FunctionArn: string
          InvocationType?: 'Event' | 'RequestResponse'
        }
        SNSAction?: {
          TopicArn: string
          Encoding?: 'UTF-8' | 'Base64'
        }
        StopAction?: {
          Scope: 'RuleSet'
          TopicArn?: string
        }
      }>
    }
    After?: string
  }): Promise<void> {
    const formParams: Record<string, string | undefined> = {
      Action: 'CreateReceiptRule',
      Version: '2010-12-01',
      RuleSetName: params.RuleSetName,
      'Rule.Name': params.Rule.Name,
      'Rule.Enabled': params.Rule.Enabled !== false ? 'true' : 'false',
    }

    if (params.Rule.TlsPolicy) {
      formParams['Rule.TlsPolicy'] = params.Rule.TlsPolicy
    }

    if (params.Rule.ScanEnabled !== undefined) {
      formParams['Rule.ScanEnabled'] = params.Rule.ScanEnabled ? 'true' : 'false'
    }

    if (params.After) {
      formParams.After = params.After
    }

    // Add recipients
    if (params.Rule.Recipients) {
      params.Rule.Recipients.forEach((recipient, index) => {
        formParams[`Rule.Recipients.member.${index + 1}`] = recipient
      })
    }

    // Add actions
    params.Rule.Actions.forEach((action, index) => {
      const actionNum = index + 1

      if (action.S3Action) {
        formParams[`Rule.Actions.member.${actionNum}.S3Action.BucketName`] = action.S3Action.BucketName
        if (action.S3Action.ObjectKeyPrefix) {
          formParams[`Rule.Actions.member.${actionNum}.S3Action.ObjectKeyPrefix`] = action.S3Action.ObjectKeyPrefix
        }
        if (action.S3Action.KmsKeyArn) {
          formParams[`Rule.Actions.member.${actionNum}.S3Action.KmsKeyArn`] = action.S3Action.KmsKeyArn
        }
      }

      if (action.LambdaAction) {
        formParams[`Rule.Actions.member.${actionNum}.LambdaAction.FunctionArn`] = action.LambdaAction.FunctionArn
        formParams[`Rule.Actions.member.${actionNum}.LambdaAction.InvocationType`] = action.LambdaAction.InvocationType || 'Event'
      }

      if (action.SNSAction) {
        formParams[`Rule.Actions.member.${actionNum}.SNSAction.TopicArn`] = action.SNSAction.TopicArn
        if (action.SNSAction.Encoding) {
          formParams[`Rule.Actions.member.${actionNum}.SNSAction.Encoding`] = action.SNSAction.Encoding
        }
      }

      if (action.StopAction) {
        formParams[`Rule.Actions.member.${actionNum}.StopAction.Scope`] = action.StopAction.Scope
        if (action.StopAction.TopicArn) {
          formParams[`Rule.Actions.member.${actionNum}.StopAction.TopicArn`] = action.StopAction.TopicArn
        }
      }
    })

    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody(formParams),
    })
  }

  /**
   * Delete a receipt rule
   */
  async deleteReceiptRule(ruleSetName: string, ruleName: string): Promise<void> {
    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'DeleteReceiptRule',
        Version: '2010-12-01',
        RuleSetName: ruleSetName,
        RuleName: ruleName,
      }),
    })
  }

  /**
   * Check if receipt rule set exists
   */
  async receiptRuleSetExists(ruleSetName: string): Promise<boolean> {
    try {
      await this.describeReceiptRuleSet(ruleSetName)
      return true
    }
    catch (error: any) {
      if (error.code === 'RuleSetDoesNotExist' || error.statusCode === 400) {
        return false
      }
      throw error
    }
  }

  /**
   * Get the active receipt rule set
   */
  async getActiveReceiptRuleSet(): Promise<{
    Metadata?: { Name?: string, CreatedTimestamp?: string }
    Rules?: Array<{
      Name?: string
      Enabled?: boolean
      Recipients?: string[]
      Actions?: Array<{
        S3Action?: { BucketName?: string, ObjectKeyPrefix?: string }
        LambdaAction?: { FunctionArn?: string, InvocationType?: string }
        SNSAction?: { TopicArn?: string }
      }>
    }>
  } | null> {
    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody({
        Action: 'DescribeActiveReceiptRuleSet',
        Version: '2010-12-01',
      }),
    })

    // Handle response format
    const response = result?.DescribeActiveReceiptRuleSetResponse?.DescribeActiveReceiptRuleSetResult
      || result?.DescribeActiveReceiptRuleSetResult

    if (!response?.Metadata) {
      return null // No active rule set
    }

    const rules = response?.Rules?.member
    return {
      Metadata: response?.Metadata,
      Rules: Array.isArray(rules) ? rules : rules ? [rules] : [],
    }
  }

  /**
   * Update a receipt rule
   */
  async updateReceiptRule(params: {
    RuleSetName: string
    Rule: {
      Name: string
      Enabled?: boolean
      TlsPolicy?: 'Require' | 'Optional'
      Recipients?: string[]
      ScanEnabled?: boolean
      Actions: Array<{
        S3Action?: {
          BucketName: string
          ObjectKeyPrefix?: string
          KmsKeyArn?: string
        }
        LambdaAction?: {
          FunctionArn: string
          InvocationType?: 'Event' | 'RequestResponse'
        }
        SNSAction?: {
          TopicArn: string
          Encoding?: 'UTF-8' | 'Base64'
        }
        StopAction?: {
          Scope: 'RuleSet'
          TopicArn?: string
        }
      }>
    }
  }): Promise<void> {
    const formParams: Record<string, string | undefined> = {
      Action: 'UpdateReceiptRule',
      Version: '2010-12-01',
      RuleSetName: params.RuleSetName,
      'Rule.Name': params.Rule.Name,
    }

    if (params.Rule.Enabled !== undefined) {
      formParams['Rule.Enabled'] = params.Rule.Enabled ? 'true' : 'false'
    }

    if (params.Rule.TlsPolicy) {
      formParams['Rule.TlsPolicy'] = params.Rule.TlsPolicy
    }

    if (params.Rule.ScanEnabled !== undefined) {
      formParams['Rule.ScanEnabled'] = params.Rule.ScanEnabled ? 'true' : 'false'
    }

    // Add recipients
    if (params.Rule.Recipients) {
      params.Rule.Recipients.forEach((recipient, index) => {
        formParams[`Rule.Recipients.member.${index + 1}`] = recipient
      })
    }

    // Add actions
    params.Rule.Actions.forEach((action, index) => {
      const actionNum = index + 1

      if (action.S3Action) {
        formParams[`Rule.Actions.member.${actionNum}.S3Action.BucketName`] = action.S3Action.BucketName
        if (action.S3Action.ObjectKeyPrefix) {
          formParams[`Rule.Actions.member.${actionNum}.S3Action.ObjectKeyPrefix`] = action.S3Action.ObjectKeyPrefix
        }
        if (action.S3Action.KmsKeyArn) {
          formParams[`Rule.Actions.member.${actionNum}.S3Action.KmsKeyArn`] = action.S3Action.KmsKeyArn
        }
      }

      if (action.LambdaAction) {
        formParams[`Rule.Actions.member.${actionNum}.LambdaAction.FunctionArn`] = action.LambdaAction.FunctionArn
        formParams[`Rule.Actions.member.${actionNum}.LambdaAction.InvocationType`] = action.LambdaAction.InvocationType || 'Event'
      }

      if (action.SNSAction) {
        formParams[`Rule.Actions.member.${actionNum}.SNSAction.TopicArn`] = action.SNSAction.TopicArn
        if (action.SNSAction.Encoding) {
          formParams[`Rule.Actions.member.${actionNum}.SNSAction.Encoding`] = action.SNSAction.Encoding
        }
      }

      if (action.StopAction) {
        formParams[`Rule.Actions.member.${actionNum}.StopAction.Scope`] = action.StopAction.Scope
        if (action.StopAction.TopicArn) {
          formParams[`Rule.Actions.member.${actionNum}.StopAction.TopicArn`] = action.StopAction.TopicArn
        }
      }
    })

    await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody(formParams),
    })
  }

  /**
   * Send raw email (for SMTP relay)
   * Uses SES v1 API SendRawEmail action
   */
  async sendRawEmail(params: {
    source: string
    destinations: string[]
    rawMessage: string
  }): Promise<{ MessageId?: string }> {
    // Encode the raw message as base64
    const rawMessageBase64 = Buffer.from(params.rawMessage).toString('base64')

    const formParams: Record<string, string | undefined> = {
      Action: 'SendRawEmail',
      Version: '2010-12-01',
      Source: params.source,
      'RawMessage.Data': rawMessageBase64,
    }

    // Add destinations
    params.destinations.forEach((dest, index) => {
      formParams[`Destinations.member.${index + 1}`] = dest
    })

    const result = await this.client.request({
      service: 'ses',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildFormBody(formParams),
    })

    // Handle response format
    const response = result?.SendRawEmailResponse?.SendRawEmailResult
      || result?.SendRawEmailResult

    return {
      MessageId: response?.MessageId,
    }
  }
}
