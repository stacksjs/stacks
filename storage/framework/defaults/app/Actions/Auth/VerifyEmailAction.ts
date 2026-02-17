// No imports needed - everything is auto-imported!

export default new Action({
  name: 'VerifyEmailAction',
  description: 'Verify user email address',
  method: 'GET',

  async handle(request: any) {
    const userId = Number(request.params?.id)
    const token = request.params?.token

    if (!userId || !token) {
      return response.json({ success: false, message: 'Invalid verification link.' }, 422)
    }

    const { verifyEmail } = await import('@stacksjs/auth')
    const result = await verifyEmail(userId, token)

    if (!result.success) {
      return response.json({ success: false, message: result.message }, 422)
    }

    return response.json({ success: true, message: 'Email verified successfully.' })
  },
})
