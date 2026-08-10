export interface TaxRateWriteData {
  name?: string
  rate?: number
  type?: string
  country?: string
  region?: string | null
  status?: 'active' | 'inactive'
  is_default?: boolean
  /** Stable identifier application code matches on, independent of `name`. */
  code?: string
  /** Whether a qualifying exemption stops this component being charged. */
  exemptible?: boolean
  uuid?: string
}
