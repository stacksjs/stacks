import { path } from "@stacksjs/path"
import { plural, snakeCase } from "@stacksjs/strings"
import type { Model, TableNames } from "@stacksjs/types"

export function getModelName(model: Model, modelPath: string): string {
  if (model.name)
    return model.name

  const baseName = path.basename(modelPath)

  return baseName.replace(/\.ts$/, '')
}

export function getTableName(model: Model, modelPath: string): TableNames {
  if (model.table)
    return model.table as TableNames

  return snakeCase(plural(getModelName(model, modelPath))) as TableNames
}