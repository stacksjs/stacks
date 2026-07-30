export interface TaxRateWriteData {
  name?: string
  rate?: number
  type?: string
  country?: string
  region?: string | null
  status?: 'active' | 'inactive'
  is_default?: boolean
  uuid?: string
}
