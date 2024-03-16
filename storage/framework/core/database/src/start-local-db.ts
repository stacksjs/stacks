import * as os from 'node:os'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import process from 'node:process'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as zlib from 'node:zlib'
import * as path from 'node:path'
import { promisify } from 'node:util'
import * as tar from 'tar'
import Debug from 'debug'

const debug = Debug('dynamodb-local')
const JARNAME = 'DynamoDBLocal.jar'

interface Config {
  installPath: string
  downloadUrl: string
}

const defaultConfig: Config = {
  installPath: path.join(os.tmpdir(), 'dynamodb-local'),
  downloadUrl: 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz',
}

const runningProcesses: { [port: number]: ChildProcess } = {}

export class DynamoDbLocal {
  static launch(port: number, dbPath?: string, additionalArgs: string[] = [], verbose = false, detached?: boolean, javaOpts = ''): Promise<ChildProcess> {
    if (runningProcesses[port])
      return Promise.resolve(runningProcesses[port])

    if (dbPath)
      additionalArgs.push('-dbPath', dbPath)
    else
      additionalArgs.push('-inMemory')

    return this.installDynamoDbLocal()
      .then(() => {
        let args = ['-Xrs', '-Djava.library.path=./DynamoDBLocal_lib', javaOpts, '-jar', JARNAME, '-port', port.toString()].filter(arg => !!arg)
        args = args.concat(additionalArgs)

        const child = spawn('java', args, {
          cwd: defaultConfig.installPath,
          env: process.env,
          stdio: ['ignore', 'ignore', 'inherit'],
        })

        if (!child.pid)
          throw new Error('Unable to launch DynamoDBLocal process')

        child.on('error', (err) => {
          if (verbose)
            debug('local DynamoDB start error', err)

          throw new Error('Local DynamoDB failed to start.')
        }).on('close', (code) => {
          if (code !== null && code !== 0 && verbose)
            debug('Local DynamoDB failed to close with code', code)
        })

        if (!detached) {
          process.on('exit', () => {
            child.kill()
          })
        }

        runningProcesses[port] = child

        if (verbose)
          debug(`DynamoDbLocal(${child.pid}) started on port ${port} via java ${args.join(' ')} from CWD ${defaultConfig.installPath}`)

        return child
      })
  }

  static stop(port: number): void {
    const process = runningProcesses[port]
    if (process) {
      process.kill('SIGKILL')
      delete runningProcesses[port]
    }
  }

  static stopChild(child: ChildProcess): void {
    if (child.pid) {
      debug('Stopped the child')
      child.kill()
    }
  }

  static relaunch(port: number, ...args: string[]): void {
    this.stop(port)
    this.launch(port, ...args)
  }

  static configureInstaller(conf: Partial<Config>): void {
    if (conf.installPath)
      defaultConfig.installPath = conf.installPath

    if (conf.downloadUrl)
      defaultConfig.downloadUrl = conf.downloadUrl
  }

  private static installDynamoDbLocal(): Promise<void> {
    debug('Checking for DynamoDB-Local in ', defaultConfig.installPath)
    const access = promisify(fs.access)
    const mkdir = promisify(fs.mkdir)

    return new Promise(async (resolve, reject) => {
      try {
        if (await exists(path.join(defaultConfig.installPath, JARNAME))) {
          resolve()
          return
        }

        debug('DynamoDB Local not installed. Installing...')

        if (!(await exists(defaultConfig.installPath)))
          await mkdir(defaultConfig.installPath)

        const fileStream = fs.createWriteStream(path.join(defaultConfig.installPath, JARNAME))

        https.get(defaultConfig.downloadUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Error getting DynamoDb local latest tar.gz location ${response.headers.location}: ${response.statusCode}`))
            return
          }
          response.pipe(zlib.createUnzip()).pipe(tar.extract({ cwd: defaultConfig.installPath }))
            .on('finish', resolve)
            .on('error', reject)
        }).on('error', reject)
      }
      catch (error) {
        reject(error)
      }
    })
  }
}
