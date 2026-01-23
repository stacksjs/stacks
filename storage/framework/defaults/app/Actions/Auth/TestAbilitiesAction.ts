import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { currentAccessToken, tokenAbilities, tokenCan, tokenCanAll, tokenCanAny } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TestAbilitiesAction',
  description: 'Test token abilities/scopes - useful for debugging',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user) {
      return response.unauthorized('Authentication required')
    }

    const accessToken = await currentAccessToken()
    const abilities = await tokenAbilities()

    // Get test scopes from query params
    const testScope = request.get('scope') as string | undefined
    const testScopes = request.get('scopes') as string | undefined

    const result: any = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: accessToken
        ? {
            id: accessToken.id,
            name: accessToken.name,
            scopes: accessToken.scopes,
            expires_at: accessToken.expiresAt?.toISOString() || null,
          }
        : null,
      abilities,
      has_wildcard: abilities.includes('*'),
    }

    // Test specific scope if provided
    if (testScope) {
      result.test = {
        scope: testScope,
        can: await tokenCan(testScope),
      }
    }

    // Test multiple scopes if provided (comma-separated)
    if (testScopes) {
      const scopeList = testScopes.split(',').map(s => s.trim())
      result.test_multiple = {
        scopes: scopeList,
        can_all: await tokenCanAll(scopeList),
        can_any: await tokenCanAny(scopeList),
      }
    }

    return response.json(result)
  },
})
