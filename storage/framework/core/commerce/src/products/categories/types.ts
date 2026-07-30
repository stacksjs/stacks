export interface CategoryWriteData {
  name?: string
  description?: string | null
  slug?: string
  image_url?: string | null
  is_active?: boolean
  parent_category_id?: string | null
  display_order?: number
  uuid?: string
}
