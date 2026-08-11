export type SocialPostPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'
export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface SocialPostRecord {
  id: string
  content: string
  platform: SocialPostPlatform
  status: SocialPostStatus
  scheduledAt: string
  publishedAt: string
  likes: number
  shares: number
  comments: number
  reach: number
  engagement: number
  imageUrl: string
  externalId: string
  userId: string
  authorName: string
  authorEmail: string
  createdAt: string
}

export interface SocialPostSummary {
  total: number
  published: number
  scheduled: number
  drafts: number
  failed: number
  reach: number
  engagement: number
}

export interface SocialPostUserOption {
  id: string
  name: string
  email: string
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function number(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) && result >= 0 ? result : 0
}

function platform(input: unknown): SocialPostPlatform | '' {
  const normalized = text(input).toLowerCase()
  return ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'].includes(normalized)
    ? normalized as SocialPostPlatform
    : ''
}

function status(input: unknown): SocialPostStatus {
  const normalized = text(input).toLowerCase()
  return ['draft', 'scheduled', 'published', 'failed'].includes(normalized)
    ? normalized as SocialPostStatus
    : 'draft'
}

export function normalizeSocialPosts(
  postRows: any[],
  userRows: any[],
): { records: SocialPostRecord[], summary: SocialPostSummary, users: SocialPostUserOption[] } {
  const users = userRows.map((user): SocialPostUserOption => ({
    id: text(value(user, 'id')),
    name: text(value(user, 'name')) || text(value(user, 'email')) || `User ${text(value(user, 'id'))}`,
    email: text(value(user, 'email')),
  }))
  const usersById = new Map(users.map(user => [user.id, user]))

  const records = postRows.map((post): SocialPostRecord => {
    const userId = text(value(post, 'user_id', 'userId'))
    const author = usersById.get(userId)
    const likes = number(value(post, 'likes'))
    const shares = number(value(post, 'shares'))
    const comments = number(value(post, 'comments'))
    return {
      id: text(value(post, 'id')),
      content: text(value(post, 'content')),
      platform: platform(value(post, 'platform')) || 'twitter',
      status: status(value(post, 'status')),
      scheduledAt: text(value(post, 'scheduled_at', 'scheduledAt')),
      publishedAt: text(value(post, 'published_at', 'publishedAt')),
      likes,
      shares,
      comments,
      reach: number(value(post, 'reach')),
      engagement: likes + shares + comments,
      imageUrl: text(value(post, 'image_url', 'imageUrl')),
      externalId: text(value(post, 'external_id', 'externalId')),
      userId,
      authorName: author?.name || (userId ? `User ${userId}` : 'Unassigned'),
      authorEmail: author?.email || '',
      createdAt: text(value(post, 'created_at', 'createdAt')),
    }
  })

  return {
    records,
    summary: {
      total: records.length,
      published: records.filter(record => record.status === 'published').length,
      scheduled: records.filter(record => record.status === 'scheduled').length,
      drafts: records.filter(record => record.status === 'draft').length,
      failed: records.filter(record => record.status === 'failed').length,
      reach: records.reduce((sum, record) => sum + record.reach, 0),
      engagement: records.reduce((sum, record) => sum + record.engagement, 0),
    },
    users,
  }
}

export function socialPostWriteData(input: Record<string, unknown>, now = new Date()): {
  content: string
  platform: SocialPostPlatform | ''
  status: SocialPostStatus
  scheduled_at: string | null
  published_at: string | null
  image_url: string | null
  user_id: number | null
} {
  const postStatus = status(input.status)
  const scheduledAt = text(input.scheduledAt ?? input.scheduled_at).trim()
  const publishedAt = text(input.publishedAt ?? input.published_at).trim()
  const imageUrl = text(input.imageUrl ?? input.image_url).trim()
  const userId = Number(input.userId ?? input.user_id)
  return {
    content: text(input.content).trim(),
    platform: platform(input.platform),
    status: postStatus,
    scheduled_at: scheduledAt || null,
    published_at: postStatus === 'published'
      ? publishedAt || now.toISOString().slice(0, 19).replace('T', ' ')
      : publishedAt || null,
    image_url: imageUrl || null,
    user_id: Number.isInteger(userId) && userId > 0 ? userId : null,
  }
}

export function validateSocialPostSchedule(data: ReturnType<typeof socialPostWriteData>, now = new Date()): string {
  if (data.status !== 'scheduled')
    return ''
  if (!data.scheduled_at)
    return 'Scheduled posts require a schedule time.'
  const timestamp = new Date(data.scheduled_at.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp))
    return 'Enter a valid schedule time.'
  if (timestamp <= now.getTime())
    return 'Schedule time must be in the future.'
  return ''
}

export function validateSocialPostWriteData(data: ReturnType<typeof socialPostWriteData>): string {
  if (data.content.length < 1 || data.content.length > 2000)
    return 'Post content must be between 1 and 2000 characters.'
  if (!data.platform)
    return 'Choose a valid social platform.'
  if (data.image_url) {
    try {
      const url = new URL(data.image_url)
      if (!['http:', 'https:'].includes(url.protocol))
        return 'Image URL must use HTTP or HTTPS.'
    }
    catch {
      return 'Image URL must be a valid URL.'
    }
  }
  return validateSocialPostSchedule(data)
}
