import { describe, expect, it } from 'bun:test'
import {
  acceptAttachment,
  acceptAttachmentSize,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  FEEDBACK_ATTACHMENT_TYPES,
  feedbackAttachmentPath,
  sniffImageType,
  SNIFF_BYTES,
} from './feedback-attachment'

/**
 * The attachment rules, which are the whole security boundary of an
 * unauthenticated upload.
 *
 * Every one of these is reachable only by POSTing a crafted file to a live
 * feedback link, so left in the action they would be rules nobody ever
 * checked (stacksjs/stacks#2872).
 */

/** Leading bytes of a real file of each type, padded to the sniff window. */
const HEADS: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D],
  jpeg: [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01],
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00],
}

const head = (name: keyof typeof HEADS) => new Uint8Array(HEADS[name])
const bytes = (text: string) => new TextEncoder().encode(text.padEnd(SNIFF_BYTES, ' '))

describe('sniffImageType', () => {
  it('reads each accepted format from its own leading bytes', () => {
    expect(sniffImageType(head('png'))).toBe('image/png')
    expect(sniffImageType(head('jpeg'))).toBe('image/jpeg')
    expect(sniffImageType(head('webp'))).toBe('image/webp')
    expect(sniffImageType(head('gif'))).toBe('image/gif')
  })

  it('reads GIF87a as well as GIF89a', () => {
    const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0])
    expect(sniffImageType(gif87)).toBe('image/gif')
  })

  it('refuses a RIFF container that is not WebP', () => {
    // A WAV file is RIFF too. Checking only the first four bytes would store
    // audio as an image.
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
    expect(sniffImageType(wav)).toBeNull()
  })

  it('refuses SVG, however it is dressed up', () => {
    // SVG is XML and can carry script. It would be uploaded by an
    // unauthenticated stranger and opened by a signed-in operator, which is a
    // stored XSS rather than a screenshot. This must never start passing.
    expect(sniffImageType(bytes('<svg xmlns='))).toBeNull()
    expect(sniffImageType(bytes('<?xml versio'))).toBeNull()
    expect(sniffImageType(bytes('﻿<svg>'))).toBeNull()
  })

  it('refuses the things people try to pass off as images', () => {
    for (const probe of ['<!DOCTYPE htm', '<html><body>', 'PK\u0003\u0004zip', '%PDF-1.7', '#!/bin/sh', 'GIF', ''])
      expect(sniffImageType(bytes(probe))).toBeNull()
  })

  it('refuses a file too short to identify rather than reading past its end', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull()
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})

describe('acceptAttachmentSize', () => {
  it('is the gate that passes before a byte is read', () => {
    // The router hands an action an `UploadedFile` wrapper, which reports
    // `size` synchronously and has NO `slice` - reading the leading bytes
    // means reading the whole file. The first version of the action sniffed
    // first and threw `screenshot.slice is not a function` on every upload,
    // which only a real multipart POST found: every unit test here passes a
    // plain Uint8Array, and so did the one the action was written against.
    expect(acceptAttachmentSize(120_000)).toEqual({ ok: true })
    expect(acceptAttachmentSize(FEEDBACK_ATTACHMENT_MAX_BYTES)).toEqual({ ok: true })
  })

  it('refuses an empty or absurd size', () => {
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(acceptAttachmentSize(size)).toMatchObject({ ok: false, reason: 'empty' })
  })

  it('refuses one byte over the cap', () => {
    expect(acceptAttachmentSize(FEEDBACK_ATTACHMENT_MAX_BYTES + 1))
      .toMatchObject({ ok: false, reason: 'too-large' })
  })

  it('agrees with acceptAttachment, so the order of refusals is the same either way', () => {
    for (const size of [0, 1, FEEDBACK_ATTACHMENT_MAX_BYTES, FEEDBACK_ATTACHMENT_MAX_BYTES + 1]) {
      const gate = acceptAttachmentSize(size)
      const full = acceptAttachment({ size, head: head('png') })
      expect(full.ok).toBe(gate.ok)
      if (!gate.ok && !full.ok)
        expect(full.reason).toBe(gate.reason)
    }
  })
})

