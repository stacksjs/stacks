import { ok } from '@stacksjs/error-handling'
import { route } from './router'
import { path } from '@stacksjs/path'

import { lowercase } from '@stacksjs/strings'

export async function listRoutes() {
  const routeLists = await route.getRoutes()

  console.table(routeLists)

  return ok('Successfully listed routes!')
}

export function extractModelFromAction(action: string): string {
  let model = ''

  if (action.includes("StoreOrmAction")) {
    const match = action.match(/\/([A-Z][a-z]+)StoreOrmAction/);

    const modelString = match ? match[1] : '';
  
    model = modelString as string
  }

  if (action.includes("ShowOrmAction")) {
    const match = action.match(/\/([A-Z][a-z]+)ShowOrmAction/);
    const modelString = match ? match[1] : '';
  
    model = modelString as string
  }

  if (action.includes("UpdateOrmAction")) {
    const match = action.match(/\/([A-Z][a-z]+)UpdateOrmAction/);
    const modelString = match ? match[1] : '';
  
    model = modelString as string
  }

  if (action.includes("DestroyOrmAction")) {
    const match = action.match(/\/([A-Z][a-z]+)DestroyOrmAction/);
    const modelString = match ? match[1] : '';
  
    model = modelString as string
  }

  return model
}

export async function extractModelRequest(action: string) {
  const extractedModel = extractModelFromAction(action)

  const lowerCaseModel = lowercase(extractedModel)

  const requestPath = path.projectStoragePath(`framework/requests/${extractedModel}Request.ts`)

  const requestInstance = await import(requestPath)

  const requestIndex = `${lowerCaseModel}Request`
  
  return requestInstance[requestIndex]
}