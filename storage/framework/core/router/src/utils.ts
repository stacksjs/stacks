import type { Ok } from '@stacksjs/error-handling'
import type { ModelRequest, RequestInstance } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { camelCase } from '@stacksjs/strings'
import { route } from './router'
import { path as p} from '@stacksjs/path'

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

export async function extractModelRequest(action: string): Promise<RequestInstance | null> {
  const extractedModel = extractModelFromAction(action)
  const lowerCaseModel = camelCase(extractedModel)
  const requestPath = path.frameworkPath(`requests/${extractedModel}Request.ts`)
  const requestInstance = await import(requestPath)
  const requestIndex = `${lowerCaseModel}Request`

  return requestInstance[requestIndex]
}

export async function findRequestInstance(requestInstance: string): Promise<ModelRequest> {
  const frameworkDirectory = path.storagePath('framework/requests')
  const filePath = path.join(frameworkDirectory, `${requestInstance}.ts`)

  const reqInstance = await import(filePath)

  return reqInstance[camelCase(requestInstance)]
}

export async function extractDefaultRequest(): Promise<RequestInstance> {
  const requestPath = path.frameworkPath(`core/router/src/request.ts`)
  const requestInstance = await import(requestPath)

  return requestInstance.request
}

export async function resolveHandler(handlerPath: string, request: RequestInstance): Promise<any> {
  // If it's an action (contains 'Action' in the path)
  if (handlerPath.includes('Action')) {
    const action = await import(p.projectPath(`app/${handlerPath}.ts`))
    return action.default.handle(request)
  }

  // If it's a controller (contains 'Controller' in the path)
  if (handlerPath.includes('Controller')) {
    const [controllerPath, methodName = 'index'] = handlerPath.split('@')
    const controller = await import(p.projectPath(`app/${controllerPath}.ts`))
    const instance = new controller.default()
    
    if (typeof instance[methodName] !== 'function')
      throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)
      
    return instance[methodName](request)
  }

  throw new Error('Invalid handler path. Must be either an Action or Controller')
}
