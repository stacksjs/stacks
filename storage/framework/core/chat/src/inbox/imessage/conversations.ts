import type { ChatRow } from './chat-db'
import { isAddressable } from './handles'
import { CHAT_STYLE_GROUP } from './chat-db'

/**
 * What a person calls "a conversation" is not one row of `chat`. Messages
 * keeps a separate chat per service (`iMessage;-;+1555...`, `SMS;-;+1555...`,
 * and `any;-;+1555...` on newer systems) and shows them merged, and a deleted
 * conversation that someone texts again comes back as a NEW chat row. So
 * Attic keys a conversation on what survives both: the other person's handle
 * for a direct chat, the group id for a group.
 */
export function conversationKey(chat: Pick<ChatRow, 'style' | 'identifier' | 'groupId' | 'guid'>): string {
  if (chat.style === CHAT_STYLE_GROUP)
    return `group:${chat.groupId || chat.guid}`
  return `direct:${chat.identifier}`
}

export interface LiveConversation {
  key: string
  kind: 'direct' | 'group'
  chatGuids: string[]
  displayName: string | null
  groupId: string | null
  participants: string[]
  messageCount: number
  recoverableCount: number
  unreadCount: number
  lastMessageAt: number | null
  lastMessageRowId: number
  lastMessageText: string | null
  lastMessageFromMe: boolean
  services: string[]
}

/** Merge chat rows into conversations, newest activity first. */
export function groupChats(chats: ChatRow[]): LiveConversation[] {
  const byKey = new Map<string, LiveConversation>()

  for (const chat of chats) {
    const key = conversationKey(chat)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        kind: chat.style === CHAT_STYLE_GROUP ? 'group' : 'direct',
        chatGuids: [chat.guid],
        displayName: chat.displayName,
        groupId: chat.groupId,
        participants: chat.style === CHAT_STYLE_GROUP ? [...chat.participants] : [chat.identifier],
        messageCount: chat.messageCount,
        recoverableCount: chat.recoverableCount,
        unreadCount: chat.unreadCount,
        lastMessageAt: chat.lastMessageAt,
        lastMessageRowId: chat.lastMessageRowId,
        lastMessageText: chat.lastMessageText,
        lastMessageFromMe: chat.lastMessageFromMe,
        services: [chat.service],
      })
      continue
    }

    existing.chatGuids.push(chat.guid)
    existing.messageCount += chat.messageCount
    existing.recoverableCount += chat.recoverableCount
    existing.unreadCount += chat.unreadCount
    if (!existing.services.includes(chat.service))
      existing.services.push(chat.service)
    for (const handle of chat.participants) {
      if (existing.kind === 'group' && !existing.participants.includes(handle))
        existing.participants.push(handle)
    }
    if ((chat.lastMessageAt ?? 0) > (existing.lastMessageAt ?? 0)) {
      existing.lastMessageAt = chat.lastMessageAt
      existing.lastMessageRowId = chat.lastMessageRowId
      existing.lastMessageText = chat.lastMessageText
      existing.lastMessageFromMe = chat.lastMessageFromMe
      // The newest chat carries the current group name.
      existing.displayName = chat.displayName ?? existing.displayName
    }
  }

  return [...byKey.values()].sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
}

/**
 * A URL that opens this conversation in Messages. Messages builds the group
 * form itself (`sms://open?groupid=`); a direct chat opens by address. Null
 * for conversations Messages cannot open by URL, like short codes.
 */
export function messagesUrl(conversation: Pick<LiveConversation, 'kind' | 'groupId' | 'participants'>): string | null {
  if (conversation.kind === 'group')
    return conversation.groupId ? `sms://open?groupid=${encodeURIComponent(conversation.groupId)}` : null
  const handle = conversation.participants[0]
  if (!handle || !isAddressable(handle))
    return null
  return `sms:${handle}`
}
