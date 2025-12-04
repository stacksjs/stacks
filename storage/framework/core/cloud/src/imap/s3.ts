/**
 * AWS S3 Operations
 * Direct API calls without AWS CLI dependency
 */

import * as crypto from 'node:crypto'
import { AWSClient } from './client'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

export interface S3SyncOptions {
  source: string
  bucket: string
  prefix?: string
  delete?: boolean
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'
  cacheControl?: string
  contentType?: string
  metadata?: Record<string, string>
  exclude?: string[]
  include?: string[]
  dryRun?: boolean
}

export interface S3CopyOptions {
  source: string
  bucket: string
  key: string
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'
  cacheControl?: string
  contentType?: string
  metadata?: Record<string, string>
}

export interface S3ListOptions {
  bucket: string
  prefix?: string
  maxKeys?: number
}

export interface S3Object {
  Key: string
  LastModified: string
  Size: number
  ETag?: string
}

/**
 * S3 client using direct API calls
 */
export class S3Client {
  private client: AWSClient
  private region: string

  constructor(region: string = 'us-east-1', profile?: string) {
    this.region = region
    this.client = new AWSClient()
  }

  /**
   * Get AWS credentials from environment
   */
  private getCredentials(): { accessKeyId: string, secretAccessKey: string, sessionToken?: string } {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const sessionToken = process.env.AWS_SESSION_TOKEN

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.')
    }

