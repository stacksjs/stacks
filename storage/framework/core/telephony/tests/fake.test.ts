import { expect, test } from 'bun:test'
import { FakeTelephony } from '../src/testing.ts'
import { voiceResponse } from '../src/index.ts'

test('fake exercises search/provision/inbound/outbound/control/release through the same adapter contract', async () => {
  const fake = new FakeTelephony()
  const us = (await fake.searchNumbers({ country: 'US', areaCode: '415' }))[0]!
  const ca = (await fake.searchNumbers({ country: 'CA' }))[0]!
  expect(us.country).toBe('US')
  expect(ca.country).toBe('CA')
  const number = await fake.provisionNumber({ phoneNumber: us.phoneNumber, voiceUrl: 'https://app.example/voice' }, { operationKey: 'provision' })
  await fake.configureNumber(number.sid, 'https://app.example/changed', { operationKey: 'route' })
  expect((await fake.listNumbers(us.phoneNumber))[0]?.voiceUrl).toBe('https://app.example/changed')
  const inbound = fake.receiveCall({ from: ca.phoneNumber, to: number.phoneNumber })
  expect((await fake.getCall(inbound.sid)).direction).toBe('inbound')
  await fake.redirectCall(inbound.sid, { twiml: voiceResponse([{ type: 'say', text: 'Welcome' }]) }, { operationKey: 'answer' })
  const outbound = await fake.createCall({ from: number.phoneNumber, to: ca.phoneNumber, url: 'https://app.example/voice' }, { operationKey: 'outbound' })
  expect(outbound.status).toBe('queued')
  expect((await fake.endCall(outbound.sid, 'canceled', { operationKey: 'cancel' })).status).toBe('canceled')
  expect((await fake.endCall(inbound.sid, 'completed', { operationKey: 'complete' })).status).toBe('completed')
  expect((await fake.listCalls({ to: ca.phoneNumber })).length).toBe(1)
  await fake.releaseNumber(number.sid, { operationKey: 'release' })
  await fake.releaseNumber(number.sid, { operationKey: 'release' })
  expect(await fake.listNumbers()).toEqual([])
})

test('fake can lose a response after committing without silently placing a duplicate call', async () => {
  const fake = new FakeTelephony()
  const number = await fake.provisionNumber({ phoneNumber: '+14155550100', voiceUrl: 'https://app.example/voice' }, { operationKey: 'provision' })
  fake.failNext('after-write')
  const input = { from: number.phoneNumber, to: '+16135550100', twiml: '<Response><Hangup/></Response>' }
  await expect(fake.createCall(input, { operationKey: 'lost' })).rejects.toMatchObject({ code: 'write_uncertain' })
  await expect(fake.createCall(input, { operationKey: 'lost' })).rejects.toMatchObject({ code: 'write_uncertain' })
  expect(await fake.listCalls({ to: input.to })).toHaveLength(1)
  const same = new FakeTelephony()
  expect((await same.searchNumbers({ country: 'US' }))[0]?.phoneNumber).toBe('+14155550100')
})
