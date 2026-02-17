// No imports needed - everything is auto-imported!

export default new Action({
  name: 'ResendVerificationAction',
  description: 'Resend email verification link',
  method: 'POST',

  async handle(request: any) {
    const user = request.user || request._user

    if (!user) {
      return response.unauthorized('Unauthenticated.')
    }

    const { resendVerificationEmail } = await import('@stacksjs/auth')
    const result = await resendVerificationEmail(user)

    if (!result.success) {
      return response.json({ success: false, message: result.message }, 422)
    }

    return response.json({ success: true, message: result.message })
  },
})