    return { accessKeyId, secretAccessKey, sessionToken }
  }

  /**
   * List all S3 buckets in the account
   */
  async listBuckets(): Promise<{ Buckets: Array<{ Name: string, CreationDate?: string }> }> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: '/',
    })

    const buckets: Array<{ Name: string, CreationDate?: string }> = []
    const bucketList = result?.ListAllMyBucketsResult?.Buckets?.Bucket

    if (bucketList) {
      const list = Array.isArray(bucketList) ? bucketList : [bucketList]
      for (const b of list) {
        buckets.push({
          Name: b.Name,
          CreationDate: b.CreationDate,
        })
      }
    }

    return { Buckets: buckets }
  }

  /**
   * Create an S3 bucket
   */
  async createBucket(bucket: string, options?: { acl?: string }): Promise<void> {
    const headers: Record<string, string> = {}
    if (options?.acl) {
      headers['x-amz-acl'] = options.acl
    }

    // For us-east-1, don't include LocationConstraint
    // For other regions, include it in the body
    let body: string | undefined
    if (this.region !== 'us-east-1') {
      body = `<?xml version="1.0" encoding="UTF-8"?>
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LocationConstraint>${this.region}</LocationConstraint>
</CreateBucketConfiguration>`
      headers['Content-Type'] = 'application/xml'
    }

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      headers,
      body,
    })
  }

  /**
   * Delete an S3 bucket (must be empty)
   */
  async deleteBucket(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
    })
  }

  /**
   * Empty and delete an S3 bucket
   */
  async emptyAndDeleteBucket(bucket: string): Promise<void> {
    // First list and delete all objects
    let hasMore = true
    while (hasMore) {
      const objects = await this.listAllObjects({ bucket })
      if (objects.length === 0) {
        hasMore = false
        break
      }

      // Delete in batches of 1000 (S3 limit)
      const keys = objects.map(obj => obj.Key)
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        await this.deleteObjects(bucket, batch)
      }
    }

    // Now delete the bucket
    await this.deleteBucket(bucket)
  }

  /**
   * List all objects in a bucket (handles pagination)
   */
  async listAllObjects(options: S3ListOptions): Promise<S3Object[]> {
    const allObjects: S3Object[] = []
    let continuationToken: string | undefined

    do {
      const params: Record<string, any> = {
        'list-type': '2',
        'max-keys': '1000',
      }

      if (options.prefix) {
        params.prefix = options.prefix
      }

      if (continuationToken) {
        params['continuation-token'] = continuationToken
      }

      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${options.bucket}`,
        queryParams: params,
      })

      const contents = result?.ListBucketResult?.Contents
      if (contents) {
        const list = Array.isArray(contents) ? contents : [contents]
        for (const obj of list) {
          allObjects.push({
            Key: obj.Key,
            LastModified: obj.LastModified || '',
            Size: Number.parseInt(obj.Size || '0'),
            ETag: obj.ETag,
          })
        }
      }

      // Check for more results
      const isTruncated = result?.ListBucketResult?.IsTruncated
      continuationToken = isTruncated === 'true' || isTruncated === true
        ? result?.ListBucketResult?.NextContinuationToken
        : undefined

    } while (continuationToken)

    return allObjects
  }

  /**
   * List objects in S3 bucket
   */
  async list(options: S3ListOptions): Promise<S3Object[]> {
    // Use path-style URL without query params for simpler signing
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${options.bucket}`,
    })

    // Parse S3 XML response
    const objects: S3Object[] = []

    // Handle ListBucketResult structure from XML parsing
    const contents = result?.ListBucketResult?.Contents
    if (contents) {
      const items = Array.isArray(contents) ? contents : [contents]
      for (const item of items) {
        // Filter by prefix if specified
        if (options.prefix && !item.Key?.startsWith(options.prefix)) {
          continue
        }
        objects.push({
          Key: item.Key || '',
          LastModified: item.LastModified || '',
          Size: Number.parseInt(item.Size || '0'),
          ETag: item.ETag,
        })
        // Respect maxKeys
        if (options.maxKeys && objects.length >= options.maxKeys) {
          break
        }
      }
    }

    return objects
  }

  /**
   * Put object to S3 bucket
   */
  async putObject(options: {
    bucket: string
    key: string
    body: string | Buffer
    acl?: string
    cacheControl?: string
    contentType?: string
    metadata?: Record<string, string>
  }): Promise<void> {
    const headers: Record<string, string> = {}

    if (options.acl) {
      headers['x-amz-acl'] = options.acl
    }

    if (options.cacheControl) {
      headers['Cache-Control'] = options.cacheControl
    }

    if (options.contentType) {
      headers['Content-Type'] = options.contentType
    }

    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        headers[`x-amz-meta-${key}`] = value
      }
    }

    // For binary data (Buffer), we need to convert to base64 and set proper content encoding
    // or pass the raw binary. Since fetch supports Buffer directly, we can use it.
    const bodyContent = typeof options.body === 'string'
      ? options.body
      : Buffer.isBuffer(options.body)
        ? options.body.toString('base64')
        : String(options.body)

    // If we're sending base64-encoded binary, mark it in headers
    if (Buffer.isBuffer(options.body)) {
      // Actually, for S3 we need to send raw binary, not base64
      // Let's use Bun's fetch which handles Buffer natively
      const { accessKeyId, secretAccessKey, sessionToken } = this.getCredentials()
      const host = `${options.bucket}.s3.${this.region}.amazonaws.com`
      const url = `https://${host}/${options.key}`

      const now = new Date()
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
      const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')

      const payloadHash = crypto.createHash('sha256').update(options.body).digest('hex')

      const requestHeaders: Record<string, string> = {
        'host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        ...headers,
      }

      if (sessionToken) {
        requestHeaders['x-amz-security-token'] = sessionToken
      }

      // Create canonical request
      const canonicalHeaders = Object.keys(requestHeaders)
        .sort()
        .map(key => `${key.toLowerCase()}:${requestHeaders[key].trim()}\n`)
        .join('')

      const signedHeaders = Object.keys(requestHeaders)
        .sort()
        .map(key => key.toLowerCase())
        .join(';')

      const canonicalRequest = [
        'PUT',
        `/${options.key}`,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n')

      // Create string to sign
      const algorithm = 'AWS4-HMAC-SHA256'
      const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
      const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
      ].join('\n')

      // Calculate signature
      const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest()
      const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
      const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

      const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...requestHeaders,
          'Authorization': authorizationHeader,
        },
        body: options.body,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`S3 PUT failed: ${response.status} ${errorText}`)
      }

      return
    }

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${options.bucket}/${options.key}`,
      headers,
      body: bodyContent,
    })
  }

  /**
   * Get object from S3 bucket
   * Returns raw content as string (not parsed as XML)
   */
  async getObject(bucket: string, key: string): Promise<string> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}/${key}`,
      rawResponse: true,
    })

    return result
  }

  /**
   * Copy object within S3 (server-side copy)
   */
  async copyObject(options: {
    sourceBucket: string
    sourceKey: string
    destinationBucket: string
    destinationKey: string
    contentType?: string
    metadata?: Record<string, string>
    metadataDirective?: 'COPY' | 'REPLACE'
  }): Promise<void> {
    const headers: Record<string, string> = {
      'x-amz-copy-source': `/${options.sourceBucket}/${options.sourceKey}`,
    }

    if (options.metadataDirective) {
      headers['x-amz-metadata-directive'] = options.metadataDirective
    }

    if (options.contentType) {
      headers['Content-Type'] = options.contentType
    }

    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        headers[`x-amz-meta-${key}`] = value
      }
    }

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${options.destinationBucket}/${options.destinationKey}`,
      headers,
    })
  }

  /**
   * Delete object from S3
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}/${key}`,
    })
  }

  /**
   * Delete multiple objects from S3
   */
  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    const deleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<Delete>
  ${keys.map(key => `<Object><Key>${key}</Key></Object>`).join('\n  ')}
