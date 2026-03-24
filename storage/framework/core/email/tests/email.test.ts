import { describe, expect, it } from 'bun:test'
import { Email, mail } from '../src/email'

describe('@stacksjs/email', () => {
  describe('Email class', () => {
    it('constructor sets name property', () => {
      const email = new Email({ name: 'Welcome', subject: 'Hello', to: 'user@test.com', template: 'welcome' })
      expect(email.name).toBe('Welcome')
    })

    it('constructor sets subject property', () => {
      const email = new Email({ name: 'Test', subject: 'Test Subject', to: 'user@test.com', template: 'test' })
      expect(email.subject).toBe('Test Subject')
    })

    it('constructor sets to property', () => {
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'test' })
      expect(email.to).toBe('user@test.com')
    })

    it('constructor sets from property', () => {
      const from = { name: 'Admin', address: 'admin@test.com' }
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'test', from })
      expect(email.from).toEqual(from)
    })

    it('constructor sets template property', () => {
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'welcome' })
      expect(email.template).toBe('welcome')
    })

    it('constructor sets handle callback', () => {
      const handle = async () => ({ message: 'done' })
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'test', handle })
      expect(typeof email.handle).toBe('function')
    })

    it('constructor sets onSuccess callback', () => {
      const onSuccess = () => {}
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'test', onSuccess })
      expect(typeof email.onSuccess).toBe('function')
    })

    it('constructor sets onError callback', () => {
      const onError = async () => ({ message: 'error' })
      const email = new Email({ name: 'Test', subject: 'Test', to: 'user@test.com', template: 'test', onError })
      expect(typeof email.onError).toBe('function')
    })
  })

  describe('Mail singleton', () => {
    it('mail is defined', () => {
      expect(mail).toBeDefined()
    })

    it('mail has send method', () => {
      expect(typeof mail.send).toBe('function')
    })

    it('mail has use method', () => {
      expect(typeof mail.use).toBe('function')
    })

    it('mail has queue method', () => {
      expect(typeof mail.queue).toBe('function')
    })

    it('mail has later method', () => {
      expect(typeof mail.later).toBe('function')
    })

    it('mail has queueOn method', () => {
      expect(typeof mail.queueOn).toBe('function')
    })

    it('mail.use() throws for unknown driver', () => {
      expect(() => mail.use('nonexistent')).toThrow('not available')
    })
  })
})
