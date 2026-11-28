function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A fresh verifier and its S256 challenge for one authorization request. */
export async function createS256Proof(): Promise<{ codeVerifier: string, codeChallenge: string }> {
  const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return { codeVerifier, codeChallenge: base64Url(new Uint8Array(digest)) }
}
