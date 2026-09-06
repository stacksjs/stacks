import { describe, expect, it } from 'bun:test'
import { machineBindMailStorageCommand } from '../src/commands/mail'

describe('machine-bound mail storage recovery', () => {
  const command = machineBindMailStorageCommand()

  it('streams the raw key directly into systemd-creds', () => {
    expect(command).toContain('systemd-creds encrypt --name=mail-storage-key - "$credential_tmp"')
    expect(command).not.toContain('MAIL_STORAGE_KEY=')
    expect(command).not.toContain('--set-credential=')
  })

  it('installs atomically and verifies the credential before replacing the live one', () => {
    const verify = command.indexOf('systemd-creds decrypt')
    const replace = command.indexOf('mv "$credential_tmp"')

    expect(command).toContain('credential_tmp=$(mktemp /etc/credstore.encrypted/mail-storage-key.cred.XXXXXX)')
    expect(command).toContain('trap cleanup EXIT HUP INT TERM')
    expect(verify).toBeGreaterThan(-1)
    expect(replace).toBeGreaterThan(verify)
  })

  it('requires storage and mail to be active before reporting success', () => {
    expect(command).toContain('systemctl is-enabled --quiet mail-storage.service')
    expect(command).toContain('systemctl is-active --quiet mail-storage.service')
    expect(command).toContain('mountpoint -q /var/lib/mail-storage')
    expect(command).toContain('systemctl is-active --quiet mail.service')
  })
})
