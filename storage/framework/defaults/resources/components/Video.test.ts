import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const video = readFileSync(join(import.meta.dir, 'Video.stx'), 'utf8')

describe('Video', () => {
  it('follows a reactive src and poster, so one player can show whichever video is chosen', () => {
    expect(video).toContain(`useReactiveProp<string>('src', '')`)
    expect(video).toContain(`:src="liveSrc() || null"`)
    expect(video).toContain(`:poster="livePoster() || null"`)
  })

  it('renders no src attribute without a video, which would fetch the page itself', () => {
    // An empty src resolves to the document's URL: the browser downloads the
    // whole page as the video and fails, every time a player with nothing
    // chosen yet renders.
    expect(video).not.toMatch(/(?<!@if\(src\) )src="\{\{ src \}\}"/)
    expect(video.match(/@if\(src\) src="\{\{ src \}\}" @endif/g)?.length).toBe(2)
  })

  it('pauses when its src is cleared, as closing a sheet does', () => {
    expect(video).toContain(`useRef('player')`)
    expect(video).toContain('ref="player"')
    expect(video).toMatch(/if \(!liveSrc\(\)\)[\s\S]*?\.pause\(\)/)
  })

  it('never hands a YouTube or Vimeo page to the native <video> fallback', () => {
    const isEmbed = new RegExp(video.match(/const isEmbed = \/(.+)\/i\.test/)![1]!, 'i')
    for (const url of ['https://www.youtube.com/watch?v=aclHkVaku9U', 'https://youtu.be/aclHkVaku9U', 'https://m.youtube.com/shorts/aclHkVaku9U', 'https://vimeo.com/76979871'])
      expect(isEmbed.test(url)).toBe(true)
    for (const url of ['https://cdn.example.com/clip.mp4', '/media/demo/manifest.mpd', 'https://example.com/youtube.com/fake.mp4'])
      expect(isEmbed.test(url)).toBe(false)
    expect(video).toContain('@if(isEmbed)')
  })
})
