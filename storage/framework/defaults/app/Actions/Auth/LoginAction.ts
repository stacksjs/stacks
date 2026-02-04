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

  async handle(request: any) {
    const email = request.get('email')
    const password = request.get('password')

    const result = await Auth.login({ email, password })

    if (result) {
      const user = result.user

      return response.json({
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
