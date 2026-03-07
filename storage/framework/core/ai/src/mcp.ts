/**
 * MCP (Model Context Protocol) Module
 *
 * Implements an MCP client for connecting to MCP servers, discovering tools,
 * and invoking them through AI providers. This enables AI models to interact
 * with external services via a standardized protocol.
 *
 * @see https://modelcontextprotocol.io
 */

// ============================================================================
// Types
// ============================================================================

export interface MCPServerConfig {
  name: string
  transport: MCPTransport
  capabilities?: MCPCapabilities
}

export type MCPTransport =
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'streamable-http'; url: string; headers?: Record<string, string> }

export interface MCPCapabilities {
  tools?: boolean
  resources?: boolean
  prompts?: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: string
}

// ============================================================================
// MCP Client
// ============================================================================

/**
 * MCP Client for connecting to Model Context Protocol servers.
 *
 * Supports stdio and SSE/streamable-http transports.
 * Provides tool discovery, invocation, resource reading, and prompt listing.
 */
export class MCPClient {
  private config: MCPServerConfig
  private process: ReturnType<typeof import('bun').spawn> | null = null
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  private tools: MCPTool[] = []
  private resources: MCPResource[] = []
  private prompts: MCPPrompt[] = []
  private initialized = false
  private buffer = ''

  constructor(config: MCPServerConfig) {
    this.config = config
  }

  /**
   * Connect to the MCP server and initialize the session.
   */
  async connect(): Promise<void> {
    if (this.config.transport.type === 'stdio') {
      await this.connectStdio()
    }
    else if (this.config.transport.type === 'sse' || this.config.transport.type === 'streamable-http') {
      await this.connectHTTP()
    }
    else {
      throw new Error(`Unsupported transport type: ${(this.config.transport as any).type}`)
    }

    this.initialized = true
  }

  private async connectStdio(): Promise<void> {
    const transport = this.config.transport as { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
    const { spawn } = await import('bun')

    this.process = spawn([transport.command, ...(transport.args || [])], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, ...transport.env },
    }) as any

    // Start reading stdout for responses
    this.readStdout()

    // Send initialize request
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'stacks-ai', version: '1.0.0' },
    })

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {})

    // Discover capabilities
    await this.discoverCapabilities()
  }

  private async connectHTTP(): Promise<void> {
    const transport = this.config.transport as { type: 'sse' | 'streamable-http'; url: string; headers?: Record<string, string> }

    // Send initialize via HTTP
    const response = await fetch(transport.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...transport.headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'stacks-ai', version: '1.0.0' },
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MCP HTTP connection error: ${error}`)
    }

    await this.discoverCapabilities()
  }

  private async readStdout(): Promise<void> {
    if (!this.process) return

    const reader = (this.process as any).stdout?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        this.buffer += decoder.decode(value, { stream: true })
        this.processBuffer()
      }
    }
    catch {
      // Process exited
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line)
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const pending = this.pendingRequests.get(message.id)!
          this.pendingRequests.delete(message.id)

          if (message.error) {
            pending.reject(new Error(message.error.message || 'MCP error'))
          }
          else {
            pending.resolve(message.result)
          }
        }
      }
      catch {
        // Skip invalid JSON
      }
    }
  }

  private nextId(): number {
    return ++this.requestId
  }

  private async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId()

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }) + '\n'

    if (this.config.transport.type === 'stdio' && this.process) {
      const writer = (this.process as any).stdin?.getWriter()
      if (writer) {
        await writer.write(new TextEncoder().encode(message))
        writer.releaseLock()
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request timeout: ${method}`))
        }, 30000)

        this.pendingRequests.set(id, {
          resolve: (value: any) => {
            clearTimeout(timeout)
            resolve(value)
          },
          reject: (error: Error) => {
            clearTimeout(timeout)
            reject(error)
          },
        })
      })
    }

    if (this.config.transport.type === 'sse' || this.config.transport.type === 'streamable-http') {
      const transport = this.config.transport as { url: string; headers?: Record<string, string> }

      const response = await fetch(transport.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...transport.headers,
        },
        body: message,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`MCP request error: ${error}`)
      }

      const result = (await response.json()) as any
      if (result.error) {
        throw new Error(result.error.message || 'MCP error')
      }
      return result.result
    }

    throw new Error('No transport available')
  }

  private async sendNotification(method: string, params: Record<string, unknown> = {}): Promise<void> {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    }) + '\n'

    if (this.config.transport.type === 'stdio' && this.process) {
      const writer = (this.process as any).stdin?.getWriter()
      if (writer) {
        await writer.write(new TextEncoder().encode(message))
        writer.releaseLock()
      }
    }
  }

  private async discoverCapabilities(): Promise<void> {
    const capabilities = this.config.capabilities || { tools: true, resources: true, prompts: true }

    if (capabilities.tools !== false) {
      try {
        const result = await this.sendRequest('tools/list')
        this.tools = result?.tools || []
      }
      catch {
        this.tools = []
      }
    }

    if (capabilities.resources !== false) {
      try {
        const result = await this.sendRequest('resources/list')
        this.resources = result?.resources || []
      }
      catch {
        this.resources = []
      }
    }

    if (capabilities.prompts !== false) {
      try {
        const result = await this.sendRequest('prompts/list')
        this.prompts = result?.prompts || []
      }
      catch {
        this.prompts = []
      }
    }
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * List available tools from the MCP server.
   */
  listTools(): MCPTool[] {
    return this.tools
  }

  /**
   * List available resources from the MCP server.
   */
  listResources(): MCPResource[] {
    return this.resources
  }

  /**
   * List available prompts from the MCP server.
   */
  listPrompts(): MCPPrompt[] {
    return this.prompts
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolCallResult> {
    if (!this.initialized) {
      throw new Error('MCP client not connected. Call connect() first.')
    }

    const result = await this.sendRequest('tools/call', { name, arguments: args })
    return result as MCPToolCallResult
  }

  /**
   * Read a resource from the MCP server.
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.initialized) {
      throw new Error('MCP client not connected. Call connect() first.')
    }

    const result = await this.sendRequest('resources/read', { uri })
    const contents = result?.contents?.[0]
    return {
      uri: contents?.uri || uri,
      mimeType: contents?.mimeType,
      text: contents?.text,
      blob: contents?.blob,
    }
  }

  /**
   * Get a prompt from the MCP server with arguments filled in.
   */
  async getPrompt(name: string, args: Record<string, string> = {}): Promise<{
    description?: string
    messages: Array<{ role: string; content: { type: string; text: string } }>
  }> {
    if (!this.initialized) {
      throw new Error('MCP client not connected. Call connect() first.')
    }

    return this.sendRequest('prompts/get', { name, arguments: args })
  }

  /**
   * Convert MCP tools to the format expected by AI providers (e.g., Anthropic tool_use).
   */
  toAnthropicTools(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }))
  }

  /**
   * Convert MCP tools to OpenAI function calling format.
   */
  toOpenAITools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return this.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      (this.process as any).kill()
      this.process = null
    }

    this.initialized = false
    this.tools = []
    this.resources = []
    this.prompts = []
    this.pendingRequests.clear()
  }

  /**
   * Check if the client is connected.
   */
  get isConnected(): boolean {
    return this.initialized
  }

  /**
   * Get the server name.
   */
  get serverName(): string {
    return this.config.name
  }
}

