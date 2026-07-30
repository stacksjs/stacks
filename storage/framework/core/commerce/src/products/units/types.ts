export interface ProductUnitWriteData {
  name?: string
  abbreviation?: string
  type?: string
  description?: string | null
  is_default?: boolean
  product_id?: number | null
  uuid?: string
}
