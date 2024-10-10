import { type Ok, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { existsSync } from '@stacksjs/storage'
import { camelCase } from '@stacksjs/strings'
import { route } from './router'

export async function listRoutes(): Promise<Ok<string, any>> {
  const routeLists = await route.getRoutes()

  // eslint-disable-next-line no-console
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

export async function extractModelRequest(action: string): Promise<Request | null> {
  const extractedModel = extractModelFromAction(action)
  const lowerCaseModel = camelCase(extractedModel)
  const requestPath = path.frameworkPath(`requests/${extractedModel}Request.ts`)
  const requestInstance = await import(requestPath)
  const requestIndex = `${lowerCaseModel}Request`

  return requestInstance[requestIndex]
}

export async function findRequestInstance(requestInstance: string): Promise<Request | null> {
  const frameworkDirectory = path.storagePath('framework/requests')
  const filePath = path.join(frameworkDirectory, `${requestInstance}.ts`)
  const pathExists = await existsSync(filePath)

  // Check if the directory exists
  if (pathExists) {
    const requestInstance = await import(filePath)

    return requestInstance.request
  }

  const defaultRequestPath = path.storagePath('framework/core/router/src/request.ts')
  const fileExists = await existsSync(defaultRequestPath)

  if (fileExists) {
    const requestInstance = await import(defaultRequestPath)

    return requestInstance.request
  }

  return null
}

export async function extractDefaultRequest(): Promise<Request> {
  const requestPath = path.frameworkPath(`core/router/src/request.ts`)
  const requestInstance = await import(requestPath)

  return requestInstance.request
}
