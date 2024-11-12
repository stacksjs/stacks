export interface SaasOption {
  plans: {
    productName: string
    description: string
    pricing: {
      key: string
      price: number
      interval?: 'day' | 'month' | 'week' | 'year' // Optional interval
      currency: string
    }[]
    metadata: {
      createdBy: string
      version: string
    }
  }[]
  webhook: {
    endpoint: string
    secret: string
  }
  currencies: string[]
  coupons: {
    code: string
    amountOff: number
    duration: 'once' | 'repeating' | 'forever'
  }[]
  products: {
    name: string
    description: string
    images: string[]
  }[]
}

export type SaasConfig = Partial<SaasOption>
