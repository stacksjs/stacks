export interface StripePaymentMethod {
  id: string
  object: string
  allow_redisplay: string
  billing_details: {
    address: {
      city: string | null
      country: string | null
      line1: string | null
      line2: string | null
      postal_code: string | null
      state: string | null
    }
    email: string | null
    name: string | null
    phone: string | null
  }
  card: {
    brand: string
    checks: {
      address_line1_check: string | null
      address_postal_code_check: string | null
      cvc_check: string
    }
    country: string
    display_brand: string
    exp_month: number
    exp_year: number
    fingerprint: string
    funding: string
    generated_from: string | null
    last4: string
    networks: {
      available: string[]
      preferred: string | null
    }
    three_d_secure_usage: {
      supported: boolean
    }
    wallet: string | null
  }
  created: number
  customer: string
  livemode: boolean
  metadata: Record<string, string>
  type: string
}
