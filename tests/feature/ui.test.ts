import { expect, test } from 'bun:test'

test('dom test', () => {
  document.body.innerHTML = `<button>My button</button>`
  const button = document.querySelector('button')
  expect(button?.textContent).toEqual('My button')
})
