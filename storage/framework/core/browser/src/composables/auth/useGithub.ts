import type { Ref } from '@stacksjs/stx'
import { onMounted, ref } from '@stacksjs/stx'

interface GitHubOAuthReturn {
  login: () => void
  accessToken: Ref<string | null>
  error: Ref<string | null>
  isLoading: Ref<boolean>
}

interface GitHubTokenResponse {
  access_token: string
}

// @ts-ignore - Window.location override
declare global {
  // eslint-disable-next-line ts/no-empty-object-type
  interface Window {}
}

export function useGitHubOAuth(): GitHubOAuthReturn {
  const stacksConfig = (window as any).__STACKS_CONFIG__ || {}
  const clientId = stacksConfig.GITHUB_CLIENT_ID || ''
  const baseUrl = stacksConfig.APP_URL || window.location.origin
  const redirectUri = `${baseUrl}/auth/github/callback`

  const accessToken = ref<string | null>(null)
  const error = ref<string | null>(null)
  const isLoading = ref(false)

  function login() {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=read:user user:email`
    window.location.href = githubAuthUrl
  }

  async function fetchAccessToken(code: string) {
    isLoading.value = true
    error.value = null

    try {
      const apiUrl = stacksConfig.APP_URL || window.location.origin
      const res = await fetch(`${apiUrl}/api/github/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (!res.ok) {
        throw new Error('Failed to exchange code for access token')
      }

      const data = await res.json() as GitHubTokenResponse
      accessToken.value = data.access_token
    }
    catch (err: any) {
      error.value = err.message || 'Unknown error'
    }
    finally {
      isLoading.value = false
    }
  }

  function handleCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      fetchAccessToken(code)
    }
  }

  onMounted(() => {
    handleCallback()
  })

  return {
    login,
    accessToken,
    error,
    isLoading,
  }
}
