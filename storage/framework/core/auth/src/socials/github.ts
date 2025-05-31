export async function exchangeGitHubCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing GitHub credentials')
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  const data = (await response.json()) as {
    access_token: string
    error?: string
    error_description?: string
  }

  if (data.error) {
    throw new Error(data.error_description || 'GitHub token exchange failed')
  }

  return data.access_token
}