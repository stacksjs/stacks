import type { Ref } from 'vue'
import { onMounted, ref } from 'vue'

interface GitHubOAuthReturn {
  login: () => void
  accessToken: Ref<string | null>
  error: Ref<string | null>
  isLoading: Ref<boolean>
}

interface GitHubTokenResponse {
  access_token: string
}

declare global {
  interface Window {
    location: {
      href: string
      search: string
    }
  }
}

export function useGitHubOAuth(): GitHubOAuthReturn {
  const clientId = 'YOUR_GITHUB_CLIENT_ID'
  const redirectUri = 'http://localhost:5173/auth/github/callback' // adjust as needed

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
      const res = await fetch('http://localhost:3000/api/github/token', {
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
