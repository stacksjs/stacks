import User from '../../../../../../app/Models/User'

export interface ModelElement {
  field: string
  default: string | number | boolean | Date | undefined | null
  unique: boolean
  fieldArray: FieldArrayElement[]
}

export interface FieldArrayElement {
  entity: string
  charValue?: string | null
  // Add other properties as needed
}
const rules: string[] = []

async function extractModelRule() {
  const modelFile = Bun.file('../../../../../app/Models/User.ts') // Assuming Bun is imported properly

  const code = await modelFile.text()

  const regex = /rule:.*$/gm

  let match: RegExpExecArray | null
  match = regex.exec(code)
  while (match !== null) {
    rules.push(match[0])
    match = regex.exec(code)
  }
}

await extractModelRule()

// TODO: we can improve this type
const fields: Record<string, any> = User.fields
const fieldKeys = Object.keys(fields)

const input: ModelElement[] = fieldKeys.map((field, index) => {
  const fieldExist = fields[field]
  let defaultValue = null
  let uniqueValue = false

  if (fieldExist) {
    defaultValue = fieldExist.default || null
    uniqueValue = fieldExist.unique || false
  }

  return {
    field,
    default: defaultValue,
    unique: uniqueValue,
    fieldArray: parseRule(rules[index] ?? ''),
  }
})

function parseRule(rule: string): FieldArrayElement[] {
  const parts = rule.split('rule: validator.')

  if (parts.length !== 2)
    return []

  if (!parts[1])
    parts[1] = ''

  const extractedString = parts[1].replace(/,/g, '')

  if (!extractedString)
    return []

  const extractedParts = extractedString.split('.')
  const regex = /\(([^)]+)\)/

  return extractedParts.map((input) => {
    const match = regex.exec(input)
    const value = match ? match[1] : null
    const field = input.replace(regex, '').replace(/\(|\)/g, '')
    return { entity: field, charValue: value }
  })
}

const modelEntity: ModelElement[] = input

// You can now use the modelEntity array with type safety.

const fieldAssociation: { [key: string]: { [key: string]: string } } = {
  mysql: {
    string: 'varchar',
    enum: 'varchar',
    number: 'integer',
    boolean: 'boolean',
    text: 'text',
  },
  sqlite: {
    string: 'text',
    enum: 'text',
    number: 'integer',
    boolean: 'boolean',
    text: 'text',
  },
}

const fieldEntity = [
  'maxLength',
]

const excludeFieldEntity = [
  'minLength',
  'enum',
]

export { fieldEntity, fieldAssociation, modelEntity, excludeFieldEntity }
