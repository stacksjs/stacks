# Browser Tests

Browser tests (also known as end-to-end tests) verify your application works correctly from a user's perspective, testing the full stack including UI interactions, navigation, and JavaScript functionality.

## Overview

Browser tests help you:

- **Test user flows** - Complete workflows like signup, checkout
- **Verify UI rendering** - Ensure components display correctly
- **Test JavaScript** - Client-side interactions and reactivity
- **Cross-browser testing** - Verify compatibility across browsers

## Setup

Stacks browser testing uses a headless browser environment powered by Bun's test runner with DOM simulation.

### Configuration

Configure browser tests in `stacks.config.ts`:

```typescript
export default {
  testing: {
    browser: 'tests/Browser',

    // Browser options
    browserOptions: {
      headless: true,
      slowMo: 0,  // Slow down for debugging
      viewport: {
        width: 1280,
        height: 720,
      },
    },
  },
}
```

## Writing Browser Tests

### Basic Structure

```typescript
// tests/Browser/HomePageTest.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { browser, page } from '@stacksjs/testing'

describe('Home Page', () => {
  beforeAll(async () => {
    await browser.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  it('displays welcome message', async () => {
    await page.goto('/')

    const heading = await page.textContent('h1')
    expect(heading).toContain('Welcome')
  })

  it('has working navigation', async () => {
    await page.goto('/')
    await page.click('a[href="/about"]')

    expect(page.url()).toContain('/about')
    await expect(page.textContent('h1')).resolves.toBe('About Us')
  })
})
```

### Page Navigation

```typescript
import { page } from '@stacksjs/testing'

// Navigate to URL
await page.goto('/')
await page.goto('/products/123')
await page.goto('https://external-site.com')

// Navigation options
await page.goto('/', {
  waitUntil: 'networkidle',  // Wait for network to be idle
  timeout: 30000,
})

// Navigate back/forward
await page.goBack()
await page.goForward()

// Reload page
await page.reload()

// Get current URL
const url = page.url()
```

## Selecting Elements

### Query Selectors

```typescript
import { page } from '@stacksjs/testing'

// By CSS selector
const button = await page.$('button.primary')
const allButtons = await page.$$('button')

// By text content
const link = await page.$('text=Click me')
const heading = await page.$('h1:has-text("Welcome")')

// By test ID (recommended)
const submitBtn = await page.$('[data-testid="submit-button"]')

// By role
const nav = await page.$('role=navigation')

// Combined selectors
const item = await page.$('.list >> text=Item 1')
```

### Waiting for Elements

```typescript
// Wait for element to appear
await page.waitForSelector('.loading', { state: 'hidden' })
await page.waitForSelector('.content', { state: 'visible' })

// Wait for element to be attached
await page.waitForSelector('.dynamic-element', { state: 'attached' })

// With timeout
await page.waitForSelector('.slow-element', { timeout: 10000 })
```

## Interactions

### Clicking

```typescript
import { page } from '@stacksjs/testing'

// Simple click
await page.click('button')

// Double click
await page.dblclick('.item')

// Right click
await page.click('button', { button: 'right' })

// Click with modifiers
await page.click('a', { modifiers: ['Control'] })  // Ctrl+click

// Click at position
await page.click('canvas', { position: { x: 100, y: 50 } })

// Force click (bypass visibility checks)
await page.click('button', { force: true })
```

### Typing

```typescript
import { page } from '@stacksjs/testing'

// Type into input
await page.fill('input[name="email"]', 'user@example.com')

// Type with delay (simulates real typing)
await page.type('input[name="search"]', 'hello', { delay: 100 })

// Clear and type
await page.fill('input', '')
await page.fill('input', 'new value')

// Press keys
await page.press('input', 'Enter')
await page.press('body', 'Control+a')

// Type into focused element
await page.keyboard.type('Hello World')
await page.keyboard.press('Enter')
```

### Form Interactions

