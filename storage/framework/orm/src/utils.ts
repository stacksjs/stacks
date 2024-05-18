import type { Model } from '@stacksjs/types'

type ModelPath = string

export async function modelTableName(model: Model | ModelPath): Promise<string> {
  if (typeof model === 'string') {
    const modelPath = model
    model = (await import(model)).default as Model
  }

  return model.table ?? snakeCase(pluralize(model.name ?? modelPath.replace(/.*\/(.*)\.ts$/, '$1')))
}
