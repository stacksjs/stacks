import { describe, expect, it } from 'bun:test'
import { safe, template } from '../src/template'

// A `.stx` template receives the variables as props, so a `safe()` value
// reached `{!! itemRows !!}` as the SafeHtml wrapper and printed
// `[object Object]` - every order confirmation showed that where its line
// items belong (stacksjs/stacks#3176).
describe('safe() in a .stx template', () => {
  it('prints the marked HTML through {!! !!}', async () => {
    const { html } = await template('order-confirmation', {
      variables: {
        orderId: 7,
        itemRows: safe('<tr><td data-line-item>Widget &times; 2</td></tr>'),
        subtotalLabel: '$10.00',
        shippingLabel: '$0.00',
        totalLabel: '$10.00',
      },
      inline: false,
    })

    expect(html).toContain('<tr><td data-line-item>Widget &times; 2</td></tr>')
    expect(html).not.toContain('[object Object]')
  }, 60_000)

  it('still escapes a plain string the template prints with {{ }}', async () => {
    const { html } = await template('order-confirmation', {
      variables: { orderId: 7, customerName: '<b>Ada</b>' },
      inline: false,
    })

    expect(html).toContain('&lt;b&gt;Ada&lt;/b&gt;')
    expect(html).not.toContain('<b>Ada</b>')
  }, 60_000)
})
