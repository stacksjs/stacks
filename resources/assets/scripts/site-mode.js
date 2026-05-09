(() => {
  const body = document.body
  if (!body || body.dataset.siteMode !== 'coming-soon')
    return

  const enabled = body.dataset.comingSoonBypassEnabled === 'true'
  if (!enabled)
    return

  const token = body.dataset.comingSoonBypass || ''
  const expectedValue = token || '1'
  const cookieName = 'stacks_coming_soon_preview'
  const params = new URLSearchParams(window.location.search)
  const requestedPreview = params.get('preview') || params.get('bypass') || ''

  if (requestedPreview === 'off') {
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`
    return
  }

  if (requestedPreview && requestedPreview === expectedValue) {
    document.cookie = `${cookieName}=${encodeURIComponent(expectedValue)}; Path=/; Max-Age=2592000; SameSite=Lax`
    body.classList.add('site-mode-unlocked')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    return
  }

  const cookies = Object.fromEntries(
    document.cookie
      .split(';')
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=')
        if (index === -1)
          return [cookie, '']

        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))]
      }),
  )

  if (cookies[cookieName] === expectedValue)
    body.classList.add('site-mode-unlocked')
})()