describe('acceptAttachment', () => {
  it('accepts a real screenshot and names what to store it as', () => {
    expect(acceptAttachment({ size: 120_000, head: head('png') }))
      .toEqual({ ok: true, type: 'image/png', extension: 'png' })
    // JPEG stores as `jpg`, which is the extension and not the type name.
    expect(acceptAttachment({ size: 1, head: head('jpeg') }))
      .toEqual({ ok: true, type: 'image/jpeg', extension: 'jpg' })
  })

  it('refuses an empty file', () => {
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const verdict = acceptAttachment({ size, head: head('png') })
      expect(verdict).toMatchObject({ ok: false, reason: 'empty' })
    }
  })

  it('refuses one byte over the cap, and accepts the cap itself', () => {
    expect(acceptAttachment({ size: FEEDBACK_ATTACHMENT_MAX_BYTES, head: head('png') }).ok).toBe(true)
    const over = acceptAttachment({ size: FEEDBACK_ATTACHMENT_MAX_BYTES + 1, head: head('png') })
    expect(over).toMatchObject({ ok: false, reason: 'too-large' })
    expect((over as { message: string }).message).toContain('5 MB')
  })

  it('checks the size before the bytes, so an enormous upload costs nothing to refuse', () => {
    // Head deliberately empty: a verdict of `too-large` rather than
    // `unsupported` is what says the size was decided first.
    expect(acceptAttachment({ size: 2 ** 31, head: new Uint8Array() }))
      .toMatchObject({ ok: false, reason: 'too-large' })
  })

  it('refuses a file whose bytes are not an accepted image', () => {
    const verdict = acceptAttachment({ size: 400, head: bytes('%PDF-1.7') })
    expect(verdict).toMatchObject({ ok: false, reason: 'unsupported' })
    // Says which rule was hit. "Could not attach that" leaves a reviewer
    // guessing between the size and the format.
    expect((verdict as { message: string }).message).toContain('PNG')
  })

  it('tells a reviewer which rule they hit, in words', () => {
    for (const probe of [
      { size: 0, head: head('png') },
      { size: FEEDBACK_ATTACHMENT_MAX_BYTES * 2, head: head('png') },
      { size: 10, head: bytes('nope') },
    ]) {
      const verdict = acceptAttachment(probe)
      expect(verdict.ok).toBe(false)
      expect((verdict as { message: string }).message.length).toBeGreaterThan(10)
      // User-visible copy: no em-dashes, per the project's own rule.
      expect((verdict as { message: string }).message).not.toMatch(/[–—]/)
    }
  })
})

describe('feedbackAttachmentPath', () => {
  const id = '0190f3b4-7c21-4f0a-9a1e-3d5c7b8e9f00'

  it('writes under a fixed prefix, keyed by card', () => {
    expect(feedbackAttachmentPath(42, id, 'png')).toBe(`feedback/42/${id}.png`)
  })

  it('lower-cases the generated id so one file has one path', () => {
    expect(feedbackAttachmentPath(42, id.toUpperCase(), 'png')).toBe(`feedback/42/${id}.png`)
  })

  it('refuses an id that is not one it generated', () => {
    // The submitter contributes no segment of the path, so anything shaped
    // like traversal or an absolute path is a bug upstream rather than input
    // to sanitise.
    for (const bad of ['../../etc/passwd', 'a/b', '/abs', '', 'short', 'id with spaces', 'x'.repeat(65)])
      expect(() => feedbackAttachmentPath(42, bad, 'png')).toThrow('Refusing to build')
  })

  it('refuses an extension it did not choose', () => {
    for (const bad of ['', 'svg+xml', '../', 'PNG', 'phtml'])
      expect(() => feedbackAttachmentPath(42, id, bad)).toThrow('Refusing to build')
  })

  it('refuses to build a path without a card', () => {
    for (const bad of [0, -1, 1.5, Number.NaN])
      expect(() => feedbackAttachmentPath(bad, id, 'png')).toThrow('needs the id of the card')
  })

  it('builds a path for every extension it may be handed', () => {
    for (const extension of Object.values(FEEDBACK_ATTACHMENT_TYPES))
      expect(feedbackAttachmentPath(1, id, extension)).toBe(`feedback/1/${id}.${extension}`)
  })
})