</Delete>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'POST',
      path: `/${bucket}`,
      queryParams: { delete: '' },
      body: deleteXml,
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucket: string): Promise<boolean> {
    try {
      await this.client.request({
        service: 's3',
        region: this.region,
        method: 'HEAD',
        path: `/${bucket}`,
      })
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Copy file to S3
   */
  async copy(options: S3CopyOptions): Promise<void> {
    // Read file and upload
    const fileContent = readFileSync(options.source)

    await this.putObject({
      bucket: options.bucket,
      key: options.key,
      body: fileContent,
      acl: options.acl,
      cacheControl: options.cacheControl,
      contentType: options.contentType,
      metadata: options.metadata,
    })
  }

  /**
   * Sync local directory to S3 bucket
   * Note: This is a simplified version. For production use, implement proper sync logic
   */
  async sync(options: S3SyncOptions): Promise<void> {
    const files = await this.listFilesRecursive(options.source)

    for (const file of files) {
      // Skip excluded files
      if (options.exclude && options.exclude.some(pattern => file.includes(pattern))) {
        continue
      }

      // Check included files
      if (options.include && !options.include.some(pattern => file.includes(pattern))) {
        continue
      }

      const relativePath = file.substring(options.source.length + 1)
      const s3Key = options.prefix ? `${options.prefix}/${relativePath}` : relativePath

      if (!options.dryRun) {
        const fileContent = readFileSync(file)

        await this.putObject({
          bucket: options.bucket,
          key: s3Key,
          body: fileContent,
          acl: options.acl,
          cacheControl: options.cacheControl,
          contentType: options.contentType,
          metadata: options.metadata,
        })
      }
    }
  }

  /**
   * Delete object from S3 (alias for deleteObject)
   */
  async delete(bucket: string, key: string): Promise<void> {
    await this.deleteObject(bucket, key)
  }

  /**
   * Delete all objects in a prefix
   */
  async deletePrefix(bucket: string, prefix: string): Promise<void> {
    const objects = await this.list({ bucket, prefix })
    const keys = objects.map(obj => obj.Key)

    if (keys.length > 0) {
      await this.deleteObjects(bucket, keys)
    }
  }

  /**
   * Get bucket size
   */
  async getBucketSize(bucket: string, prefix?: string): Promise<number> {
    const objects = await this.list({ bucket, prefix })
    return objects.reduce((total, obj) => total + obj.Size, 0)
  }

  /**
   * List files recursively in a directory
   */
  private async listFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await this.listFilesRecursive(fullPath)
        files.push(...subFiles)
      }
      else {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Put bucket policy for an S3 bucket
   * Uses path-style URLs to avoid redirect issues
   */
  async putBucketPolicy(bucket: string, policy: object | string): Promise<void> {
    const { accessKeyId, secretAccessKey, sessionToken } = this.getCredentials()
    const host = `s3.${this.region}.amazonaws.com`
    const policyString = typeof policy === 'string' ? policy : JSON.stringify(policy)

    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')

    const payloadHash = crypto.createHash('sha256').update(policyString).digest('hex')

    // Use path-style URL: s3.region.amazonaws.com/bucket?policy
    const canonicalUri = '/' + bucket
    const canonicalQuerystring = 'policy='

    const requestHeaders: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'content-type': 'application/json',
    }

    if (sessionToken) {
      requestHeaders['x-amz-security-token'] = sessionToken
    }

    const canonicalHeaders = Object.keys(requestHeaders)
      .sort()
      .map(key => `${key.toLowerCase()}:${requestHeaders[key].trim()}\n`)
      .join('')

    const signedHeaders = Object.keys(requestHeaders)
      .sort()
      .map(key => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const url = `https://${host}${canonicalUri}?${canonicalQuerystring}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...requestHeaders,
        'Authorization': authHeader,
      },
      body: policyString,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to put bucket policy: ${response.status} ${text}`)
    }
  }

  /**
   * Get bucket policy for an S3 bucket
   * Uses path-style URLs to avoid redirect issues
   */
  async getBucketPolicy(bucket: string): Promise<object | null> {
    const { accessKeyId, secretAccessKey, sessionToken } = this.getCredentials()
    const host = `s3.${this.region}.amazonaws.com`

    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')

    const payloadHash = crypto.createHash('sha256').update('').digest('hex')

    // Use path-style URL: s3.region.amazonaws.com/bucket?policy
    const canonicalUri = '/' + bucket
    const canonicalQuerystring = 'policy='

    const requestHeaders: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    }

    if (sessionToken) {
      requestHeaders['x-amz-security-token'] = sessionToken
    }

    const canonicalHeaders = Object.keys(requestHeaders)
      .sort()
      .map(key => `${key.toLowerCase()}:${requestHeaders[key].trim()}\n`)
      .join('')

    const signedHeaders = Object.keys(requestHeaders)
      .sort()
      .map(key => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const url = `https://${host}${canonicalUri}?${canonicalQuerystring}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...requestHeaders,
        'Authorization': authHeader,
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to get bucket policy: ${response.status} ${text}`)
    }

    const text = await response.text()
    return JSON.parse(text)
  }

  /**
   * Delete bucket policy
   */
  async deleteBucketPolicy(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { policy: '' },
    })
  }

  /**
   * Head bucket - check if bucket exists and you have access
   */
  async headBucket(bucket: string): Promise<{ exists: boolean; region?: string }> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'HEAD',
        path: `/${bucket}`,
        returnHeaders: true,
      })
      return { exists: true, region: result?.headers?.['x-amz-bucket-region'] }
    } catch (e: any) {
      if (e.statusCode === 404) {
        return { exists: false }
      }
      throw e
    }
  }

  /**
   * Head object - get object metadata without downloading
   */
  async headObject(bucket: string, key: string): Promise<{
    ContentLength?: number
    ContentType?: string
    ETag?: string
    LastModified?: string
    Metadata?: Record<string, string>
  } | null> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'HEAD',
        path: `/${bucket}/${key}`,
        returnHeaders: true,
      })
      return {
        ContentLength: result?.headers?.['content-length'] ? parseInt(result.headers['content-length']) : undefined,
        ContentType: result?.headers?.['content-type'],
        ETag: result?.headers?.['etag'],
        LastModified: result?.headers?.['last-modified'],
      }
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Get object as Buffer
   */
  async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    const content = await this.getObject(bucket, key)
    return Buffer.from(content)
  }

  /**
   * Get object as JSON
   */
  async getObjectJson<T = any>(bucket: string, key: string): Promise<T> {
    const content = await this.getObject(bucket, key)
    return JSON.parse(content)
  }

  /**
   * Put JSON object
   */
  async putObjectJson(bucket: string, key: string, data: any, options?: {
    acl?: string
    cacheControl?: string
    metadata?: Record<string, string>
  }): Promise<void> {
    await this.putObject({
      bucket,
      key,
      body: JSON.stringify(data),
      contentType: 'application/json',
      ...options,
    })
  }

  /**
   * Get bucket versioning configuration
   */
  async getBucketVersioning(bucket: string): Promise<{ Status?: 'Enabled' | 'Suspended' }> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { versioning: '' },
    })
    return {
      Status: result?.VersioningConfiguration?.Status,
    }
  }

  /**
   * Put bucket versioning configuration
   */
  async putBucketVersioning(bucket: string, status: 'Enabled' | 'Suspended'): Promise<void> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Status>${status}</Status>
</VersioningConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { versioning: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Get bucket lifecycle configuration
   */
  async getBucketLifecycleConfiguration(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { lifecycle: '' },
      })
      return result?.LifecycleConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Put bucket lifecycle configuration
   */
  async putBucketLifecycleConfiguration(bucket: string, rules: Array<{
    ID: string
    Status: 'Enabled' | 'Disabled'
    Filter?: { Prefix?: string }
    Expiration?: { Days?: number; Date?: string }
    Transitions?: Array<{ Days?: number; StorageClass: string }>
    NoncurrentVersionExpiration?: { NoncurrentDays: number }
  }>): Promise<void> {
    const rulesXml = rules.map(rule => {
      let ruleXml = `<Rule><ID>${rule.ID}</ID><Status>${rule.Status}</Status>`
      
      if (rule.Filter) {
        ruleXml += `<Filter><Prefix>${rule.Filter.Prefix || ''}</Prefix></Filter>`
      } else {
        ruleXml += '<Filter><Prefix></Prefix></Filter>'
      }
      
      if (rule.Expiration) {
        if (rule.Expiration.Days) {
          ruleXml += `<Expiration><Days>${rule.Expiration.Days}</Days></Expiration>`
        } else if (rule.Expiration.Date) {
          ruleXml += `<Expiration><Date>${rule.Expiration.Date}</Date></Expiration>`
        }
      }
      
      if (rule.Transitions) {
        for (const t of rule.Transitions) {
          ruleXml += `<Transition><Days>${t.Days}</Days><StorageClass>${t.StorageClass}</StorageClass></Transition>`
        }
      }
      
      if (rule.NoncurrentVersionExpiration) {
        ruleXml += `<NoncurrentVersionExpiration><NoncurrentDays>${rule.NoncurrentVersionExpiration.NoncurrentDays}</NoncurrentDays></NoncurrentVersionExpiration>`
      }
      
      ruleXml += '</Rule>'
      return ruleXml
    }).join('')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${rulesXml}
</LifecycleConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { lifecycle: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete bucket lifecycle configuration
   */
  async deleteBucketLifecycleConfiguration(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { lifecycle: '' },
    })
  }

  /**
   * Get bucket CORS configuration
   */
  async getBucketCors(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { cors: '' },
      })
      return result?.CORSConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Put bucket CORS configuration
   */
  async putBucketCors(bucket: string, rules: Array<{
    AllowedOrigins: string[]
    AllowedMethods: string[]
    AllowedHeaders?: string[]
    ExposeHeaders?: string[]
    MaxAgeSeconds?: number
  }>): Promise<void> {
    const rulesXml = rules.map(rule => {
      let ruleXml = '<CORSRule>'
      for (const origin of rule.AllowedOrigins) {
        ruleXml += `<AllowedOrigin>${origin}</AllowedOrigin>`
      }
      for (const method of rule.AllowedMethods) {
        ruleXml += `<AllowedMethod>${method}</AllowedMethod>`
      }
      if (rule.AllowedHeaders) {
        for (const header of rule.AllowedHeaders) {
          ruleXml += `<AllowedHeader>${header}</AllowedHeader>`
        }
      }
      if (rule.ExposeHeaders) {
        for (const header of rule.ExposeHeaders) {
          ruleXml += `<ExposeHeader>${header}</ExposeHeader>`
        }
      }
      if (rule.MaxAgeSeconds) {
        ruleXml += `<MaxAgeSeconds>${rule.MaxAgeSeconds}</MaxAgeSeconds>`
      }
      ruleXml += '</CORSRule>'
      return ruleXml
    }).join('')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  ${rulesXml}
</CORSConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { cors: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete bucket CORS configuration
   */
  async deleteBucketCors(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { cors: '' },
    })
  }

  /**
   * Get bucket encryption configuration
   */
  async getBucketEncryption(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { encryption: '' },
      })
      return result?.ServerSideEncryptionConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Put bucket encryption configuration
   */
  async putBucketEncryption(bucket: string, sseAlgorithm: 'AES256' | 'aws:kms', kmsKeyId?: string): Promise<void> {
    let ruleXml = `<ApplyServerSideEncryptionByDefault><SSEAlgorithm>${sseAlgorithm}</SSEAlgorithm>`
    if (kmsKeyId) {
      ruleXml += `<KMSMasterKeyID>${kmsKeyId}</KMSMasterKeyID>`
    }
    ruleXml += '</ApplyServerSideEncryptionByDefault>'

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Rule>${ruleXml}</Rule>
</ServerSideEncryptionConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { encryption: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete bucket encryption configuration
   */
  async deleteBucketEncryption(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { encryption: '' },
    })
  }

  /**
   * Get bucket tagging
   */
  async getBucketTagging(bucket: string): Promise<Array<{ Key: string; Value: string }>> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { tagging: '' },
      })
      const tagSet = result?.Tagging?.TagSet?.Tag
      if (!tagSet) return []
      return Array.isArray(tagSet) ? tagSet : [tagSet]
    } catch (e: any) {
      if (e.statusCode === 404) {
        return []
      }
      throw e
    }
  }

  /**
   * Put bucket tagging
   */
  async putBucketTagging(bucket: string, tags: Array<{ Key: string; Value: string }>): Promise<void> {
    const tagsXml = tags.map(t => `<Tag><Key>${t.Key}</Key><Value>${t.Value}</Value></Tag>`).join('')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<Tagging>
  <TagSet>${tagsXml}</TagSet>
</Tagging>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { tagging: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete bucket tagging
   */
  async deleteBucketTagging(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { tagging: '' },
    })
  }

  /**
   * Get object tagging
   */
  async getObjectTagging(bucket: string, key: string): Promise<Array<{ Key: string; Value: string }>> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}/${key}`,
        queryParams: { tagging: '' },
      })
      const tagSet = result?.Tagging?.TagSet?.Tag
      if (!tagSet) return []
      return Array.isArray(tagSet) ? tagSet : [tagSet]
    } catch (e: any) {
      if (e.statusCode === 404) {
        return []
      }
      throw e
    }
  }

  /**
   * Put object tagging
   */
  async putObjectTagging(bucket: string, key: string, tags: Array<{ Key: string; Value: string }>): Promise<void> {
    const tagsXml = tags.map(t => `<Tag><Key>${t.Key}</Key><Value>${t.Value}</Value></Tag>`).join('')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<Tagging>
  <TagSet>${tagsXml}</TagSet>
</Tagging>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}/${key}`,
      queryParams: { tagging: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete object tagging
   */
  async deleteObjectTagging(bucket: string, key: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}/${key}`,
      queryParams: { tagging: '' },
    })
  }

  /**
   * Get bucket ACL
   */
  async getBucketAcl(bucket: string): Promise<any> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { acl: '' },
    })
    return result?.AccessControlPolicy
  }

  /**
   * Put bucket ACL (canned ACL)
   */
  async putBucketAcl(bucket: string, acl: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { acl: '' },
      headers: { 'x-amz-acl': acl },
    })
  }

  /**
   * Get object ACL
   */
  async getObjectAcl(bucket: string, key: string): Promise<any> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}/${key}`,
      queryParams: { acl: '' },
    })
    return result?.AccessControlPolicy
  }

  /**
   * Put object ACL (canned ACL)
   */
  async putObjectAcl(bucket: string, key: string, acl: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}/${key}`,
      queryParams: { acl: '' },
      headers: { 'x-amz-acl': acl },
    })
  }

  /**
   * Get bucket location
   */
  async getBucketLocation(bucket: string): Promise<string> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { location: '' },
    })
    // Empty string means us-east-1
    return result?.LocationConstraint || 'us-east-1'
  }

  /**
   * Get bucket logging configuration
   */
  async getBucketLogging(bucket: string): Promise<any> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { logging: '' },
    })
    return result?.BucketLoggingStatus
  }

  /**
   * Put bucket logging configuration
   */
  async putBucketLogging(bucket: string, targetBucket: string, targetPrefix: string): Promise<void> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<BucketLoggingStatus xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LoggingEnabled>
    <TargetBucket>${targetBucket}</TargetBucket>
    <TargetPrefix>${targetPrefix}</TargetPrefix>
  </LoggingEnabled>
</BucketLoggingStatus>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { logging: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Get bucket notification configuration
   */
  async getBucketNotificationConfiguration(bucket: string): Promise<any> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { notification: '' },
    })
    return result?.NotificationConfiguration
  }

  /**
   * Put bucket notification configuration
   */
  async putBucketNotificationConfiguration(bucket: string, config: {
    LambdaFunctionConfigurations?: Array<{
      Id?: string
      LambdaFunctionArn: string
      Events: string[]
      Filter?: { Key?: { FilterRules: Array<{ Name: string; Value: string }> } }
    }>
    TopicConfigurations?: Array<{
      Id?: string
      TopicArn: string
      Events: string[]
      Filter?: { Key?: { FilterRules: Array<{ Name: string; Value: string }> } }
    }>
    QueueConfigurations?: Array<{
      Id?: string
      QueueArn: string
      Events: string[]
      Filter?: { Key?: { FilterRules: Array<{ Name: string; Value: string }> } }
    }>
  }): Promise<void> {
    let configXml = ''

    if (config.LambdaFunctionConfigurations) {
      for (const c of config.LambdaFunctionConfigurations) {
        configXml += '<CloudFunctionConfiguration>'
        if (c.Id) configXml += `<Id>${c.Id}</Id>`
        configXml += `<CloudFunction>${c.LambdaFunctionArn}</CloudFunction>`
        for (const event of c.Events) {
          configXml += `<Event>${event}</Event>`
        }
        if (c.Filter?.Key?.FilterRules) {
          configXml += '<Filter><S3Key>'
          for (const rule of c.Filter.Key.FilterRules) {
            configXml += `<FilterRule><Name>${rule.Name}</Name><Value>${rule.Value}</Value></FilterRule>`
          }
          configXml += '</S3Key></Filter>'
        }
        configXml += '</CloudFunctionConfiguration>'
      }
    }

    if (config.TopicConfigurations) {
      for (const c of config.TopicConfigurations) {
        configXml += '<TopicConfiguration>'
        if (c.Id) configXml += `<Id>${c.Id}</Id>`
        configXml += `<Topic>${c.TopicArn}</Topic>`
        for (const event of c.Events) {
          configXml += `<Event>${event}</Event>`
        }
        configXml += '</TopicConfiguration>'
      }
    }

    if (config.QueueConfigurations) {
      for (const c of config.QueueConfigurations) {
        configXml += '<QueueConfiguration>'
        if (c.Id) configXml += `<Id>${c.Id}</Id>`
        configXml += `<Queue>${c.QueueArn}</Queue>`
        for (const event of c.Events) {
          configXml += `<Event>${event}</Event>`
        }
        configXml += '</QueueConfiguration>'
      }
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<NotificationConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${configXml}
</NotificationConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { notification: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Get bucket website configuration
   */
  async getBucketWebsite(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { website: '' },
      })
      return result?.WebsiteConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Put bucket website configuration
   */
  async putBucketWebsite(bucket: string, config: {
    IndexDocument: string
    ErrorDocument?: string
    RedirectAllRequestsTo?: { HostName: string; Protocol?: string }
  }): Promise<void> {
    let configXml = ''

    if (config.RedirectAllRequestsTo) {
      configXml = `<RedirectAllRequestsTo>
        <HostName>${config.RedirectAllRequestsTo.HostName}</HostName>
        ${config.RedirectAllRequestsTo.Protocol ? `<Protocol>${config.RedirectAllRequestsTo.Protocol}</Protocol>` : ''}
      </RedirectAllRequestsTo>`
    } else {
      configXml = `<IndexDocument><Suffix>${config.IndexDocument}</Suffix></IndexDocument>`
      if (config.ErrorDocument) {
        configXml += `<ErrorDocument><Key>${config.ErrorDocument}</Key></ErrorDocument>`
      }
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${configXml}
</WebsiteConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { website: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete bucket website configuration
   */
  async deleteBucketWebsite(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { website: '' },
    })
  }

  /**
   * Get bucket replication configuration
   */
  async getBucketReplication(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { replication: '' },
      })
      return result?.ReplicationConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Delete bucket replication configuration
   */
  async deleteBucketReplication(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { replication: '' },
    })
  }

  /**
   * Get public access block configuration
   */
  async getPublicAccessBlock(bucket: string): Promise<any> {
    try {
      const result = await this.client.request({
        service: 's3',
        region: this.region,
        method: 'GET',
        path: `/${bucket}`,
        queryParams: { publicAccessBlock: '' },
      })
      return result?.PublicAccessBlockConfiguration
    } catch (e: any) {
      if (e.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  /**
   * Put public access block configuration
   */
  async putPublicAccessBlock(bucket: string, config: {
    BlockPublicAcls?: boolean
    IgnorePublicAcls?: boolean
    BlockPublicPolicy?: boolean
    RestrictPublicBuckets?: boolean
  }): Promise<void> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <BlockPublicAcls>${config.BlockPublicAcls ?? true}</BlockPublicAcls>
  <IgnorePublicAcls>${config.IgnorePublicAcls ?? true}</IgnorePublicAcls>
  <BlockPublicPolicy>${config.BlockPublicPolicy ?? true}</BlockPublicPolicy>
  <RestrictPublicBuckets>${config.RestrictPublicBuckets ?? true}</RestrictPublicBuckets>
</PublicAccessBlockConfiguration>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'PUT',
      path: `/${bucket}`,
      queryParams: { publicAccessBlock: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Delete public access block configuration
   */
  async deletePublicAccessBlock(bucket: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}`,
      queryParams: { publicAccessBlock: '' },
    })
  }

  /**
   * Generate a presigned URL for GET
   */
  generatePresignedGetUrl(bucket: string, key: string, expiresInSeconds: number = 3600): string {
    const { accessKeyId, secretAccessKey } = this.getCredentials()
    const host = `${bucket}.s3.${this.region}.amazonaws.com`
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const credential = `${accessKeyId}/${credentialScope}`

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresInSeconds.toString(),
      'X-Amz-SignedHeaders': 'host',
    })

    const canonicalRequest = [
      'GET',
      `/${key}`,
      queryParams.toString(),
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    queryParams.append('X-Amz-Signature', signature)

    return `https://${host}/${key}?${queryParams.toString()}`
  }

  /**
   * Generate a presigned URL for PUT
   */
  generatePresignedPutUrl(bucket: string, key: string, contentType: string, expiresInSeconds: number = 3600): string {
    const { accessKeyId, secretAccessKey } = this.getCredentials()
    const host = `${bucket}.s3.${this.region}.amazonaws.com`
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const credential = `${accessKeyId}/${credentialScope}`

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresInSeconds.toString(),
      'X-Amz-SignedHeaders': 'content-type;host',
    })

    const canonicalRequest = [
      'PUT',
      `/${key}`,
      queryParams.toString(),
      `content-type:${contentType}\nhost:${host}\n`,
      'content-type;host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    queryParams.append('X-Amz-Signature', signature)

    return `https://${host}/${key}?${queryParams.toString()}`
  }

  /**
   * Initiate multipart upload
   */
  async createMultipartUpload(bucket: string, key: string, options?: {
    contentType?: string
    metadata?: Record<string, string>
  }): Promise<{ UploadId: string }> {
    const headers: Record<string, string> = {}
    if (options?.contentType) {
      headers['Content-Type'] = options.contentType
    }
    if (options?.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        headers[`x-amz-meta-${k}`] = v
      }
    }

    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'POST',
      path: `/${bucket}/${key}`,
      queryParams: { uploads: '' },
      headers,
    })

    return { UploadId: result?.InitiateMultipartUploadResult?.UploadId }
  }

  /**
   * Upload a part in multipart upload
   */
  async uploadPart(bucket: string, key: string, uploadId: string, partNumber: number, body: Buffer): Promise<{ ETag: string }> {
    const { accessKeyId, secretAccessKey, sessionToken } = this.getCredentials()
    const host = `${bucket}.s3.${this.region}.amazonaws.com`
    const url = `https://${host}/${key}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`

    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex')

    const requestHeaders: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    }

    if (sessionToken) {
      requestHeaders['x-amz-security-token'] = sessionToken
    }

    const canonicalHeaders = Object.keys(requestHeaders)
      .sort()
      .map(k => `${k.toLowerCase()}:${requestHeaders[k].trim()}\n`)
      .join('')

    const signedHeaders = Object.keys(requestHeaders)
      .sort()
      .map(k => k.toLowerCase())
      .join(';')

    const canonicalRequest = [
      'PUT',
      `/${key}`,
      `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...requestHeaders,
        'Authorization': authHeader,
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Upload part failed: ${response.status} ${text}`)
    }

    return { ETag: response.headers.get('etag') || '' }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: Array<{ PartNumber: number; ETag: string }>): Promise<void> {
    const partsXml = parts
      .sort((a, b) => a.PartNumber - b.PartNumber)
      .map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
      .join('')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'POST',
      path: `/${bucket}/${key}`,
      queryParams: { uploadId },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'DELETE',
      path: `/${bucket}/${key}`,
      queryParams: { uploadId },
    })
  }

  /**
   * List multipart uploads
   */
  async listMultipartUploads(bucket: string): Promise<Array<{ Key: string; UploadId: string; Initiated: string }>> {
    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'GET',
      path: `/${bucket}`,
      queryParams: { uploads: '' },
    })

    const uploads = result?.ListMultipartUploadsResult?.Upload
    if (!uploads) return []
    const list = Array.isArray(uploads) ? uploads : [uploads]
    return list.map((u: any) => ({
      Key: u.Key,
      UploadId: u.UploadId,
      Initiated: u.Initiated,
    }))
  }

  /**
   * Restore object from Glacier
   */
  async restoreObject(bucket: string, key: string, days: number, tier: 'Standard' | 'Bulk' | 'Expedited' = 'Standard'): Promise<void> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<RestoreRequest>
  <Days>${days}</Days>
  <GlacierJobParameters>
    <Tier>${tier}</Tier>
  </GlacierJobParameters>
