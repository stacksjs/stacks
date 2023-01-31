import { page as config } from '@stacksjs/config'
import fs from 'fs-extra'

const generatePages = () => {
  config.onboarding.pages.each((page: string) => {
    fs.appendFile(`${config.path}/${page}.vue`)
  })
}

export {
  generatePages
}