import { plugin } from '../plugin'

const p: any = {
  plugins: {
    unocss: plugin,
  },
  rules: {
    'unocss/order': 'warn',
    'unocss/order-attributify': 'warn',
  } as const,
}

export default p
