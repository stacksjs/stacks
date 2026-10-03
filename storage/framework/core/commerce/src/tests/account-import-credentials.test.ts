import { describe, expect, it } from 'bun:test'
import { credentialSecrets, MissingCredentialsError, readAccountCredentials, redactSecrets } from '../imports'

/**
 * Admin API credentials come from env only, and a missing one fails before
 * any request with the variable names and where to create them.
 */

function message(run: () => unknown): string {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(MissingCredentialsError)
    return (error as Error).message
  }
  throw new Error('expected readAccountCredentials to throw')
}

describe('readAccountCredentials', () => {
  it('reads each platform\'s variables, trimmed', () => {
    expect(readAccountCredentials('Shopify', { SHOPIFY_ADMIN_TOKEN: ' shpat_abc ' })).toEqual({ source: 'shopify', accessToken: 'shpat_abc' })
    expect(readAccountCredentials('woocommerce', { WOOCOMMERCE_CONSUMER_KEY: 'ck_1', WOOCOMMERCE_CONSUMER_SECRET: 'cs_2' }))
      .toEqual({ source: 'woocommerce', consumerKey: 'ck_1', consumerSecret: 'cs_2' })
    expect(readAccountCredentials('shopware', { SHOPWARE_CLIENT_ID: 'SWIAABC', SHOPWARE_CLIENT_SECRET: 'secret' }))
      .toEqual({ source: 'shopware', clientId: 'SWIAABC', clientSecret: 'secret' })
  })

  it('names the missing variable and where to create the credential', () => {
    const shopify = message(() => readAccountCredentials('shopify', {}))
    expect(shopify).toContain('SHOPIFY_ADMIN_TOKEN is not set')
    expect(shopify).toContain('never from a flag')
    expect(shopify).toContain('read_customers and read_orders')
    expect(shopify).toContain('read_all_orders')

    const woo = message(() => readAccountCredentials('woocommerce', { WOOCOMMERCE_CONSUMER_KEY: 'ck_1', WOOCOMMERCE_CONSUMER_SECRET: '   ' }))
    expect(woo).toContain('WOOCOMMERCE_CONSUMER_SECRET is not set')
    expect(woo).not.toContain('WOOCOMMERCE_CONSUMER_KEY is')
    expect(woo).toContain('WooCommerce > Settings > Advanced > REST API')

    const shopware = message(() => readAccountCredentials('shopware', {}))
    expect(shopware).toContain('SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET are not set')
    expect(shopware).toContain('Settings > System > Integrations')
  })

  it('never puts a value in a message', () => {
    const text = message(() => readAccountCredentials('woocommerce', { WOOCOMMERCE_CONSUMER_KEY: 'ck_ secret with spaces', WOOCOMMERCE_CONSUMER_SECRET: 'cs_x' }))
    expect(text).toContain('WOOCOMMERCE_CONSUMER_KEY contains whitespace')
    expect(text).not.toContain('secret with spaces')
  })

  it('rejects a Shopware sales channel key passed as the client id', () => {
    expect(message(() => readAccountCredentials('shopware', { SHOPWARE_CLIENT_ID: 'SWSCPUBLICKEY', SHOPWARE_CLIENT_SECRET: 'x' }))).toContain('sales channel access key')
  })

  it('rejects a platform with no admin import', () => {
    expect(message(() => readAccountCredentials('magento', {}))).toContain('shopify, woocommerce, shopware')
  })
})

describe('redactSecrets', () => {
  it('scrubs every credential value, however often it appears', () => {
    const credentials = readAccountCredentials('woocommerce', { WOOCOMMERCE_CONSUMER_KEY: 'ck_live_1234', WOOCOMMERCE_CONSUMER_SECRET: 'cs_live_5678' })
    expect(redactSecrets('key ck_live_1234, secret cs_live_5678, again ck_live_1234', credentialSecrets(credentials)))
      .toBe('key [redacted], secret [redacted], again [redacted]')
  })
})
