/**
 * AWS Secrets Manager Client
 * Manages secrets using direct API calls
 */

import { AWSClient } from './client'

export interface Secret {
  ARN?: string
  Name?: string
  Description?: string
  KmsKeyId?: string
  RotationEnabled?: boolean
  RotationLambdaARN?: string
  RotationRules?: {
    AutomaticallyAfterDays?: number
    Duration?: string
    ScheduleExpression?: string
  }
  LastRotatedDate?: string
  LastChangedDate?: string
  LastAccessedDate?: string
  DeletedDate?: string
  NextRotationDate?: string
  Tags?: { Key: string, Value: string }[]
  SecretVersionsToStages?: Record<string, string[]>
  CreatedDate?: string
  PrimaryRegion?: string
}

export interface SecretValue {
  ARN?: string
  Name?: string
  VersionId?: string
  SecretBinary?: string
  SecretString?: string
  VersionStages?: string[]
  CreatedDate?: string
}

export interface CreateSecretOptions {
  Name: string
  Description?: string
  KmsKeyId?: string
  SecretBinary?: string
  SecretString?: string
  Tags?: { Key: string, Value: string }[]
  AddReplicaRegions?: { Region: string, KmsKeyId?: string }[]
  ForceOverwriteReplicaSecret?: boolean
  ClientRequestToken?: string
}

export interface UpdateSecretOptions {
  SecretId: string
  Description?: string
  KmsKeyId?: string
  SecretBinary?: string
  SecretString?: string
}

export interface PutSecretValueOptions {
  SecretId: string
  SecretBinary?: string
  SecretString?: string
  VersionStages?: string[]
  ClientRequestToken?: string
}

export interface GetSecretValueOptions {
  SecretId: string
  VersionId?: string
  VersionStage?: string
}

export interface RotationRules {
  AutomaticallyAfterDays?: number
  Duration?: string
  ScheduleExpression?: string
}

/**
 * Secrets Manager client using direct API calls
 */
export class SecretsManagerClient {
  private client: AWSClient
  private region: string

  constructor(region: string = 'us-east-1', profile?: string) {
    this.region = region
    this.client = new AWSClient()
  }

