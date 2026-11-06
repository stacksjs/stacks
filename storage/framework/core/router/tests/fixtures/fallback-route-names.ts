if (import.meta.main) {
  const assert = (await import('node:assert/strict')).default
  const { overridesReady } = await import('@stacksjs/config')
  await overridesReady
  const { loadRoutes, listNamedRoutes, route, url } = await import('@stacksjs/router')
  route.post('/api/notifications/unsubscribe', () => new Response('app')).name('email.unsubscribe' as never)
  await loadRoutes({})
  assert.equal(listNamedRoutes()['email.unsubscribe'], '/api/notifications/unsubscribe')
  assert.ok(url('email.unsubscribe' as never).endsWith('/api/notifications/unsubscribe'))
  assert.equal(listNamedRoutes()['email.unsubscribe.oneclick'], '/api/email/unsubscribe')
  const { withFallbackRouteNames } = await import('../../src/stacks-router')
  route.get('/app/{id}', () => new Response('app')).name('fallback.failure' as never)
  await assert.rejects(withFallbackRouteNames(async () => {
    await Promise.resolve()
    route.get('/default/{slug}', () => new Response('default')).name('fallback.failure' as never)
    throw new Error('fixture failure')
  }), /fixture failure/)
  assert.equal(listNamedRoutes()['fallback.failure'], '/app/{id}')
  assert.ok(url('fallback.failure' as never, { id: 'kept' } as never).endsWith('/app/kept'))
  route.get('/app/replacement', () => new Response('replacement')).name('fallback.failure' as never)
  assert.equal(listNamedRoutes()['fallback.failure'], '/app/replacement', 'ordinary app registration semantics stay unchanged')
  console.log('fallback named routes OK')
}
