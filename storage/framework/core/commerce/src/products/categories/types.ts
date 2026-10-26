export interface CategoryWriteData {
  name?: string
  description?: string | null
  slug?: string
  image_url?: string | null
  is_active?: boolean
  /** Accepted as a string from a form; stored as the number it names. */
  parent_category_id?: string | number | null
  display_order?: number
  uuid?: string
}
