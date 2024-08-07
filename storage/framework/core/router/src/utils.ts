import { ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { camelCase } from '@stacksjs/strings'
import { route } from './router'

export async function listRoutes() {
  const routeLists = await route.getRoutes()

  console.table(routeLists)

  return ok('Successfully listed routes!')
}

export function extractModelFromAction(action: string): string {
  let model = ''

  if (action.includes('IndexOrmAction')) {
    const match = action.match(/\/([A-Z][a-z]+)IndexOrmAction/)

    const modelString = match ? match[1] : ''

    model = modelString as string
  }

  if (action.includes('StoreOrmAction')) {
    const match = action.match(/\/([A-Z][a-z]+)StoreOrmAction/)

    const modelString = match ? match[1] : ''

    model = modelString as string
  }

  if (action.includes('ShowOrmAction')) {
    const match = action.match(/\/([A-Z][a-z]+)ShowOrmAction/)
    const modelString = match ? match[1] : ''

    model = modelString as string
  }

  if (action.includes('UpdateOrmAction')) {
    const match = action.match(/\/([A-Z][a-z]+)UpdateOrmAction/)
    const modelString = match ? match[1] : ''

    model = modelString as string
  }

  if (action.includes('DestroyOrmAction')) {
    const match = action.match(/\/([A-Z][a-z]+)DestroyOrmAction/)
    const modelString = match ? match[1] : ''

    model = modelString as string
  }

  return model
}

export function extractDynamicAction(action: string): string | undefined {
  const regex = /Actions\/(.*?)Action/

  const match = action.match(regex)

  return match ? match[1] : ''
}

export async function extractModelRequest(action: string) {
  const extractedModel = extractModelFromAction(action)

  const lowerCaseModel = camelCase(extractedModel)

  const requestPath = path.projectStoragePath(`framework/requests/${extractedModel}Request.ts`)

  const requestInstance = await import(requestPath)

  const requestIndex = `${lowerCaseModel}Request`

  return requestInstance[requestIndex]
}

export async function extractDynamicRequest(action: string) {
  const extractedModel = extractDynamicAction(action) || ''

  const lowerCaseModel = camelCase(extractedModel)

  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  const fileToCheck = `${extractedModel}.ts`

  const fileExists = modelFiles.some((file) => file.split('/').pop() === fileToCheck)

  if (!fileExists) {
    const requestPath = path.projectStoragePath(`framework/core/router/src/request.ts`)
    const requestInstance = await import(requestPath)

    return requestInstance.request
  }

  const requestPath = path.projectStoragePath(`framework/requests/${extractedModel}Request.ts`)

  const requestInstance = await import(requestPath)

  const requestIndex = `${lowerCaseModel}Request`

  return requestInstance[requestIndex]
}
