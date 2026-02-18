export function createTwoFactorMethods() {
  return {
    async generateTwoFactorForModel(model: any): Promise<void> {
      const { generateTwoFactorSecret } = await import('@stacksjs/auth')
      const secret = generateTwoFactorSecret()
      await model.update({ two_factor_secret: secret })
    },

    verifyTwoFactorCode(model: any, code: string): boolean {
      const { verifyTwoFactorCode } = require('@stacksjs/auth')
      const modelTwoFactorSecret = model.get('two_factor_secret')

      if (typeof modelTwoFactorSecret === 'string') {
        return verifyTwoFactorCode(code, modelTwoFactorSecret)
      }

      return false
    },
  }
}
