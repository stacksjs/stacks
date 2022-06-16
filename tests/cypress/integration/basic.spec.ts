context('Basic', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('tests the hello-world component', () => {
    cy.url()
      .should('eq', 'http://localhost:3333/')

    cy.get('hello-world')
      .should('exist')

    cy.get('hello-world')
      .shadow()
      .contains('Welcome')
      .should('exist')

    // cy.contains('Count is')
    //   .should('exist')

    cy.get('hello-world')
      .shadow()
      .find('button')
      .click()
      .url()
      .should('eq', 'http://localhost:3333/')

    cy.get('hello-world')
      .shadow()
      .contains('Count is: 1')
  })
})
