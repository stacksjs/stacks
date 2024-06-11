import { ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { route } from './router'

import { camelCase, lowercase, pascalCase } from '@stacksjs/strings'

export async function listRoutes() {
  const routeLists = await route.getRoutes()

  console.table(routeLists)

  return ok('Successfully listed routes!')
}

export function extractModelFromAction(action: string): string {
  let model = ''

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

  const requestPath = path.projectStoragePath(`framework/requests/${extractedModel}Request.ts`)

  const requestInstance = await import(requestPath)

  const requestIndex = `${lowerCaseModel}Request`

  return requestInstance[requestIndex]
}
