import { page as config } from '@stacksjs/config'
import fs from 'fs-extra'

const generatePages = () => {
  config.settings.pages.each((page: string) => {
    fs.appendFile(`${config.path}/${page}/index.ts`)
  })
}

export {
  generatePages
}