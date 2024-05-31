import { generator, parser, traverse } from '@stacksjs/build'
import { fs } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import { plural, snakeCase } from '@stacksjs/strings'
import type { Attributes } from '@stacksjs/types'
import type { Model } from '@stacksjs/types'

export function getModelName(model: Model, modelPath: string): string {
    if (model.name) 
        return model.name

    const baseName =  path.basename(modelPath)

    return baseName.replace(/\.ts$/, '');
}

export function getTableName(model: Model, modelPath: string): string {
    if (model.table) 
        return model.table
    
    return snakeCase(plural(getModelName(model, modelPath)))
}

export async function extractFieldsFromModel(filePath: string) {
  // Read the TypeScript file
  const content = fs.readFileSync(filePath, 'utf8')

  // Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: Attributes | undefined

  // Traverse the AST to find the `fields` object
  traverse(ast, {
    ObjectExpression(path) {
      // Look for the `fields` key in the object
      const fieldsProperty = path.node.properties.find((property) => property.key?.name === 'attributes')

      if (fieldsProperty?.value) {
        // Convert the AST back to code (stringify)
        const generated = generator(fieldsProperty.value, {}, content)
        fields = generated.code
        path.stop() // Stop traversing further once we found the fields
      }
    },
  })

  return fields
}

export function userModels() {
  return import.meta.glob<{ default: Model }>(path.userModelsPath('*.ts'))
}
