import type { EmailOptions } from '@stacksjs/types'

function content(): string {
  return 'example'
}

function send(): EmailOptions {
  return {
    content: content(),
  }
}
