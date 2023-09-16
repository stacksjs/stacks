import User from '../../../../../app/models/User'

const fields = (User as any).fields // Assuming you have a specific type for fields

export interface ModelElement {
  field: string
  default: string | number | boolean | Date | undefined | null
  fieldArray: FieldArrayElement[]
}

export interface FieldArrayElement {
  entity: string
  charValue?: string | null
  // Add other properties as needed
}
const rules: string[] = []
const defaults: string[] = []

async function extractModelRule() {
  const modelFile = Bun.file('../../../../../app/models/User.ts') // Assuming Bun is imported properly

  const code = await modelFile.text()

  const regex = /rule:.*$/gm

  let match: RegExpExecArray | null
  while ((match = regex.exec(code)) !== null) rules.push(match[0])
}

async function extractModelDefault() {
  const modelFile = Bun.file('../../../../../app/models/User.ts') // Assuming Bun is imported properly

  const code = await modelFile.text()

  const regex = /default:.*$/gm

  let match: RegExpExecArray | null
  while ((match = regex.exec(code)) !== null) defaults.push(match[0].replace(/,/g, ''))
}

await extractModelRule()
await extractModelDefault()

const fieldKeys = Object.keys(fields)

const input: ModelElement[] = fieldKeys.map((field, index) => {
  const fieldExist = User.fields[field]
  let defaultValue = ''

  if (fieldExist)
    defaultValue = fieldExist?.validator?.default

  return {
    field,
    default: defaultValue,
    fieldArray: parseRule(rules[index])
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

const fieldAssociation: { [key: string]: string } = {
  string: 'varchar',
  enum: 'varchar',
  number: 'integer',
  boolean: 'boolean',
  text: 'text',
}

const fieldEntity = [
  'maxLength',
]

const excludeFieldEntity = [
  'minLength',
  'enum',
]

export { fieldEntity, fieldAssociation, modelEntity, excludeFieldEntity }
