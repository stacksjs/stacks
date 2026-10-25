import { beforeEach, describe, expect, it } from 'bun:test'
import { renderCheckout } from '../../resources/components/checkout'

describe('Checkout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('submits the form with the entered details', () => {
    document.body.appendChild(renderCheckout())

    const email = document.querySelector<HTMLInputElement>('[name="email"]')!
    email.value = 'test@example.com'
    email.dispatchEvent(new Event('input', { bubbles: true }))

    const submittedEmails: string[] = []
    document.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault()
      const form = event.target as HTMLFormElement
      submittedEmails.push(form.querySelector<HTMLInputElement>('[name="email"]')!.value)
    })

    document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()

    expect(submittedEmails).toEqual(['test@example.com'])
  })
})
