import { readFileSync, writeFileSync } from 'node:fs'
import { Action } from '@stacksjs/actions'
import { projectPath } from '@stacksjs/path'

export default new Action({
  name: 'UpdateServicesConfig',
  description: 'Updates the services configuration.',
  method: 'POST',
  apiResponse: true,

  async handle(request) {
    try {
      const updates = request.all()
      const filePath = projectPath('config/services.ts')
      let content = readFileSync(filePath, 'utf-8')

      for (const [key, value] of Object.entries(updates)) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(
          `(${escapedKey}\\s*:\\s*)(?:'[^']*'|"[^"]*"|\\d+(?:\\.\\d+)?|true|false)`,
        )

        if (pattern.test(content)) {
          const isNum = /^\d+(?:\.\d+)?$/.test(String(value))
          const isBool = value === true || value === false || value === 'true' || value === 'false'
          const replacement = isNum || isBool ? String(value) : `'${String(value).replace(/'/g, "\\'")}'`
          content = content.replace(pattern, `$1${replacement}`)
        }
      }

      writeFileSync(filePath, content, 'utf-8')
      return { success: true, message: 'Services configuration updated.' }
    }
    catch (e: any) {
      return { success: false, error: e.message }
    }
  },
})
