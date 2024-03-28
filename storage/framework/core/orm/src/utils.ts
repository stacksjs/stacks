import type { Fields } from '@stacksjs/types'
import { fs } from '@stacksjs/storage'
import { generator, parser, traverse } from '@stacksjs/build'

export async function extractFieldsFromModel(filePath: string) {
  // Read the TypeScript file
  const content = fs.readFileSync(filePath, 'utf8')

  // Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: Fields | undefined

  // Traverse the AST to find the `fields` object
  traverse(ast, {
    ObjectExpression(path) {
      // Look for the `fields` key in the object
      const fieldsProperty = path.node.properties.find(
        property => property.key && property.key.name === 'fields',
      )

      if (fieldsProperty && fieldsProperty.value) {
        // Convert the AST back to code (stringify)
        const generated = generator(fieldsProperty.value, {}, content)
        fields = generated.code
        path.stop() // Stop traversing further once we found the fields
      }
    },
  })

  return fields
}
