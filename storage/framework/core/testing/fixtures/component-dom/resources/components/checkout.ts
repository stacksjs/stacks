export function renderCheckout(): HTMLFormElement {
  const form = document.createElement('form')
  const email = document.createElement('input')
  const submit = document.createElement('button')

  email.name = 'email'
  email.type = 'email'
  submit.type = 'submit'
  submit.textContent = 'Checkout'
  form.append(email, submit)

  return form
}
