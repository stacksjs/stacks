import mkcert from 'vite-plugin-mkcert'
import type { Plugin } from 'vite'
import { path as p } from '@stacksjs/path'
import library from '~/config/library'

export function sslCertificate(): Plugin {
  console.log('sslCertificate')

  return mkcert({
    hosts: ['localhost', 'stacks.test', 'api.stacks.test', 'admin.stacks.test', 'libs.stacks.test', 'docs.stacks.test'],
    autoUpgrade: true,
    savePath: p.frameworkPath('certs/components'),
    keyFileName: library.name ? `library-${library.name}-key.pem` : 'library-key.pem',
    certFileName: library.name ? `library-${library.name}-cert.pem` : 'library-cert.pem',
  }) as Plugin
}
