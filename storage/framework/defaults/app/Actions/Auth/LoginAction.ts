// No imports needed - everything is auto-imported!

export default new Action({
  name: 'LoginAction',
  description: 'Login to the application',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(6).max(255),
      message: 'Password must be between 6 and 255 characters.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')

    const result = await Auth.login({ email, password })

    if (result) {
      const user = result.user

      // OAuth2-compatible payload. Clients should:
      //   - Send `Authorization: Bearer <access_token>` for API calls.
      //   - Cache the access token for at most `expires_in` seconds.
      //   - Exchange `refresh_token` at /auth/refresh when the access
      //     token nears expiry. The refresh token is single-use; the
      //     refresh response returns a new pair (rotation).
      // The legacy `token` field is kept for backward compatibility
      // with clients that haven't been updated yet — it shadows
      // `access_token` and will be removed in a future major.
      return response.json({
        access_token: result.token,
        refresh_token: result.refreshToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        token: result.token,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
        },
      })
    }

    return response.unauthorized('Incorrect email or password')
  },
})
