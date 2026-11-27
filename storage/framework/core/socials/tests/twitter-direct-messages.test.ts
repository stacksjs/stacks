import { afterEach, expect, it, mock, spyOn } from 'bun:test'
import { TwitterApiError, TwitterPublishingDriver } from '../src/drivers/twitter'

const identity = { handle: 'author', accessToken: 'fixture-token' }

afterEach(() => {
  mock.restore()
})

it('reads one paid X message page and forwards the opaque cursor', async () => {
  const event = { id: '441', dm_conversation_id: '123-456', sender_id: '456', text: 'Hello' }
  const user = { id: '456', username: 'reader', name: 'Reader' }
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
    data: [event],
    includes: { users: [user] },
    meta: { next_token: 'next-page' },
  }))

  const page = await new TwitterPublishingDriver().listDirectMessageEvents(identity, { limit: 20, cursor: 'previous-page' })

  expect(page).toEqual({ events: [event], users: [user], cursor: 'next-page' })
  expect(fetch).toHaveBeenCalledTimes(1)
  const [input, options] = fetch.mock.calls[0]!
  const url = new URL(String(input))
  expect(url.pathname).toBe('/2/dm_events')
  expect(url.searchParams.get('event_types')).toBe('MessageCreate')
  expect(url.searchParams.get('expansions')).toBe('sender_id')
  expect(url.searchParams.get('pagination_token')).toBe('previous-page')
  expect(url.searchParams.get('max_results')).toBe('20')
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-token')
})

it('sends a reply into the given conversation and returns the created event id', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
    data: { dm_conversation_id: '123-456', dm_event_id: '442' },
  }, { status: 201 }))

  await expect(new TwitterPublishingDriver().sendDirectMessage(identity, '123-456', 'Thanks!')).resolves.toEqual({
    conversationId: '123-456', eventId: '442',
  })
  const [input, options] = fetch.mock.calls[0]!
  expect(new URL(String(input)).pathname).toBe('/2/dm_conversations/123-456/messages')
  expect(options?.method).toBe('POST')
  expect(options?.body).toBe('{"text":"Thanks!"}')
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-token')
})

it('uses the cursor for a particular conversation and accepts a genuinely empty page', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ meta: { result_count: 0 } }))
  await expect(new TwitterPublishingDriver().listDirectMessageEvents(identity, {
    conversationId: '123-456', cursor: 'conversation-cursor', limit: 1,
  })).resolves.toEqual({ events: [], users: [], cursor: undefined })
  const url = new URL(String(fetch.mock.calls[0]![0]))
  expect(url.pathname).toBe('/2/dm_conversations/123-456/dm_events')
  expect(url.searchParams.get('pagination_token')).toBe('conversation-cursor')
  expect(url.searchParams.get('max_results')).toBe('1')
})

it('does not send a second reply when X omits the receipt', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ data: {} }, { status: 201 }))
  await expect(new TwitterPublishingDriver().sendDirectMessage(identity, '123-456', 'Thanks!')).rejects.toThrow('Refresh the conversation')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('reports denied DM scopes without marking the access token expired', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ title: 'Insufficient scope' }, { status: 403 }))
  try {
    await new TwitterPublishingDriver().listDirectMessageEvents(identity)
    throw new Error('Expected X to deny the DM read')
  }
  catch (error) {
    expect(error).toBeInstanceOf(TwitterApiError)
    expect((error as TwitterApiError).kind).toBe('permission')
    expect((error as TwitterApiError).isAuthError).toBe(false)
  }
})
