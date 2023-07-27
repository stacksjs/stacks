export interface FCMPushNotificationOptions {
  eventName: string
  to: {
    subscriberId: string
  }
  payload: {
    deviceTokens: Array<string>
    badge: boolean
    clickAction: string
    color: string
    icon: string
    sound: string
  }
}

export interface ExpoPushNotificationOptions {
  eventName: string
  to: {
    subscriberId: string
  }
  payload: {
    to: string[]
    data: object
    title: string
    body: string
    ttl: number
    expiration: number
    priority: 'default' | 'normal' | 'high'
    subtitle: string
    sound: 'default' | null
    badge: number
    channelId: string
    categoryId: string
    mutableContent: boolean
  }
}
