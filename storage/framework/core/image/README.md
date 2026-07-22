# @stacksjs/image

Native responsive image generation for Stacks, powered by `ts-images`.

## Generate responsive images

```ts
import { image } from '@stacksjs/image'

const manifest = await image('uploads/hero.jpg', {
  root: process.cwd(),
  outputDir: 'public/media/images',
  publicPath: '/media/images',
})
  .preset('hero')
  .formats(['avif', 'webp', 'jpeg'])
  .quality(82)
  .generate()
```

Presets cover `avatar`, `content`, `hero`, and `thumbnail`. Custom transforms can use `.widths()`, `.height()`, `.aspectRatio()`, `.fit()`, and `.position()`. Source-sized output is included where appropriate, and generation never upscales unless `upscale: true` is explicit.

## S3-compatible storage and CloudFront

Pass any structural storage adapter. The adapter can wrap Stacks storage, S3, R2, B2, or another S3-compatible provider.

```ts
const manifest = await image('uploads/avatar.png', {
  authorize: (_path, request) => request.user.can('view-media'),
  authorizationContext: request,
})
  .preset('avatar')
  .storage({
    fileExists: key => disk.exists(key),
    write: async (key, contents) => {
      await disk.put(key, contents)
      return { size: contents.byteLength }
    },
    stat: async key => ({ size: (await disk.stat(key)).size }),
    publicUrl: key => disk.url(key),
  })
  .generate()
```

The returned filenames are content-addressed and safe for an immutable CloudFront behavior. Use a short-lived signed transform for private originals:

```ts
import { signImageTransform, verifyImageTransform } from '@stacksjs/image'

const expires = Math.floor(Date.now() / 1000) + 300
const signature = signImageTransform('/private/hero.jpg?w=1280&format=avif', expires, secret)

if (!verifyImageTransform(requestPath, expires, signature, secret))
  throw new Response('Forbidden', { status: 403 })
```

## STX component and art direction

```stx
<Image
  src="{{ fallback.url }}"
  alt="A product on a workbench"
  width="{{ fallback.width }}"
  height="{{ fallback.height }}"
  :sources="[
    { media: '(min-width: 960px)', type: 'image/avif', srcset: desktopAvif },
    { media: '(max-width: 959px)', type: 'image/webp', srcset: mobileWebp },
  ]"
  sizes="(max-width: 959px) 100vw, 50vw"
  priority
/>
```

Use `decorative` instead of empty alt text for decorative images. The component renders responsive, layout-stable HTML without requiring client JavaScript.
