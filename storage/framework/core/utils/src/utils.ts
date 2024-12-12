import { resolve } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { kebabCase } from '@stacksjs/strings'

const ignore = ['readme-md']

export const components: string[] = fs
  .readdirSync(resolve(__dirname, './resources/components'))
  .map(item => kebabCase(item.replace(/\.(stx|vue)/g, '')))
  .filter(item => !ignore.includes(item))

export const functions: string[] = fs
  .readdirSync(resolve(__dirname, './resources/functions'))
  .map(item => kebabCase(item.replace(/.ts/g, '')))
  .filter(item => !ignore.includes(item))
