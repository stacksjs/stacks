/**
 * Direct-upload composable (stacksjs/stacks#1856 Stage 6).
 *
 * Pairs with `Storage.disk('s3').presignedUploadUrl(...)` on the
 * server: the browser hits a small "presign" endpoint, gets a
 * presigned PUT URL back, and uploads bytes directly to S3 (or any
 * S3-compatible backend) without round-tripping through the app
 * server. The app server only sees the final `{ url, path }` once the
 * upload resolves — large file payloads never pass through it.
 *
 * @example
 * ```ts
 * // In a dashboard page's `<script client>`:
 * import { useDirectUpload } from '../../functions/uploads'
 *
 * const { upload, progress, error, isUploading, reset } = useDirectUpload({
 *   presignEndpoint: '/api/me/avatar/presign',
 * })
 *
 * async function onFileChange(e) {
 *   const file = e.target.files?.[0]
 *   if (!file) return
 *   const result = await upload(file)
 *   if (result) {
 *     // persist `result.path` against the user record via a normal
 *     // POST to your own action — this composable does NOT touch
 *     // your DB; it only handles the browser-to-S3 leg.
 *     await fetch('/api/me/avatar', {
 *       method: 'POST',
 *       body: JSON.stringify({ path: result.path }),
 *     })
 *   }
 * }
 * ```
 *
 * Why not use `fetch()`? `XMLHttpRequest` is still the only way to get
 * upload progress events in the browser. `fetch()`'s streams API
 * lacks an `upload.onprogress` equivalent across the major engines as
 * of this writing.
 */

import { state } from '@stacksjs/stx'
import { useAuth } from './auth'

export interface PresignResponse {
  /** The presigned URL the browser PUTs to. */
  url: string
  /** Storage path the file lands at (persist this alongside the user record). */
  path: string
  /** Stable storage key (mirrors `path` when no prefix is configured). */
  key?: string
  /** MIME type the URL was signed against. The PUT must match exactly. */
  contentType: string
  /** Advisory size cap. Not enforced by S3 on a presigned PUT — see server-side note. */
  maxBytes?: number
}

export interface DirectUploadResult {
  /** Storage path of the uploaded file. Persist this. */
  path: string
  /** Echoed back from the presign response for caller convenience. */
  key?: string
  /** Stored MIME type. */
  contentType: string
}

export interface UseDirectUploadOptions {
  /**
   * Endpoint that returns a {@link PresignResponse}. Called with
   * `POST { contentType, size, filename }` so the server can pick the
   * right disk + filename + maxBytes for the file.
   */
  presignEndpoint: string

  /**
   * Optional progress callback. Receives a percentage `0..100`.
   * Use this when you want side-effects beyond the `progress` signal
   * (e.g. analytics events).
   */
  onProgress?: (percent: number) => void

  /**
   * Optional bearer token override. Defaults to the value from
   * `useAuth().getToken()` so the presign endpoint sees the same auth
   * the rest of the dashboard uses.
   */
  authToken?: string
}

export interface UseDirectUploadHandle {
  /** Trigger the upload. Returns the storage path on success, `null` on failure. */
  upload: (file: File) => Promise<DirectUploadResult | null>
  /** Upload progress as a 0..100 percentage. */
  progress: () => number
  /** True while the upload is in-flight. */
  isUploading: () => boolean
  /** Last error message, or `null` if the most recent upload succeeded. */
  error: () => string | null
  /** Reset progress + error state to their initial values. */
  reset: () => void
}

export function useDirectUpload(options: UseDirectUploadOptions): UseDirectUploadHandle {
  const progress = state(0)
  const isUploading = state(false)
  const error = state<string | null>(null)

  function reset(): void {
    progress.set(0)
    isUploading.set(false)
    error.set(null)
  }

  async function presign(file: File): Promise<PresignResponse> {
    const token = options.authToken ?? useAuth().getToken()
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(options.presignEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        filename: file.name,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Presign endpoint returned ${res.status}: ${body || res.statusText}`)
    }
    return await res.json() as PresignResponse
  }

  /**
   * PUT the file straight to the storage backend. Uses XHR so we can
   * surface progress — `fetch()` lacks a portable upload-progress API.
   */
  function uploadDirect(file: File, presigned: PresignResponse): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presigned.url, true)
      xhr.setRequestHeader('Content-Type', presigned.contentType)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.floor((event.loaded / event.total) * 100)
          progress.set(percent)
          options.onProgress?.(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          progress.set(100)
          options.onProgress?.(100)
          resolve()
        }
        else {
          reject(new Error(`Direct upload failed: HTTP ${xhr.status} ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => reject(new Error('Direct upload failed: network error'))
      xhr.onabort = () => reject(new Error('Direct upload aborted'))

      xhr.send(file)
    })
  }

  async function upload(file: File): Promise<DirectUploadResult | null> {
    reset()
    isUploading.set(true)

    try {
      const presigned = await presign(file)

      // Advisory client-side size check. The server can't actually
      // enforce maxBytes on a simple presigned PUT (see the server-
      // side comment in `S3StorageAdapter.presignedUploadUrl`), so
      // this catches honest mistakes here rather than letting them
      // upload a 100MB file just to discover the policy later.
      if (presigned.maxBytes && file.size > presigned.maxBytes) {
        throw new Error(`File too large: ${file.size} bytes exceeds the ${presigned.maxBytes}-byte cap.`)
      }

      await uploadDirect(file, presigned)

      return {
        path: presigned.path,
        key: presigned.key,
        contentType: presigned.contentType,
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.set(message)
      return null
    }
    finally {
      isUploading.set(false)
    }
  }

  return {
    upload,
    progress: () => progress(),
    isUploading: () => isUploading(),
    error: () => error(),
    reset,
  }
}