// ============================================================================
// MCP Manager (Multi-Server)
// ============================================================================

/**
 * Manages connections to multiple MCP servers.
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>()

  /**
   * Add and connect to an MCP server.
   */
  async addServer(config: MCPServerConfig): Promise<MCPClient> {
    if (this.clients.has(config.name)) {
      throw new Error(`MCP server already registered: ${config.name}`)
    }

    const client = new MCPClient(config)
    await client.connect()
    this.clients.set(config.name, client)
    return client
  }

  /**
   * Remove and disconnect from an MCP server.
   */
  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name)
    if (client) {
      await client.disconnect()
      this.clients.delete(name)
    }
  }

  /**
   * Get a connected MCP client by server name.
   */
  getServer(name: string): MCPClient | undefined {
    return this.clients.get(name)
  }

  /**
   * List all connected server names.
   */
  listServers(): string[] {
    return Array.from(this.clients.keys())
  }

  /**
   * Get all tools from all connected servers.
   * Tool names are prefixed with the server name to avoid conflicts.
   */
  getAllTools(): Array<MCPTool & { serverName: string }> {
    const allTools: Array<MCPTool & { serverName: string }> = []

    for (const [name, client] of this.clients) {
      for (const tool of client.listTools()) {
        allTools.push({ ...tool, serverName: name })
      }
    }

    return allTools
  }

  /**
   * Call a tool, routing to the correct server.
   * Tool name format: "serverName/toolName" or just "toolName" if unique.
   */
  async callTool(toolPath: string, args: Record<string, unknown> = {}): Promise<MCPToolCallResult> {
    if (toolPath.includes('/')) {
      const [serverName, toolName] = toolPath.split('/', 2)
      const client = this.clients.get(serverName)
      if (!client) throw new Error(`MCP server not found: ${serverName}`)
      return client.callTool(toolName, args)
    }

    // Search all servers for the tool
    for (const [, client] of this.clients) {
      const tools = client.listTools()
      if (tools.some(t => t.name === toolPath)) {
        return client.callTool(toolPath, args)
      }
    }

    throw new Error(`MCP tool not found: ${toolPath}`)
  }

  /**
   * Convert all tools to Anthropic format with server-prefixed names.
   */
  toAnthropicTools(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    const tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = []

    for (const [serverName, client] of this.clients) {
      for (const tool of client.listTools()) {
        tools.push({
          name: `${serverName}__${tool.name}`,
          description: `[${serverName}] ${tool.description}`,
          input_schema: tool.inputSchema,
        })
      }
    }

    return tools
  }

  /**
   * Convert all tools to OpenAI format with server-prefixed names.
   */
  toOpenAITools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    const tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> = []

    for (const [serverName, client] of this.clients) {
      for (const tool of client.listTools()) {
        tools.push({
          type: 'function',
          function: {
            name: `${serverName}__${tool.name}`,
            description: `[${serverName}] ${tool.description}`,
            parameters: tool.inputSchema,
          },
        })
      }
    }

    return tools
  }

  /**
   * Disconnect from all servers.
   */
  async disconnectAll(): Promise<void> {
    const disconnects = Array.from(this.clients.values()).map(c => c.disconnect())
    await Promise.all(disconnects)
    this.clients.clear()
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create and connect to an MCP server using stdio transport.
 */
export async function connectStdio(
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>,
): Promise<MCPClient> {
  const client = new MCPClient({
    name,
    transport: { type: 'stdio', command, args, env },
  })
  await client.connect()
  return client
}

/**
 * Create and connect to an MCP server using HTTP transport.
 */
export async function connectHTTP(
  name: string,
  url: string,
  headers?: Record<string, string>,
): Promise<MCPClient> {
  const client = new MCPClient({
    name,
    transport: { type: 'streamable-http', url, headers },
  })
  await client.connect()
  return client
}

// ============================================================================
// Exports
// ============================================================================

export const mcp = {
  MCPClient,
  MCPManager,
  connectStdio,
  connectHTTP,
}
