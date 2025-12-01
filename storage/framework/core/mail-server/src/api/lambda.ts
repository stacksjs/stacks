/**
 * Lambda handler for Mail API
 * 
 * Exposes mailbox operations via API Gateway
 */

import {
  authenticate,
  listMailboxes,
  listMessages,
  getMessage,
  deleteMessage,
  sendMessage,
  setMessageFlags,
  searchMessages,
} from './handlers'

interface APIGatewayEvent {
  httpMethod: string
  path: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body?: string
  pathParameters?: Record<string, string>
}

interface APIGatewayResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

function response(statusCode: number, body: any): APIGatewayResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  }
}

function unauthorized(): APIGatewayResponse {
  return response(401, { error: 'Unauthorized' })
}

/**
 * Extract and validate auth from request
 */
async function getAuthUser(event: APIGatewayEvent): Promise<string | null> {
  const authHeader = event.headers.Authorization || event.headers.authorization
  
  if (!authHeader) return null
  
  // Support Basic auth
  if (authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8')
    const [email, password] = credentials.split(':')
    
    if (email && password && await authenticate(email, password)) {
      return email
    }
  }
  
  // Support Bearer token (JWT or API key - implement as needed)
  if (authHeader.startsWith('Bearer ')) {
    // For now, treat bearer token as email:password base64
    try {
      const credentials = Buffer.from(authHeader.substring(7), 'base64').toString('utf-8')
      const [email, password] = credentials.split(':')
      
      if (email && password && await authenticate(email, password)) {
        return email
      }
    } catch (e) {
      return null
    }
  }
  
  return null
}

/**
 * Main Lambda handler
 */
export async function handler(event: APIGatewayEvent): Promise<APIGatewayResponse> {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {})
  }
  
  const path = event.path
  const method = event.httpMethod
  
  // Auth endpoint doesn't require authentication
  if (path === '/auth' && method === 'POST') {
    const body = JSON.parse(event.body || '{}')
    const { email, password } = body
    
    if (!email || !password) {
      return response(400, { error: 'Email and password required' })
    }
    
    const valid = await authenticate(email, password)
    if (!valid) {
      return response(401, { error: 'Invalid credentials' })
    }
    
    // Return a token (base64 encoded credentials for simplicity)
    const token = Buffer.from(`${email}:${password}`).toString('base64')
    return response(200, { token, email })
  }
  
  // All other endpoints require authentication
  const userEmail = await getAuthUser(event)
  if (!userEmail) {
    return unauthorized()
  }
  
  try {
    // GET /mailboxes - List mailboxes
    if (path === '/mailboxes' && method === 'GET') {
      const mailboxes = await listMailboxes(userEmail)
      return response(200, { mailboxes })
    }
    
    // GET /messages - List messages
    if (path === '/messages' && method === 'GET') {
      const params = event.queryStringParameters || {}
      const messages = await listMessages(userEmail, params.mailbox || 'INBOX', {
        limit: params.limit ? parseInt(params.limit) : undefined,
        offset: params.offset ? parseInt(params.offset) : undefined,
        includeBody: params.preview === 'true',
      })
      return response(200, { messages, total: messages.length })
    }
    
    // GET /messages/{id} - Get single message
    if (path.startsWith('/messages/') && method === 'GET') {
      const messageId = event.pathParameters?.id || path.split('/').pop()
      if (!messageId) {
        return response(400, { error: 'Message ID required' })
      }
      
      const params = event.queryStringParameters || {}
      const result = await getMessage(userEmail, messageId, {
        format: (params.format as 'full' | 'headers' | 'raw') || 'full',
      })
      
      if (!result) {
        return response(404, { error: 'Message not found' })
      }
      
      return response(200, result)
    }
    
    // DELETE /messages/{id} - Delete message
    if (path.startsWith('/messages/') && method === 'DELETE') {
      const messageId = event.pathParameters?.id || path.split('/').pop()
      if (!messageId) {
        return response(400, { error: 'Message ID required' })
      }
      
      const params = event.queryStringParameters || {}
      const success = await deleteMessage(userEmail, messageId, params.permanent === 'true')
      
      if (!success) {
        return response(404, { error: 'Message not found' })
      }
      
      return response(200, { success: true })
    }
    
    // PUT /messages/{id}/flags - Update message flags
    if (path.match(/\/messages\/[^/]+\/flags/) && method === 'PUT') {
      const messageId = path.split('/')[2]
      const body = JSON.parse(event.body || '{}')
      
      const success = await setMessageFlags(userEmail, messageId, body)
      return response(success ? 200 : 500, { success })
    }
    
    // POST /messages - Send message
    if (path === '/messages' && method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      
      if (!body.to || !body.subject) {
        return response(400, { error: 'To and subject required' })
      }
      
      const result = await sendMessage(userEmail, body)
      
      if (!result) {
        return response(500, { error: 'Failed to send message' })
      }
      
      return response(200, result)
    }
    
    // POST /search - Search messages
    if (path === '/search' && method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const messages = await searchMessages(userEmail, body)
      return response(200, { messages, total: messages.length })
    }
    
    // Not found
    return response(404, { error: 'Not found' })
    
  } catch (error: any) {
    console.error('Handler error:', error)
    return response(500, { error: error.message || 'Internal server error' })
  }
}
