import { spawn } from 'node:child_process'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'

const dashboardPath = storagePath('framework/defaults/dashboard')

log.info('Starting Stacks Dashboard...')
log.info(`Dashboard path: ${dashboardPath}`)

// Start STX dev server for the dashboard
const dashboardPort = 3456

log.info(`Starting STX dev server on http://localhost:${dashboardPort}...`)

let serverStarted = false

try {
  const { serve } = await import('bun-plugin-stx/serve')

  // Run serve in background - don't await since it blocks forever
  const serverPromise = serve({
    patterns: [dashboardPath],
    port: dashboardPort,
  })

  // Set up error handler but don't let it kill the process
  serverPromise.catch((err: Error) => {
    if (!serverStarted) {
      log.warn(`STX server issue: ${err.message}`)
    }
  })

  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 500))
  serverStarted = true
  log.success(`STX dev server running on http://localhost:${dashboardPort}`)
}
catch (err: any) {
  log.warn(`STX server warning: ${err.message || err}`)
  log.info('Continuing with Craft launch...')
}

// Path to the Craft binary - check common locations (craft-minimal parses CLI args)
const craftPaths = [
  projectPath('../craft/packages/zig/zig-out/bin/craft-minimal'), // Development location (monorepo)
  projectPath('../craft/zig-out/bin/craft-minimal'), // Development location (single package)
  '/usr/local/bin/craft', // Installed location
  projectPath('node_modules/.bin/craft'), // npm installed
]

let craftBinary: string | null = null
for (const craftPath of craftPaths) {
  try {
    const file = Bun.file(craftPath)
    if (await file.exists()) {
      craftBinary = craftPath
      log.info(`Found Craft at: ${craftPath}`)
      break
    }
  }
  catch {
    // Continue checking
  }
}

if (!craftBinary) {
  log.error('Could not find Craft binary. Please build Craft first:')
  log.info('  cd ~/Code/craft && zig build')
  process.exit(1)
}

// Build sidebar config from app.stx
const sidebarConfig = {
  sections: [
    {
      id: 'home',
      title: 'Home',
      items: [
        { id: 'home', label: 'Dashboard', icon: 'house.fill' },
      ],
    },
    {
      id: 'library',
      title: 'Library',
      items: [
        { id: 'components', label: 'Components', icon: 'puzzlepiece.fill' },
        { id: 'functions', label: 'Functions', icon: 'function' },
        { id: 'releases', label: 'Releases', icon: 'list.number' },
        { id: 'packages', label: 'Packages', icon: 'shippingbox.fill' },
      ],
    },
    {
      id: 'content',
      title: 'Content',
      items: [
        { id: 'content-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent' },
        { id: 'files', label: 'Files', icon: 'folder.fill' },
        { id: 'pages', label: 'Pages', icon: 'doc.fill' },
        { id: 'posts', label: 'Posts', icon: 'text.bubble.fill' },
        { id: 'categories', label: 'Categories', icon: 'tag.fill' },
        { id: 'tags', label: 'Tags', icon: 'tag' },
        { id: 'comments', label: 'Comments', icon: 'bubble.left.fill' },
        { id: 'authors', label: 'Authors', icon: 'person.text.rectangle.fill' },
        { id: 'seo', label: 'SEO', icon: 'magnifyingglass' },
      ],
    },
    {
      id: 'app',
      title: 'App',
      items: [
        { id: 'deployments', label: 'Deployments', icon: 'rocket.fill' },
        { id: 'requests', label: 'Requests', icon: 'arrow.left.arrow.right' },
        { id: 'realtime', label: 'Realtime', icon: 'link' },
        { id: 'actions', label: 'Actions', icon: 'bolt.fill' },
        { id: 'commands', label: 'Commands', icon: 'terminal.fill' },
        { id: 'queue', label: 'Queue', icon: 'list.bullet.rectangle.fill' },
        { id: 'jobs', label: 'Jobs', icon: 'briefcase.fill' },
        { id: 'queries', label: 'Queries', icon: 'magnifyingglass.circle.fill' },
        { id: 'notifications', label: 'Notifications', icon: 'bell.fill' },
      ],
    },
    {
      id: 'data',
      title: 'Data',
      items: [
        { id: 'data-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent' },
        { id: 'activity', label: 'Activity', icon: 'waveform.path.ecg' },
        { id: 'users', label: 'Users', icon: 'person.fill' },
        { id: 'teams', label: 'Teams', icon: 'person.2.fill' },
        { id: 'subscribers', label: 'Subscribers', icon: 'envelope.open.fill' },
      ],
    },
    {
      id: 'commerce',
      title: 'Commerce',
      items: [
        { id: 'commerce-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent' },
        { id: 'pos', label: 'POS', icon: 'cart.fill' },
        { id: 'customers', label: 'Customers', icon: 'person.crop.circle.fill' },
        { id: 'orders', label: 'Orders', icon: 'list.clipboard.fill' },
        { id: 'products', label: 'Products', icon: 'cube.box.fill' },
        { id: 'coupons', label: 'Coupons', icon: 'ticket.fill' },
        { id: 'gift-cards', label: 'Gift Cards', icon: 'giftcard.fill' },
        { id: 'payments', label: 'Payments', icon: 'creditcard.fill' },
        { id: 'delivery', label: 'Delivery', icon: 'truck.box.fill' },
        { id: 'taxes', label: 'Taxes', icon: 'percent' },
      ],
    },
    {
      id: 'marketing',
      title: 'Marketing',
      items: [
        { id: 'lists', label: 'Lists', icon: 'list.bullet' },
        { id: 'social-posts', label: 'Social Posts', icon: 'clock.fill' },
        { id: 'campaigns', label: 'Campaigns', icon: 'megaphone.fill' },
        { id: 'marketing-reviews', label: 'Reviews', icon: 'star.fill' },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics',
      items: [
        { id: 'analytics-web', label: 'Web', icon: 'globe' },
        { id: 'analytics-blog', label: 'Blog', icon: 'doc.text.fill' },
        { id: 'analytics-goals', label: 'Goals', icon: 'target' },
        { id: 'analytics-commerce', label: 'Commerce', icon: 'cart.fill' },
        { id: 'analytics-sales', label: 'Sales', icon: 'chart.line.uptrend.xyaxis' },
        { id: 'analytics-marketing', label: 'Marketing', icon: 'megaphone.fill' },
      ],
    },
    {
      id: 'management',
      title: 'Management',
      items: [
        { id: 'cloud', label: 'Cloud', icon: 'cloud.fill' },
        { id: 'servers', label: 'Servers', icon: 'server.rack' },
        { id: 'serverless', label: 'Serverless', icon: 'bolt.horizontal.circle.fill' },
        { id: 'dns', label: 'DNS', icon: 'network' },
        { id: 'permissions', label: 'Permissions', icon: 'lock.fill' },
        { id: 'mailboxes', label: 'Mailboxes', icon: 'tray.full.fill' },
        { id: 'logs', label: 'Logs', icon: 'list.bullet.rectangle.portrait.fill' },
      ],
    },
    {
      id: 'utilities',
      title: 'Utilities',
      items: [
        { id: 'buddy', label: 'AI Buddy', icon: 'bubble.left.and.bubble.right.fill' },
        { id: 'environment', label: 'Environment', icon: 'key.fill' },
        { id: 'access-tokens', label: 'Access Tokens', icon: 'key.horizontal.fill' },
        { id: 'settings', label: 'Settings', icon: 'gearshape.fill' },
      ],
    },
  ],
  minWidth: 200,
  maxWidth: 280,
}

// Convert sidebar config to JSON string for CLI
const sidebarConfigJson = JSON.stringify(sidebarConfig)

log.info('Launching Craft with native sidebar...')

// Generate HTML that loads the dashboard using fetch instead of iframe
const dashboardHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stacks Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: auto; background: #f5f5f5; }
    #dashboard-content {
      width: 100%;
      min-height: 100%;
      padding: 20px;
    }
    #debug-status {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #333;
      color: #0f0;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 4px;
      z-index: 9999;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
  </style>