</RestoreRequest>`

    await this.client.request({
      service: 's3',
      region: this.region,
      method: 'POST',
      path: `/${bucket}/${key}`,
      queryParams: { restore: '' },
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
  }

  /**
   * Select object content (S3 Select)
   */
  async selectObjectContent(bucket: string, key: string, expression: string, inputFormat: 'CSV' | 'JSON' | 'Parquet', outputFormat: 'CSV' | 'JSON' = 'JSON'): Promise<string> {
    let inputSerialization = ''
    if (inputFormat === 'CSV') {
      inputSerialization = '<CSV><FileHeaderInfo>USE</FileHeaderInfo></CSV>'
    } else if (inputFormat === 'JSON') {
      inputSerialization = '<JSON><Type>DOCUMENT</Type></JSON>'
    } else {
      inputSerialization = '<Parquet/>'
    }

    let outputSerialization = ''
    if (outputFormat === 'CSV') {
      outputSerialization = '<CSV/>'
    } else {
      outputSerialization = '<JSON/>'
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<SelectObjectContentRequest>
  <Expression>${expression}</Expression>
  <ExpressionType>SQL</ExpressionType>
  <InputSerialization>${inputSerialization}</InputSerialization>
  <OutputSerialization>${outputSerialization}</OutputSerialization>
</SelectObjectContentRequest>`

    const result = await this.client.request({
      service: 's3',
      region: this.region,
      method: 'POST',
      path: `/${bucket}/${key}`,
      queryParams: { select: '', 'select-type': '2' },
      headers: { 'Content-Type': 'application/xml' },
      body,
      rawResponse: true,
    })

    return result
  }
}
