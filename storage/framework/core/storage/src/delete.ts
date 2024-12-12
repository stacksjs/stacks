import type { Result } from '@stacksjs/error-handling'
import { italic, log } from '@stacksjs/cli'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { join } from '@stacksjs/path'
import { isFolder } from './folders'
import { fs } from './fs'
import { glob } from './glob'

export function deleteFolder(path: string): Promise<Result<string, Error>> {
  return new Promise((resolve, reject) => {
    try {
      if (isFolder(path)) {
        fs.rmSync(path, { recursive: true, force: true })
        return resolve(ok(`Deleted ${path}`))
      }

      return resolve(ok(`Path ${path} was not a directory`))
    }
    catch (error) {
      return reject(err(error))
    }
  })
}

export async function isDirectoryEmpty(path: string): Promise<Result<boolean, Error>> {
  return new Promise((resolve, reject) => {
    try {
      if (fs.statSync(path).isDirectory()) {
        if (fs.readdirSync(path).length === 0)
          return resolve(ok(true))
        return resolve(ok(false))
      }

      return resolve(ok(false))
    }
    catch (error) {
      return reject(err(error))
    }
  })
}

export async function deleteEmptyFolder(path: string): Promise<Result<string, Error>> {
  return new Promise((resolve, reject) => {
    try {
      if (fs.statSync(path).isDirectory()) {
        if (fs.readdirSync(path).length === 0) {
          fs.rmSync(path, { recursive: true, force: true })
          return resolve(ok(`Deleted ${path}`))
        }

        return resolve(ok(`Path ${path} was not empty`))
      }

      return resolve(ok(`Path ${path} was not a directory`))
    }
    catch (error) {
      return reject(err(error))
    }
  })
}

export async function deleteEmptyFolders(dir: string): Promise<Result<string, Error>> {
  try {
    if (!fs.existsSync(dir))
      return ok(`Path ${dir} does not exist`)

    const files = fs.readdirSync(dir)
    for (const file of files) {
      const p = join(dir, file)
      if (isFolder(p)) {
        if (fs.readdirSync(p).length === 0)
          fs.rmSync(p, { recursive: true, force: true })
        else await deleteEmptyFolders(p)
      }
    }

    return ok(`Deleted empty folders located in ${dir}`)
  }
  catch (error: any) {
    return err(error)
  }
}

export function deleteFile(path: string): Promise<Result<string, Error>> {
  return new Promise((resolve, reject) => {
    try {
      if (fs.statSync(path).isFile()) {
        fs.rmSync(path, { recursive: true, force: true })
        return resolve(ok(`Deleted ${path}`))
      }

      return resolve(ok(`Path ${path} was not a file`))
    }
    catch (error) {
      return reject(err(error))
    }
  })
}

export async function deleteGlob(path: string): Promise<Result<string, Error>> {
  if (!path.includes('*'))
    return err(handleError(`Path ${path} does not contain a glob`))

  const directories = await glob([path], { onlyDirectories: true })

  for (const directory of directories) {
    const result = await deleteFolder(directory)
    if (result.isErr()) {
      log.error(result.error)
      return result
    }

    log.info(`Deleted ${italic(directory)}`)
  }

  return ok(`Deleted ${directories.length} directories`)
}

export async function del(path: string): Promise<Result<string, Error>> {
  if (fs.existsSync(path) && fs.statSync(path).isFile())
    return await deleteFile(path)

  if (isFolder(path))
    return await deleteFolder(path)

  if (path.includes('*'))
    return await deleteGlob(path)

  return err(handleError(`Path ${path} cannot be deleted due to an unhandled condition. Please report this issue.`))
}
