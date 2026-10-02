/**
 * The extension entry VS Code loads (`main` in package.json, bundled to
 * dist/extension.js). It only wires the real machine into the controller in
 * ./stacks.ts; the behavior lives there and in ./project.ts.
 */
import type { Host } from './stacks'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import * as vscode from 'vscode'
import { createStacksExtension } from './stacks'

const PROBE_TIMEOUT_MS = 500

const host: Host = {
  exists: path => existsSync(path),

  read(path) {
    try {
      return readFileSync(path, 'utf8')
    }
    catch {
      return undefined
    }
  },

  exec(file, args, cwd) {
    return new Promise((resolve, reject) => {
      execFile(file, args, {
        cwd,
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      }, (error, stdout) => error ? reject(error) : resolve(String(stdout)))
    })
  },

  probe(hostname, port) {
    return new Promise((resolve) => {
      const socket = connect({ host: hostname, port })
      const finish = (open: boolean) => {
        socket.destroy()
        resolve(open)
      }

      socket.setTimeout(PROBE_TIMEOUT_MS)
      socket.once('connect', () => finish(true))
      socket.once('timeout', () => finish(false))
      socket.once('error', () => finish(false))
    })
  },

  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
}

const extension = createStacksExtension(vscode, host)

export const activate = extension.activate
export const deactivate = extension.deactivate
