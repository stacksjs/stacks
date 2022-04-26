context('Basic', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('tests the table-v2 component', () => {
    cy.url()
      .should('eq', 'http://localhost:3333/')

    cy.get('table-v2')
      .should('exist')

    cy.get('table-v2')
      .shadow()
      .contains('Welcome')
      .should('exist')

    // cy.contains('Count is')
    //   .should('exist')

    cy.get('table-v2')
      .shadow()
      .find('button')
      .click()
      .url()
      .should('eq', 'http://localhost:3333/')

    cy.get('table-v2')
      .shadow()
      .contains('Count is: 1')
  })
})
