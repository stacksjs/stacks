import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * config/services.ts declares Slack, Discord and Teams settings from
 * SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL, TEAMS_WEBHOOK_URL and friends, and
 * the drivers read none of them: every chat notification failed as "not
 * configured" unless the app also called `configure()` itself. The chat half
 * of stacksjs/stacks#2857.
 */
const SLACK = 'https://hooks.slack.com/services/T000/B000/xyz'
const DISCORD = 'https://discord.com/api/webhooks/1/abc'
const TEAMS = 'https://acme.webhook.office.com/webhookb2/abc'

async function run(env: Record<string, string>): Promise<Record<string, any>> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-chat-config-'))
  try {
    await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/chat-from-config.ts`], {
      cwd: join(import.meta.dir, '../../../../..'),
      env: { ...process.env, APP_ENV: 'test', SLACK_WEBHOOK_URL: '', SLACK_BOT_TOKEN: '', DISCORD_WEBHOOK_URL: '', DISCORD_BOT_TOKEN: '', TEAMS_WEBHOOK_URL: '', ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    if (code !== 0 || !line)
      throw new Error(`fixture exited ${code}\n${stdout}\n${stderr}`)
    return JSON.parse(line)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('chat settings from config/services.ts', () => {
  it('sends through each webhook the environment names', async () => {
    const out = await run({ SLACK_WEBHOOK_URL: SLACK, DISCORD_WEBHOOK_URL: DISCORD, TEAMS_WEBHOOK_URL: TEAMS })

    expect(out.slack.success).toBe(true)
    expect(out.discord.success).toBe(true)
    expect(out.teams.success).toBe(true)
    expect(out.requests.map((request: any) => request.url)).toEqual([SLACK, DISCORD, TEAMS])
  }, 60_000)

  it('uses a Slack bot token when that is what is configured', async () => {
    const out = await run({ SLACK_BOT_TOKEN: 'xoxb-1' })

    const slack = out.requests.find((request: any) => request.url === 'https://slack.com/api/chat.postMessage')
    expect(slack.headers.Authorization).toBe('Bearer xoxb-1')
    expect(out.slack.success).toBe(true)
  }, 60_000)

  it('still refuses a webhook from config that would leak its token', async () => {
    const out = await run({ SLACK_WEBHOOK_URL: 'http://hooks.slack.com/services/T000/B000/xyz' })

    expect(out.slack.success).toBe(false)
    expect(out.requests.filter((request: any) => request.url.includes('slack'))).toEqual([])
  }, 60_000)

  it('takes the retry count from config', async () => {
    const out = await run({ SLACK_WEBHOOK_URL: SLACK, SLACK_MAX_RETRIES: '1', FIXTURE_FAILURES: '1' })

    // SLACK_MAX_RETRIES=1 is one attempt in total: it fails, and is not repeated.
    expect(out.slack.success).toBe(false)
    expect(out.requests.filter((request: any) => request.url === SLACK)).toHaveLength(1)
  }, 60_000)
})
