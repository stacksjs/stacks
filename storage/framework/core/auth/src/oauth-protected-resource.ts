export interface OAuthProtectedResourceOptions {
  resource: string
  authorizationServers: readonly string[]
  scopesSupported?: readonly string[]
  documentation?: string
}

/** RFC 9728 metadata for the exact protected audience, never the inbound Host. */
export function oauthProtectedResourceMetadata(options: OAuthProtectedResourceOptions) {
  for (const value of [options.resource, ...options.authorizationServers, ...(options.documentation ? [options.documentation] : [])]) {
    const url = new URL(value)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.hash || url.search)
      throw new TypeError('OAuth resource metadata requires canonical HTTPS URLs, or HTTP loopback URLs.')
  }
  if (!options.authorizationServers.length) throw new TypeError('An OAuth resource needs an authorization server.')
  return {
    resource: options.resource, authorization_servers: [...options.authorizationServers], bearer_methods_supported: ['header'],
    ...(options.scopesSupported ? { scopes_supported: [...options.scopesSupported] } : {}),
    ...(options.documentation ? { resource_documentation: options.documentation } : {}),
  }
}

export function oauthProtectedResourceMetadataPath(resource: string): string {
  return `/.well-known/oauth-protected-resource${new URL(resource).pathname.replace(/\/$/, '')}`
}
