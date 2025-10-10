import { path } from '@stacksjs/path'
import { resetDatabase } from 'bun-query-builder'

export function refreshDatabase(): void {
    const modelsPath = path.userModelsPath()

    resetDatabase(modelsPath, 'postgres')
}

refreshDatabase()