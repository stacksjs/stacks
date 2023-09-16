import User from '../../../../../app/models/User'

const fields: any = User.fields

const fieldkeys = Object.keys(fields)

const input = [
  {
    field: 'name',
    rule: 'validate.string().maxLength(50).nullable()',
  },
  {
    field: 'status',
    rule: 'validate.string().maxLength(50).nullable()',
  },
  {
    field: 'email',
    rule: 'validate.string().maxLength(50).nullable()',
  },
  {
    field: 'password',
    rule: 'validate.string().maxLength(50).nullable()',
  },
]

const modelEntity = input.map((item) => {
  // Split the input string by "validate."
  const parts = item.rule.split('validate.')

  // Extract the string after "validate."
  const extractedString = parts[1]

  if (extractedString) {
    // Split the input string by periods (.)
    const extractedParts = extractedString.split('.')

    const regex = /\(([^)]+)\)/

    const fieldArray = extractedParts.map((input) => {
      // Use the regular expression to extract values inside parentheses
      const match = regex.exec(input)
      const value = match ? match[1] : null

      // Remove the parentheses from the string
      const field = input.replace(regex, '').replace(/\(|\)/g, '')

      return { entity: field, charValue: value }
    })

    return { field: item.field, fieldArray }
  }
})

const fieldAssociation: { [key: string]: string } = {
  string: 'varchar',
  number: 'integer',
  boolean: 'boolean',
  text: 'text',
}

const fieldEntity = [
  'maxLength',
  'minLength',
]

export { fieldEntity, fieldAssociation, modelEntity }
