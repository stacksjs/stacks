import { type ViteSSGContext } from 'vite-ssg'

export type UserModule = (ctx: ViteSSGContext) => void

export interface Pagination {
  current_page: number
  from: number
  last_page: number
  links: any
  path: string
  per_page: number
  to: number
  total: number
}

export interface Uptime {
  week: string
  two_weeks: string
  month: string
}
export interface UptimeWeek {
  datetime: Date
  uptimePercentage: number
}

export interface Downtime {
  startedAt: string
  endedAt: string
}

export interface User {
  address: string
  agent_picture: string
  ahip_status: string
  attestation_date: string
  avatar: string
  campaign_id: string
  can_access_carecompare_training: boolean
  carrier_contracting_status: string
  carriers: string
  city: string
  created_at: string | Date
  disposition: string
  email: string
  eo_status: string
  first_name: string
  gender: string
  id: number
  is_admin: number | boolean
  is_carecompare: number | boolean
  is_rts: number | boolean
  language: string
  last_name: string
  npn: string
  phone: string
  postal_code: string
  recruitment_level: string
  rts_designation_status: string
  salesforce_id: string
  state: string
  sunfire_access: number | boolean
  updated_at: string
  website_access: number | boolean
}

export interface TeamMember {
  id: number
  name: string
  title: string
  sub_title: string
  bio: string
  phone: string
  email: string
  territories: string
  linkedin: string
  image: string
  priority: number
  status: number | boolean
  icon: string
  custom_order: number
  is_national_sales_broker: string
  is_regional_sales_broker: string
  created_at: string | Date
}

export interface Event {
  id: number
  address: string
  attendees_limit: number
  category: string
  city: string
  content: string
  email: string
  date: EventDate
  dates: EventDate[]
  is_active: boolean
  is_carecompare: boolean
  is_spanish: boolean
  is_testing: boolean
  is_training: boolean
  public: boolean
  npn_not_required: boolean
  is_wv: boolean
  link: string
  name: string
  name_spanish: string
  region: string
  salesforce_id: string
  short_description: string
  state: string
  time: EventTime
  times: EventTime[]
  timezone: string
  title: string
  updated_at: string
  webex_password: string
  zip_code: string
  created_at: string | Date
}

export interface EventDate {
  id: number
  date: string | Date
  event_id: number
  slug: string
  updated_at: string
}

export interface Page {
  id?: number
  page: string
  description?: string
  title?: string
  keywords?: string
}

export interface EventRsvp {
  id: number
  email: string
  event: Event
  event_date_id: number
  event_id: number
  event_name: string
  event_time_id: number
  first_name: string
  last_name: string
  license_number: string
  name: string
  number_of_attendees: string
  phone: string
  state: string
  updated_at: string
}

export interface EventTime {
  id: number
  end_time: string
  start_time: string
  slug: number
  timezone: string
  created_at: string
  updated_at: string
}

export interface Webpage {
  id: number
  first_name: string
  last_name: string
  subdomain: string
  email_address: string
  phone: string
  state: string
  city: string
  postal_code: string
  leads: WebpageLead[]
  carecompare_purl: string
  copyblock_1: number
  copyblock_2: number
  headline_1_image: string
  headline_1: string
  headline_2: string
  headline_2_image: string
  headline_3: string
  headline_3_image: string
  profile_picture: File | string
  secondary_logo: File | string
  is_active: boolean
  status: string
  user: User
  user_id: number
}

export interface WebpageLead {
  id: number
  webpage_id: number
  name: string
  email: string
  date: string
  phone: string
  zip_code: string
  placement: string
  source: string
  product_sold: string
  message: string
  status: string
  flagged: boolean
  is_sent: number
  created_at: string
  updated_at: string
}

export interface Agency {
  id: number
  agents: AgencyUser[]
  city: string
  email: string
  folders: AgencyFolder[]
  folders_schedule: any
  name: string
  state: string
  zip_code: string
  street_address: string
  suite: string
  total_files: number
  total_users: number
}

export interface AgencyUser {
  id: number
  agency_id: number
  email: string
  folders: string[]
  level: string
  name: string
  notifications: string[]
  user_id: number
  updated_at: string | Date
}

export interface AgencyFolder {
  id: number
  agency_id: number
  default_scheduled_at: string
  name: string
  files_limit: number
  created_at: string | Date
}

export interface MeilisearchResults {
  estimatedTotalHits: number
  facetDistribution: any
  hits: TeamMember[] | User[]
  limit: number
  offset: number
  processingTimeMs: string
  query: string
}
