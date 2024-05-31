import { path } from "@stacksjs/path";
import { plural } from "@stacksjs/strings";
import type { Model } from "@stacksjs/types";

export function getModelName(model: Model, modelPath: string): string {
    if (model.name) 
        return model.name

    const baseName =  path.basename(modelPath)

    return baseName.replace(/\.ts$/, '');
}

export function getTableName(model: Model, modelPath: string): string {
    if (model.table) 
        return model.table

    return plural(getModelName(model, modelPath))
}