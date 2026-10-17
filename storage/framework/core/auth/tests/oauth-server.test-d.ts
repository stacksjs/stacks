// The emitted public declarations are the regression target; source inference hid the defect.
// eslint-disable-next-line pickier/no-import-dist
import type { OAuthAuthorizationServer, OAuthAuthorizationServerOptions } from '../dist/oauth-server'
// eslint-disable-next-line pickier/no-import-dist
import { createOAuthAuthorizationServer } from '../dist/oauth-server'

declare const options: OAuthAuthorizationServerOptions
const server: OAuthAuthorizationServer = createOAuthAuthorizationServer(options)
const metadata: Response = server.metadata()
const token: Promise<Response> = server.token(new Request('https://example.test/token'))
const revoke: Promise<Response> = server.revoke(new Request('https://example.test/revoke'))
void metadata
void token
void revoke