  /**
   * Create a new secret
   */
  async createSecret(options: CreateSecretOptions): Promise<{
    ARN?: string
    Name?: string
    VersionId?: string
    ReplicationStatus?: { Region: string, Status: string, StatusMessage?: string }[]
  }> {
    const params: Record<string, any> = {
      Name: options.Name,
    }

    if (options.Description) {
      params.Description = options.Description
    }

    if (options.KmsKeyId) {
      params.KmsKeyId = options.KmsKeyId
    }

    if (options.SecretBinary) {
      params.SecretBinary = options.SecretBinary
    }

    if (options.SecretString) {
      params.SecretString = options.SecretString
    }

    if (options.Tags && options.Tags.length > 0) {
      params.Tags = options.Tags
    }

    if (options.AddReplicaRegions && options.AddReplicaRegions.length > 0) {
      params.AddReplicaRegions = options.AddReplicaRegions
    }

    if (options.ForceOverwriteReplicaSecret !== undefined) {
      params.ForceOverwriteReplicaSecret = options.ForceOverwriteReplicaSecret
    }

    // Generate a unique client request token if not provided
    params.ClientRequestToken = options.ClientRequestToken || crypto.randomUUID()

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.CreateSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      VersionId: result.VersionId,
      ReplicationStatus: result.ReplicationStatus,
    }
  }

  /**
   * Update an existing secret's metadata
   */
  async updateSecret(options: UpdateSecretOptions): Promise<{
    ARN?: string
    Name?: string
    VersionId?: string
  }> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
    }

    if (options.Description) {
      params.Description = options.Description
    }

    if (options.KmsKeyId) {
      params.KmsKeyId = options.KmsKeyId
    }

    if (options.SecretBinary) {
      params.SecretBinary = options.SecretBinary
    }

    if (options.SecretString) {
      params.SecretString = options.SecretString
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.UpdateSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      VersionId: result.VersionId,
    }
  }

  /**
   * Put a new version of a secret value
   */
  async putSecretValue(options: PutSecretValueOptions): Promise<{
    ARN?: string
    Name?: string
    VersionId?: string
    VersionStages?: string[]
  }> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
    }

    if (options.SecretBinary) {
      params.SecretBinary = options.SecretBinary
    }

    if (options.SecretString) {
      params.SecretString = options.SecretString
    }

    if (options.VersionStages && options.VersionStages.length > 0) {
      params.VersionStages = options.VersionStages
    }

    if (options.ClientRequestToken) {
      params.ClientRequestToken = options.ClientRequestToken
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.PutSecretValue',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      VersionId: result.VersionId,
      VersionStages: result.VersionStages,
    }
  }

  /**
   * Get the value of a secret
   */
  async getSecretValue(options: GetSecretValueOptions): Promise<SecretValue> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
    }

    if (options.VersionId) {
      params.VersionId = options.VersionId
    }

    if (options.VersionStage) {
      params.VersionStage = options.VersionStage
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.GetSecretValue',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      VersionId: result.VersionId,
      SecretBinary: result.SecretBinary,
      SecretString: result.SecretString,
      VersionStages: result.VersionStages,
      CreatedDate: result.CreatedDate,
    }
  }

  /**
   * Describe a secret (metadata only)
   */
  async describeSecret(secretId: string): Promise<Secret> {
    const params: Record<string, any> = {
      SecretId: secretId,
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.DescribeSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return this.parseSecret(result)
  }

  /**
   * List secrets
   */
  async listSecrets(options?: {
    MaxResults?: number
    NextToken?: string
    Filters?: { Key: string, Values: string[] }[]
    SortOrder?: 'asc' | 'desc'
  }): Promise<{
    SecretList?: Secret[]
    NextToken?: string
  }> {
    const params: Record<string, any> = {}

    if (options?.MaxResults) {
      params.MaxResults = options.MaxResults
    }

    if (options?.NextToken) {
      params.NextToken = options.NextToken
    }

    if (options?.Filters && options.Filters.length > 0) {
      params.Filters = options.Filters
    }

    if (options?.SortOrder) {
      params.SortOrder = options.SortOrder
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.ListSecrets',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      SecretList: result.SecretList?.map((s: any) => this.parseSecret(s)),
      NextToken: result.NextToken,
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(options: {
    SecretId: string
    RecoveryWindowInDays?: number
    ForceDeleteWithoutRecovery?: boolean
  }): Promise<{
    ARN?: string
    Name?: string
    DeletionDate?: string
  }> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
    }

    if (options.RecoveryWindowInDays !== undefined) {
      params.RecoveryWindowInDays = options.RecoveryWindowInDays
    }

    if (options.ForceDeleteWithoutRecovery !== undefined) {
      params.ForceDeleteWithoutRecovery = options.ForceDeleteWithoutRecovery
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.DeleteSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      DeletionDate: result.DeletionDate,
    }
  }

  /**
   * Restore a deleted secret
   */
  async restoreSecret(secretId: string): Promise<{
    ARN?: string
    Name?: string
  }> {
    const params: Record<string, any> = {
      SecretId: secretId,
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.RestoreSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
    }
  }

  /**
   * Configure automatic rotation for a secret
   */
  async rotateSecret(options: {
    SecretId: string
    ClientRequestToken?: string
    RotationLambdaARN?: string
    RotationRules?: RotationRules
    RotateImmediately?: boolean
  }): Promise<{
    ARN?: string
    Name?: string
    VersionId?: string
  }> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
    }

    if (options.ClientRequestToken) {
      params.ClientRequestToken = options.ClientRequestToken
    }

    if (options.RotationLambdaARN) {
      params.RotationLambdaARN = options.RotationLambdaARN
    }

    if (options.RotationRules) {
      params.RotationRules = options.RotationRules
    }

    if (options.RotateImmediately !== undefined) {
      params.RotateImmediately = options.RotateImmediately
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.RotateSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      VersionId: result.VersionId,
    }
  }

  /**
   * Cancel rotation for a secret
   */
  async cancelRotateSecret(secretId: string): Promise<{
    ARN?: string
    Name?: string
  }> {
    const params: Record<string, any> = {
      SecretId: secretId,
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.CancelRotateSecret',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
    }
  }

  /**
   * Get resource policy for a secret
   */
  async getResourcePolicy(secretId: string): Promise<{
    ARN?: string
    Name?: string
    ResourcePolicy?: string
  }> {
    const params: Record<string, any> = {
      SecretId: secretId,
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.GetResourcePolicy',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
      ResourcePolicy: result.ResourcePolicy,
    }
  }

  /**
   * Put resource policy for a secret
   */
  async putResourcePolicy(options: {
    SecretId: string
    ResourcePolicy: string
    BlockPublicPolicy?: boolean
  }): Promise<{
    ARN?: string
    Name?: string
  }> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
      ResourcePolicy: options.ResourcePolicy,
    }

    if (options.BlockPublicPolicy !== undefined) {
      params.BlockPublicPolicy = options.BlockPublicPolicy
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.PutResourcePolicy',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
    }
  }

  /**
   * Delete resource policy for a secret
   */
  async deleteResourcePolicy(secretId: string): Promise<{
    ARN?: string
    Name?: string
  }> {
    const params: Record<string, any> = {
      SecretId: secretId,
    }

    const result = await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.DeleteResourcePolicy',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })

    return {
      ARN: result.ARN,
      Name: result.Name,
    }
  }

  /**
   * Tag a secret
   */
  async tagResource(options: {
    SecretId: string
    Tags: { Key: string, Value: string }[]
  }): Promise<void> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
      Tags: options.Tags,
    }

    await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.TagResource',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })
  }

  /**
   * Remove tags from a secret
   */
  async untagResource(options: {
    SecretId: string
    TagKeys: string[]
  }): Promise<void> {
    const params: Record<string, any> = {
      SecretId: options.SecretId,
      TagKeys: options.TagKeys,
    }

    await this.client.request({
      service: 'secretsmanager',
      region: this.region,
      method: 'POST',
      path: '/',
      headers: {
        'X-Amz-Target': 'secretsmanager.UntagResource',
        'Content-Type': 'application/x-amz-json-1.1',
      },
      body: JSON.stringify(params),
    })
  }

  /**
   * Helper: Set a string secret
   */
  async setString(name: string, value: string, options?: {
    description?: string
    kmsKeyId?: string
    tags?: { Key: string, Value: string }[]
  }): Promise<{ ARN?: string, VersionId?: string }> {
    // Try to update existing, create if doesn't exist
    try {
      const result = await this.putSecretValue({
        SecretId: name,
        SecretString: value,
      })
      return { ARN: result.ARN, VersionId: result.VersionId }
    }
    catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        const result = await this.createSecret({
          Name: name,
          SecretString: value,
          Description: options?.description,
          KmsKeyId: options?.kmsKeyId,
          Tags: options?.tags,
        })
        return { ARN: result.ARN, VersionId: result.VersionId }
      }
      throw error
    }
  }

  /**
   * Helper: Set a JSON secret
   */
  async setJson(name: string, value: Record<string, any>, options?: {
    description?: string
    kmsKeyId?: string
    tags?: { Key: string, Value: string }[]
  }): Promise<{ ARN?: string, VersionId?: string }> {
    return this.setString(name, JSON.stringify(value), options)
  }

  /**
   * Helper: Get a string secret value
   */
  async getString(secretId: string): Promise<string | undefined> {
    const result = await this.getSecretValue({ SecretId: secretId })
    return result.SecretString
  }

  /**
   * Helper: Get a JSON secret value
   */
  async getJson<T = Record<string, any>>(secretId: string): Promise<T | undefined> {
    const str = await this.getString(secretId)
    if (str) {
      return JSON.parse(str) as T
    }
    return undefined
  }

  /**
   * Helper: List all secrets
   */
  async listAll(): Promise<Secret[]> {
    const allSecrets: Secret[] = []
    let nextToken: string | undefined

    do {
      const result = await this.listSecrets({ NextToken: nextToken })

      if (result.SecretList) {
        allSecrets.push(...result.SecretList)
      }

      nextToken = result.NextToken
    } while (nextToken)

    return allSecrets
  }

  /**
   * Parse secret response
   */
  private parseSecret(s: any): Secret {
    return {
      ARN: s.ARN,
      Name: s.Name,
      Description: s.Description,
      KmsKeyId: s.KmsKeyId,
      RotationEnabled: s.RotationEnabled,
      RotationLambdaARN: s.RotationLambdaARN,
      RotationRules: s.RotationRules,
      LastRotatedDate: s.LastRotatedDate,
      LastChangedDate: s.LastChangedDate,
      LastAccessedDate: s.LastAccessedDate,
      DeletedDate: s.DeletedDate,
      NextRotationDate: s.NextRotationDate,
      Tags: s.Tags,
      SecretVersionsToStages: s.SecretVersionsToStages,
      CreatedDate: s.CreatedDate,
      PrimaryRegion: s.PrimaryRegion,
    }
  }
}