```typescript
import { page } from '@stacksjs/testing'

// Fill form fields
await page.fill('input[name="username"]', 'john_doe')
await page.fill('input[name="password"]', 'secret123')

// Select dropdown
await page.selectOption('select[name="country"]', 'us')
await page.selectOption('select', { label: 'United States' })
await page.selectOption('select', { value: 'us' })

// Check/uncheck checkbox
await page.check('input[type="checkbox"]')
await page.uncheck('input[type="checkbox"]')
const isChecked = await page.isChecked('input[type="checkbox"]')

// Radio buttons
await page.check('input[value="option1"]')

// File upload
await page.setInputFiles('input[type="file"]', '/path/to/file.pdf')
await page.setInputFiles('input[type="file"]', [
  '/path/to/file1.pdf',
  '/path/to/file2.pdf',
])
```

### Mouse Actions

```typescript
import { page } from '@stacksjs/testing'

// Hover
await page.hover('.menu-item')

// Drag and drop
await page.dragAndDrop('#source', '#target')

// Mouse movements
await page.mouse.move(100, 200)
await page.mouse.down()
await page.mouse.move(300, 200)
await page.mouse.up()
```

## Assertions

### Element Assertions

```typescript
import { expect } from 'bun:test'
import { page } from '@stacksjs/testing'

// Text content
const text = await page.textContent('.message')
expect(text).toBe('Hello World')
expect(text).toContain('Hello')

// Inner HTML
const html = await page.innerHTML('.container')
expect(html).toContain('<span>')

// Attribute value
const href = await page.getAttribute('a', 'href')
expect(href).toBe('/about')

// Element visibility
const isVisible = await page.isVisible('.modal')
expect(isVisible).toBe(true)

// Element enabled/disabled
const isDisabled = await page.isDisabled('button')
expect(isDisabled).toBe(false)

// Element count
const items = await page.$$('.list-item')
expect(items.length).toBe(5)
```

### Page Assertions

```typescript
import { expect } from 'bun:test'
import { page } from '@stacksjs/testing'

// URL assertions
expect(page.url()).toBe('http://localhost:3000/dashboard')
expect(page.url()).toContain('/dashboard')

// Title assertion
const title = await page.title()
expect(title).toBe('Dashboard - My App')

// Screenshot comparison (visual regression)
const screenshot = await page.screenshot()
expect(screenshot).toMatchSnapshot()
```

## Testing User Flows

### Login Flow

```typescript
import { describe, expect, it } from 'bun:test'
import { page } from '@stacksjs/testing'

describe('Authentication', () => {
  it('allows users to log in', async () => {
    await page.goto('/login')

    // Fill login form
    await page.fill('input[name="email"]', 'user@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect
    await page.waitForNavigation()

    // Verify logged in
    expect(page.url()).toContain('/dashboard')
    const welcomeText = await page.textContent('.welcome-message')
    expect(welcomeText).toContain('Welcome back')
  })

  it('shows error for invalid credentials', async () => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'user@example.com')
    await page.fill('input[name="password"]', 'wrong-password')
    await page.click('button[type="submit"]')

    // Wait for error message
    await page.waitForSelector('.error-message')

    const error = await page.textContent('.error-message')
    expect(error).toContain('Invalid credentials')
    expect(page.url()).toContain('/login')
  })
})
```

### Shopping Cart Flow

```typescript
describe('Shopping Cart', () => {
  it('adds items to cart', async () => {
    await page.goto('/products')

    // Add first product
    await page.click('.product:first-child .add-to-cart')

    // Verify cart count
    const cartCount = await page.textContent('.cart-count')
    expect(cartCount).toBe('1')
  })

  it('completes checkout', async () => {
    // Add item to cart
    await page.goto('/products/1')
    await page.click('.add-to-cart')

    // Go to checkout
    await page.click('.cart-icon')
    await page.click('.checkout-button')

    // Fill shipping info
    await page.fill('input[name="address"]', '123 Main St')
    await page.fill('input[name="city"]', 'New York')
    await page.selectOption('select[name="state"]', 'NY')
    await page.fill('input[name="zip"]', '10001')

    // Fill payment info
    await page.fill('input[name="card"]', '4111111111111111')
    await page.fill('input[name="expiry"]', '12/25')
    await page.fill('input[name="cvv"]', '123')

    // Submit order
    await page.click('.place-order')

    // Verify success
    await page.waitForSelector('.order-confirmation')
    const confirmation = await page.textContent('.order-number')
    expect(confirmation).toMatch(/ORD-\d+/)
  })
})
```

## Handling Async Operations

### Waiting for Network

