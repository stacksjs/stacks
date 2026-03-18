import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildDashboardUrl,
  buildManifest,
  buildSidebarConfig,
  dedicatedPages,
  discoverModels,
  excludeModels,
  getModelIcon,
  iconMap,
  modelNameToId,
  scanModelsDir,
  waitForServer,
} from '../src/dev/dashboard-utils'

// Temp directory for model file tests
const testDir = join(tmpdir(), `dashboard-test-${Date.now()}`)

afterEach(() => {
  try {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
  }
  catch {}
})

describe('dashboard-utils', () => {
  describe('modelNameToId', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(modelNameToId('User')).toBe('user')
      expect(modelNameToId('PaymentMethod')).toBe('payment-method')
      expect(modelNameToId('OrderItem')).toBe('order-item')
    })

    it('should handle single-word names', () => {
      expect(modelNameToId('Post')).toBe('post')
      expect(modelNameToId('Tag')).toBe('tag')
    })

    it('should handle multi-word PascalCase', () => {
      expect(modelNameToId('WaitlistRestaurant')).toBe('waitlist-restaurant')
      expect(modelNameToId('DigitalDelivery')).toBe('digital-delivery')
      expect(modelNameToId('LoyaltyPoint')).toBe('loyalty-point')
    })

    it('should handle already lowercase names', () => {
      expect(modelNameToId('user')).toBe('user')
    })

    it('should not start with a dash', () => {
      const result = modelNameToId('User')
      expect(result.startsWith('-')).toBe(false)
    })
  })

  describe('getModelIcon', () => {
    it('should return correct icon for known models', () => {
      expect(getModelIcon('User')).toBe('person.fill')
      expect(getModelIcon('team')).toBe('person.2.fill')
      expect(getModelIcon('Post')).toBe('doc.text.fill')
      expect(getModelIcon('Payment')).toBe('creditcard.fill')
    })

    it('should be case-insensitive', () => {
      expect(getModelIcon('USER')).toBe('person.fill')
      expect(getModelIcon('user')).toBe('person.fill')
      expect(getModelIcon('User')).toBe('person.fill')
    })

    it('should return default icon for unknown models', () => {
      expect(getModelIcon('UnknownModel')).toBe('tablecells.fill')
      expect(getModelIcon('CustomThing')).toBe('tablecells.fill')
    })
  })

  describe('iconMap', () => {
    it('should have a default icon', () => {
      expect(iconMap.default).toBe('tablecells.fill')
    })

    it('should have icons for common models', () => {
      expect(iconMap.user).toBeDefined()
      expect(iconMap.team).toBeDefined()
      expect(iconMap.post).toBeDefined()
      expect(iconMap.product).toBeDefined()
      expect(iconMap.order).toBeDefined()
      expect(iconMap.customer).toBeDefined()
    })

    it('should have icons for all commerce models', () => {
      expect(iconMap.payment).toBeDefined()
      expect(iconMap.coupon).toBeDefined()
      expect(iconMap.giftcard).toBeDefined()
      expect(iconMap.cart).toBeDefined()
      expect(iconMap.taxrate).toBeDefined()
    })
  })

  describe('excludeModels', () => {
    it('should exclude system models', () => {
      expect(excludeModels.has('activity')).toBe(true)
      expect(excludeModels.has('request')).toBe(true)
      expect(excludeModels.has('error')).toBe(true)
      expect(excludeModels.has('failedjob')).toBe(true)
    })

    it('should not exclude user-facing models', () => {
      expect(excludeModels.has('user')).toBe(false)
      expect(excludeModels.has('post')).toBe(false)
      expect(excludeModels.has('product')).toBe(false)
    })
  })

  describe('dedicatedPages', () => {
    it('should include core data models', () => {
      expect(dedicatedPages.has('user')).toBe(true)
      expect(dedicatedPages.has('team')).toBe(true)
      expect(dedicatedPages.has('post')).toBe(true)
      expect(dedicatedPages.has('product')).toBe(true)
    })

    it('should include commerce models', () => {
      expect(dedicatedPages.has('order')).toBe(true)
      expect(dedicatedPages.has('customer')).toBe(true)
      expect(dedicatedPages.has('payment')).toBe(true)
      expect(dedicatedPages.has('coupon')).toBe(true)
    })

    it('should not include models without dedicated pages', () => {
      expect(dedicatedPages.has('cart')).toBe(false)
      expect(dedicatedPages.has('websocket')).toBe(false)
    })
  })

  describe('scanModelsDir', () => {
    it('should discover TypeScript model files', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'User.ts'), 'export default {}')
      writeFileSync(join(testDir, 'Post.ts'), 'export default {}')

      const models: Array<{ name: string, icon: string, id: string }> = []
      const seen = new Set<string>()
      await scanModelsDir(testDir, seen, models)

      expect(models.length).toBe(2)
      expect(seen.has('user')).toBe(true)
      expect(seen.has('post')).toBe(true)
    })

    it('should skip .d.ts and README files', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'User.ts'), 'export default {}')
      writeFileSync(join(testDir, 'User.d.ts'), 'declare {}')
      writeFileSync(join(testDir, 'README.ts'), '')

      const models: Array<{ name: string, icon: string, id: string }> = []
      await scanModelsDir(testDir, new Set(), models)

      expect(models.length).toBe(1)
      expect(models[0].name).toBe('User')
    })

    it('should skip excluded models', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'User.ts'), 'export default {}')
      writeFileSync(join(testDir, 'Activity.ts'), 'export default {}')
      writeFileSync(join(testDir, 'Error.ts'), 'export default {}')

      const models: Array<{ name: string, icon: string, id: string }> = []
      await scanModelsDir(testDir, new Set(), models)

      expect(models.length).toBe(1)
      expect(models[0].name).toBe('User')
    })

    it('should deduplicate by lowercase name', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'User.ts'), 'export default {}')

      const models: Array<{ name: string, icon: string, id: string }> = []
      const seen = new Set<string>(['user']) // Already seen
      await scanModelsDir(testDir, seen, models)

      expect(models.length).toBe(0)
    })

    it('should handle non-existent directories gracefully', async () => {
      const models: Array<{ name: string, icon: string, id: string }> = []
      await scanModelsDir('/non/existent/path', new Set(), models)

      expect(models.length).toBe(0)
    })

    it('should scan subdirectories', async () => {
      const subDir = join(testDir, 'Commerce')
      mkdirSync(subDir, { recursive: true })
      writeFileSync(join(subDir, 'Product.ts'), 'export default {}')

      const models: Array<{ name: string, icon: string, id: string }> = []
      await scanModelsDir(testDir, new Set(), models)

      expect(models.length).toBe(1)
      expect(models[0].name).toBe('Product')
      expect(models[0].icon).toBe('cube.box.fill')
      expect(models[0].id).toBe('product')
    })

    it('should assign correct icons and IDs', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'PaymentMethod.ts'), 'export default {}')

      const models: Array<{ name: string, icon: string, id: string }> = []
      await scanModelsDir(testDir, new Set(), models)

      expect(models[0].name).toBe('PaymentMethod')
      expect(models[0].icon).toBe('creditcard.and.123')
      expect(models[0].id).toBe('payment-method')
    })
  })

  describe('discoverModels', () => {
    it('should return sorted models from both directories', async () => {
      const dir1 = join(testDir, 'user')
      const dir2 = join(testDir, 'default')
      mkdirSync(dir1, { recursive: true })
      mkdirSync(dir2, { recursive: true })
      writeFileSync(join(dir1, 'Zebra.ts'), 'export default {}')
      writeFileSync(join(dir2, 'Apple.ts'), 'export default {}')

      const models = await discoverModels(dir1, dir2)

      expect(models.length).toBe(2)
      expect(models[0].name).toBe('Apple')
      expect(models[1].name).toBe('Zebra')
    })

    it('should deduplicate across directories', async () => {
      const dir1 = join(testDir, 'user')
      const dir2 = join(testDir, 'default')
      mkdirSync(dir1, { recursive: true })
      mkdirSync(dir2, { recursive: true })
      writeFileSync(join(dir1, 'User.ts'), 'export default {}')
      writeFileSync(join(dir2, 'User.ts'), 'export default {}')

      const models = await discoverModels(dir1, dir2)

      expect(models.length).toBe(1)
    })

    it('should handle empty directories', async () => {
      const dir1 = join(testDir, 'empty1')
      const dir2 = join(testDir, 'empty2')
      mkdirSync(dir1, { recursive: true })
      mkdirSync(dir2, { recursive: true })

      const models = await discoverModels(dir1, dir2)

      expect(models.length).toBe(0)
    })

    it('should handle non-existent directories', async () => {
      const models = await discoverModels('/no/such/path/a', '/no/such/path/b')
      expect(models.length).toBe(0)
    })
  })

  describe('buildManifest', () => {
    it('should mark models with dedicated pages', () => {
      const models = [
        { name: 'User', icon: 'person.fill', id: 'user' },
        { name: 'CustomWidget', icon: 'tablecells.fill', id: 'custom-widget' },
      ]

      const manifest = buildManifest(models)

      expect(manifest[0].hasDedicatedPage).toBe(true)
      expect(manifest[1].hasDedicatedPage).toBe(false)
    })

    it('should preserve model fields', () => {
      const models = [{ name: 'Post', icon: 'doc.text.fill', id: 'post' }]
      const manifest = buildManifest(models)

      expect(manifest[0].id).toBe('post')
      expect(manifest[0].name).toBe('Post')
      expect(manifest[0].icon).toBe('doc.text.fill')
    })

    it('should handle empty input', () => {
      expect(buildManifest([])).toEqual([])
    })
  })

  describe('buildSidebarConfig', () => {
    it('should have all 10 sections', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])
      expect(config.sections.length).toBe(10)
    })

    it('should have correct section IDs', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])
      const sectionIds = config.sections.map(s => s.id)

      expect(sectionIds).toContain('home')
      expect(sectionIds).toContain('library')
      expect(sectionIds).toContain('content')
      expect(sectionIds).toContain('app')
      expect(sectionIds).toContain('data')
      expect(sectionIds).toContain('commerce')
      expect(sectionIds).toContain('marketing')
      expect(sectionIds).toContain('analytics')
      expect(sectionIds).toContain('management')
      expect(sectionIds).toContain('utilities')
    })

    it('should use baseRoute for all URLs', () => {
      const base = 'http://localhost:9999/pages'
      const config = buildSidebarConfig(base, [])

      for (const section of config.sections) {
        for (const item of section.items) {
          expect(item.url).toContain(base)
        }
      }
    })

    it('should include discovered models in data section', () => {
      const models = [
        { name: 'Widget', icon: 'tablecells.fill', id: 'widget' },
        { name: 'Gadget', icon: 'tablecells.fill', id: 'gadget' },
      ]
      const config = buildSidebarConfig('http://localhost:3456/pages', models)
      const dataSection = config.sections.find(s => s.id === 'data')!

      const modelItems = dataSection.items.filter(i => i.id.startsWith('model-'))
      expect(modelItems.length).toBe(2)
      expect(modelItems[0].id).toBe('model-widget')
      expect(modelItems[0].label).toBe('Widget')
      expect(modelItems[0].url).toBe('http://localhost:3456/pages/data/widget')
      expect(modelItems[1].id).toBe('model-gadget')
    })

    it('should include static data items before models', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])
      const dataSection = config.sections.find(s => s.id === 'data')!

      expect(dataSection.items[0].id).toBe('data-dashboard')
      expect(dataSection.items[1].id).toBe('activity')
    })

    it('should set min/max width', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])
      expect(config.minWidth).toBe(200)
      expect(config.maxWidth).toBe(280)
    })

    it('should have home dashboard as first item', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])
      const homeSection = config.sections.find(s => s.id === 'home')!

      expect(homeSection.items[0].id).toBe('home')
      expect(homeSection.items[0].icon).toBe('house.fill')
    })

    it('should have correct items in each section', () => {
      const config = buildSidebarConfig('http://localhost:3456/pages', [])

      const library = config.sections.find(s => s.id === 'library')!
      expect(library.items.length).toBe(3)

      const commerce = config.sections.find(s => s.id === 'commerce')!
      expect(commerce.items.length).toBe(9)

      const utilities = config.sections.find(s => s.id === 'utilities')!
      expect(utilities.items.length).toBe(4)
    })
  })

  describe('buildDashboardUrl', () => {
    it('should include native-sidebar parameter', () => {
      const url = buildDashboardUrl(3456)
      expect(url).toBe('http://localhost:3456/app?native-sidebar=1')
    })

    it('should use the specified port', () => {
      const url = buildDashboardUrl(8080)
      expect(url).toContain(':8080/')
    })

    it('should always include /app path', () => {
      const url = buildDashboardUrl(3456)
      expect(url).toContain('/app?')
    })
  })

  describe('waitForServer', () => {
    it('should return false when server is not running', async () => {
      // Use a port that's unlikely to be in use
      const result = await waitForServer(59999, 100)
      expect(result).toBe(false)
    })

    it('should return true when server is running', async () => {
      // Start a simple Bun server
      const server = Bun.serve({
        port: 0, // Random available port
        fetch() {
          return new Response('ok')
        },
      })

      try {
        const result = await waitForServer(server.port, 1000)
        expect(result).toBe(true)
      }
      finally {
        server.stop()
      }
    })

    it('should accept 404 as ready', async () => {
      const server = Bun.serve({
        port: 0,
        fetch() {
          return new Response('not found', { status: 404 })
        },
      })

      try {
        const result = await waitForServer(server.port, 1000)
        expect(result).toBe(true)
      }
      finally {
        server.stop()
      }
    })

    it('should respect maxWait timeout', async () => {
      const start = Date.now()
      await waitForServer(59998, 150)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(500)
    })
  })
})