</head>
<body>
  <div id="debug-status">JS: initializing...</div>
  <div id="dashboard-content"><div class="loading">Loading...</div></div>
  <script>
    const debugEl = document.getElementById('debug-status');
    const SERVER_URL = 'http://localhost:${dashboardPort}';
    const contentEl = document.getElementById('dashboard-content');

    function debug(msg) {
      debugEl.textContent = msg;
      console.log('[Dashboard]', msg);
    }

    debug('JS running');

    // Load a page via fetch and inject into DOM
    async function loadPage(pagePath) {
      debug('Loading: ' + pagePath);
      try {
        const response = await fetch(SERVER_URL + pagePath);
        debug('Response: ' + response.status);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const html = await response.text();
        debug('Got ' + html.length + ' bytes');
        contentEl.innerHTML = html;
        debug('Injected HTML');
        // Execute any scripts in the loaded content
        const scripts = contentEl.querySelectorAll('script');
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script');
          if (oldScript.src) {
            newScript.src = oldScript.src;
          } else {
            newScript.textContent = oldScript.textContent;
          }
          oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        debug('Page loaded: ' + pagePath);
      } catch (err) {
        debug('ERROR: ' + err.message);
        contentEl.innerHTML = '<div class="loading" style="color:red;">Failed to load: ' + pagePath + '<br>' + err.message + '</div>';
      }
    }

    // Handle navigation from sidebar
    window.craft = window.craft || {};
    window.craft._sidebarSelectHandler = function(event) {
      const section = event.sectionId || event.section;
      const item = event.itemId || event.item;
      debug('Nav: ' + section + '/' + item);

      // Map item IDs to pretty routes (no /pages/ prefix, no .stx extension)
      let pagePath;
      if (section === 'home' && item === 'home') {
        pagePath = '/home';
      } else {
        // Handle special cases where item ID differs from filename
        let filename = item;
        if (item === 'content-dashboard' || item === 'data-dashboard' || item === 'commerce-dashboard') {
          filename = 'dashboard';
        }
        pagePath = '/' + section + '/' + filename;
      }

      loadPage(pagePath);
    };

    // Load initial page
    debug('Starting initial load');
    loadPage('/home');
  </script>
</body>
</html>`

// Launch Craft with the dashboard
const craftProcess = spawn(craftBinary!, [
  '--title', 'Stacks Dashboard',
  '--width', '1400',
  '--height', '900',
  '--native-sidebar',
  '--sidebar-config', sidebarConfigJson,
  '--sidebar-width', '240',
  '--html', dashboardHtml,
], {
  stdio: 'inherit',
  cwd: dashboardPath,
})

craftProcess.on('error', (err) => {
  log.error(`Failed to start Craft: ${err.message}`)
  log.info('Make sure Craft is built. Run: cd ~/Code/craft && zig build')
  process.exit(1)
})

craftProcess.on('close', (code) => {
  log.info(`Dashboard closed with code ${code}`)
  process.exit(code || 0)
})

// Keep the process running
process.on('SIGINT', () => {
  craftProcess.kill()
  process.exit(0)
})

process.on('SIGTERM', () => {
  craftProcess.kill()
  process.exit(0)
})