```typescript
import { page } from '@stacksjs/testing'

// Wait for specific request
const [response] = await Promise.all([
  page.waitForResponse('/api/users'),
  page.click('button.load-users'),
])
expect(response.status()).toBe(200)

// Wait for all network requests to complete
await page.goto('/', { waitUntil: 'networkidle' })

// Intercept and mock requests
await page.route('/api/users', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Mock User' }]),
  })
})
```

### Waiting for JavaScript

```typescript
import { page } from '@stacksjs/testing'

// Wait for function to return truthy
await page.waitForFunction(() => {
  return document.querySelector('.loaded')?.classList.contains('ready')
})

// Wait with polling
await page.waitForFunction(
  () => window.myApp?.isReady,
  { polling: 100 }
)

// Evaluate JavaScript
const result = await page.evaluate(() => {
  return document.querySelectorAll('.item').length
})
expect(result).toBe(10)
```

## Testing Responsive Design

```typescript
import { describe, it } from 'bun:test'
import { page } from '@stacksjs/testing'

describe('Responsive Design', () => {
  it('shows mobile menu on small screens', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Desktop nav should be hidden
    const desktopNav = await page.isVisible('.desktop-nav')
    expect(desktopNav).toBe(false)

    // Mobile menu button should be visible
    const mobileMenuBtn = await page.isVisible('.mobile-menu-btn')
    expect(mobileMenuBtn).toBe(true)

    // Click mobile menu
    await page.click('.mobile-menu-btn')
    const mobileNav = await page.isVisible('.mobile-nav')
    expect(mobileNav).toBe(true)
  })

  it('shows desktop layout on large screens', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    const desktopNav = await page.isVisible('.desktop-nav')
    expect(desktopNav).toBe(true)

    const mobileMenuBtn = await page.isVisible('.mobile-menu-btn')
    expect(mobileMenuBtn).toBe(false)
  })
})
```

## Debugging

### Screenshots

```typescript
import { page } from '@stacksjs/testing'

// Capture screenshot
await page.screenshot({ path: 'screenshots/test.png' })

// Full page screenshot
await page.screenshot({ path: 'full-page.png', fullPage: true })

// Element screenshot
const element = await page.$('.card')
await element.screenshot({ path: 'card.png' })
```

### Slow Motion

```typescript
// In config
export default {
  testing: {
    browserOptions: {
      slowMo: 500,  // 500ms delay between actions
    },
  },
}
```

### Console Logs

```typescript
import { page } from '@stacksjs/testing'

// Listen to console messages
page.on('console', msg => console.log('PAGE LOG:', msg.text()))

// Listen to errors
page.on('pageerror', error => console.error('PAGE ERROR:', error))
```

## Running Browser Tests

```bash
# Run all browser tests
buddy test:browser

# Run specific test file
bun test tests/Browser/HomePageTest.ts

# Run in headed mode (see the browser)
buddy test:browser --headed

# Run with slow motion
buddy test:browser --slow-mo=500

# Generate screenshots on failure
buddy test:browser --screenshot-on-failure
```

## Best Practices

### DO

- **Use data-testid attributes** - More stable than CSS classes
- **Test user flows** - Not implementation details
- **Wait for elements** - Don't rely on fixed timeouts
- **Clean up state** - Each test should start fresh
- **Use page objects** - Organize selectors and actions

### DON'T

- **Don't test everything in browser** - Use unit tests for logic
- **Don't hard-code waits** - Use proper wait methods
- **Don't share state** - Tests should be independent
- **Don't test third-party UI** - Mock external services

### Page Object Pattern

```typescript
// tests/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email)
    await this.page.fill('[data-testid="password"]', password)
    await this.page.click('[data-testid="submit"]')
  }

  async getError() {
    return this.page.textContent('[data-testid="error"]')
  }
}

// Usage in tests
import { LoginPage } from '../pages/LoginPage'

it('shows error for invalid login', async () => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('user@example.com', 'wrong')

  const error = await loginPage.getError()
  expect(error).toContain('Invalid credentials')
})
```

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Unit Tests](/testing/unit-tests)** - Testing isolated functions
- **[HTTP Tests](/testing/http-tests)** - Testing API endpoints
- **[Mocking](/testing/mocking)** - Mocking dependencies
