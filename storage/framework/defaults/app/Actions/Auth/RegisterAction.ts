// No imports needed - everything is auto-imported!

export default new Action({
  name: 'RegisterAction',
  description: 'Register a new user',
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
    name: {
      rule: schema.string().min(2).max(255),
      message: 'Name must be between 2 and 255 characters.',
    },
  },

  async handle(request: any) {
    const email = request.get('email')
    const password = request.get('password')
    const name = request.get('name')

    const result = await register({ email, password, name })

    if (result) {
      const user = await Auth.getUserFromToken(result.token)

      return response.json({
        token: result.token,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
        },
      })
    }

    return response.error('Registration failed')
  },
})
