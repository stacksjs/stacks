# Extend Dashboard

This guide covers customizing and extending the Stacks dashboard with custom widgets, pages, themes, and plugins.

## Getting Started

The Stacks dashboard provides a flexible system for building custom admin interfaces and management tools.

```ts
import { Dashboard } from '@stacksjs/dashboard'
```

## Custom Widgets

### Creating a Widget

```ts
// resources/dashboard/widgets/StatsWidget.ts
import { Widget } from '@stacksjs/dashboard'

export default new Widget({
  name: 'StatsWidget',
  title: 'Application Statistics',
  description: 'Displays key application metrics',
  size: 'medium', // 'small' | 'medium' | 'large' | 'full'
  refreshInterval: 60000, // Refresh every minute

  async data() {
    const [users, orders, revenue] = await Promise.all([
      User.count(),
      Order.where('status', '=', 'completed').count(),
      Order.where('status', '=', 'completed').sum('total'),
    ])

    return {
      users,
      orders,
      revenue: revenue / 100, // Convert cents to dollars
    }
  },

  template: `
    <div class="grid grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="stat-value">{{ users }}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ orders }}</div>
        <div class="stat-label">Completed Orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">\${{ revenue.toLocaleString() }}</div>
        <div class="stat-label">Total Revenue</div>
      </div>
    </div>
  `,
})
```

### Chart Widget

```ts
// resources/dashboard/widgets/RevenueChartWidget.ts
import { Widget } from '@stacksjs/dashboard'

export default new Widget({
  name: 'RevenueChartWidget',
  title: 'Revenue Over Time',
  size: 'large',
  refreshInterval: 300000, // 5 minutes

  async data() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const revenue = await db
      .selectFrom('orders')
      .select([
        sql`DATE(created_at)`.as('date'),
        sql`SUM(total)`.as('total'),
      ])
      .where('created_at', '>=', thirtyDaysAgo)
      .where('status', '=', 'completed')
      .groupBy(sql`DATE(created_at)`)
      .orderBy('date')
      .execute()

    return {
      labels: revenue.map(r => r.date),
      values: revenue.map(r => r.total / 100),
    }
  },

  template: `
    <div class="chart-container">
      <canvas id="revenue-chart"></canvas>
    </div>
  `,

  mounted() {
    new Chart(document.getElementById('revenue-chart'), {
      type: 'line',
      data: {
        labels: this.data.labels,
        datasets: [{
          label: 'Revenue',
          data: this.data.values,
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    })
  },
})
```

### Activity Feed Widget

```ts
// resources/dashboard/widgets/ActivityFeedWidget.ts
import { Widget } from '@stacksjs/dashboard'

export default new Widget({
  name: 'ActivityFeedWidget',
  title: 'Recent Activity',
  size: 'medium',
  refreshInterval: 30000,

  async data() {
    const activities = await Activity
      .with(['user'])
      .orderBy('created_at', 'desc')
      .limit(10)
      .get()

    return { activities }
  },

  template: `
    <div class="activity-feed">
      <div v-for="activity in activities" :key="activity.id" class="activity-item">
        <div class="activity-icon" :class="activity.type">
          <icon :name="getIcon(activity.type)" />
        </div>
        <div class="activity-content">
          <p class="activity-message">{{ activity.message }}</p>
          <p class="activity-meta">
            <span class="user">{{ activity.user?.name }}</span>
            <span class="time">{{ formatTime(activity.created_at) }}</span>
          </p>
        </div>
      </div>
    </div>
  `,

  methods: {
    getIcon(type: string) {
      const icons: Record<string, string> = {
        'user.created': 'user-plus',
        'order.completed': 'shopping-cart',
        'payment.received': 'credit-card',
        default: 'activity',
      }
      return icons[type] || icons.default
    },

    formatTime(date: string) {
      return new Date(date).toLocaleString()
    },
  },
})
```

## Custom Pages

### Creating a Dashboard Page

```ts
// resources/dashboard/pages/AnalyticsPage.ts
import { DashboardPage } from '@stacksjs/dashboard'

export default new DashboardPage({
  name: 'Analytics',
  path: '/analytics',
  icon: 'chart-bar',
  title: 'Analytics Dashboard',

  // Page-level data
  async data() {
    return {
      metrics: await getAnalyticsMetrics(),
    }
  },

  // Widgets to display on this page
  widgets: [
    'RevenueChartWidget',
    'StatsWidget',
    'ActivityFeedWidget',
  ],

  template: `
    <div class="analytics-page">
      <header class="page-header">
        <h1>{{ title }}</h1>
        <div class="actions">
          <button @click="exportReport">Export Report</button>
          <date-range-picker v-model="dateRange" />
        </div>
      </header>

      <div class="widgets-grid">
        <widget-container
          v-for="widget in widgets"
          :key="widget"
          :name="widget"
        />
      </div>
    </div>
  `,

  methods: {
    async exportReport() {
      const report = await generateAnalyticsReport(this.dateRange)
      downloadFile(report, 'analytics-report.pdf')
    },
  },
})
```

### Custom Settings Page

```ts
// resources/dashboard/pages/SettingsPage.ts
import { DashboardPage } from '@stacksjs/dashboard'

export default new DashboardPage({
  name: 'Settings',
  path: '/settings',
  icon: 'cog',
  title: 'Application Settings',

  async data() {
    return {
      settings: await Settings.all(),
    }
  },

  template: `
    <div class="settings-page">
      <h1>Settings</h1>

      <form @submit.prevent="saveSettings" class="settings-form">
        <section class="settings-section">
          <h2>General</h2>

          <div class="form-group">
            <label>Application Name</label>
            <input v-model="settings.app_name" type="text" />
          </div>

          <div class="form-group">
            <label>Support Email</label>
            <input v-model="settings.support_email" type="email" />
          </div>

          <div class="form-group">
            <label>Timezone</label>
            <select v-model="settings.timezone">
              <option v-for="tz in timezones" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
          </div>
        </section>

        <section class="settings-section">
          <h2>Features</h2>

          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" v-model="settings.enable_registration" />
              <span>Allow User Registration</span>
            </label>
          </div>

          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" v-model="settings.enable_api" />
              <span>Enable Public API</span>
            </label>
          </div>
        </section>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `,

  methods: {
    async saveSettings() {
      await Settings.update(this.settings)
      this.notify('Settings saved successfully')
    },
  },
})
```

## Custom Navigation

### Adding Menu Items

```ts
// resources/dashboard/navigation.ts
import { Navigation } from '@stacksjs/dashboard'

export default new Navigation({
  items: [
    {
      label: 'Dashboard',
      icon: 'home',
      path: '/',
    },
    {
      label: 'Users',
      icon: 'users',
      path: '/users',
      children: [
        { label: 'All Users', path: '/users' },
        { label: 'Roles', path: '/users/roles' },
        { label: 'Permissions', path: '/users/permissions' },
      ],
    },
    {
      label: 'Orders',
      icon: 'shopping-cart',
      path: '/orders',
      badge: async () => {
        const pending = await Order.where('status', '=', 'pending').count()
        return pending > 0 ? pending.toString() : null
      },
    },
    {
      label: 'Products',
      icon: 'box',
      path: '/products',
    },
    {
      label: 'Analytics',
      icon: 'chart-bar',
      path: '/analytics',
    },
    {
      label: 'Settings',
      icon: 'cog',
      path: '/settings',
      position: 'bottom',
    },
  ],
})
```

### Conditional Navigation

```ts
export default new Navigation({
  items: [
    {
      label: 'Admin Tools',
      icon: 'shield',
      path: '/admin',
      visible: (user) => user.hasRole('admin'),
    },
    {
      label: 'Developer',
      icon: 'code',
      path: '/developer',
      visible: (user) => user.hasRole('developer'),
      children: [
        { label: 'API Tokens', path: '/developer/tokens' },
        { label: 'Webhooks', path: '/developer/webhooks' },
        { label: 'Logs', path: '/developer/logs' },
      ],
    },
  ],
})
```

## Custom Themes

### Creating a Theme

```ts
// resources/dashboard/themes/dark.ts
import { Theme } from '@stacksjs/dashboard'

export default new Theme({
  name: 'dark',
  label: 'Dark Mode',

  colors: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    background: '#1F2937',
    surface: '#374151',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    border: '#4B5563',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },

  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
    },
  },

  spacing: {
    sidebar: '256px',
    header: '64px',
  },

  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
})
```

### Custom CSS

```css
/* resources/dashboard/themes/custom.css */
:root {
  --color-primary: #6366F1;
  --color-primary-hover: #4F46E5;
  --color-background: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-text: #111827;
  --color-text-muted: #6B7280;
  --color-border: #E5E7EB;
}

[data-theme="dark"] {
  --color-primary: #818CF8;
  --color-primary-hover: #6366F1;
  --color-background: #1F2937;
  --color-surface: #374151;
  --color-text: #F9FAFB;
  --color-text-muted: #9CA3AF;
  --color-border: #4B5563;
}

.dashboard-sidebar {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.dashboard-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.widget-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

## Dashboard Plugins

### Creating a Plugin

```ts
// resources/dashboard/plugins/notifications.ts
import { DashboardPlugin } from '@stacksjs/dashboard'

export default new DashboardPlugin({
  name: 'notifications',

  install(dashboard) {
    // Add notification system
    dashboard.notifications = {
      items: [],

      async fetch() {
        this.items = await Notification
          .where('read', '=', false)
          .orderBy('created_at', 'desc')
          .limit(20)
          .get()
      },

      async markAsRead(id: number) {
        await Notification.where('id', '=', id).update({ read: true })
        await this.fetch()
      },

      async markAllAsRead() {
        await Notification.where('read', '=', false).update({ read: true })
        this.items = []
      },
    }

    // Add notification bell to header
    dashboard.addHeaderComponent('NotificationBell', {
      template: `
        <div class="notification-bell">
          <button @click="toggle" class="bell-button">
            <icon name="bell" />
            <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
          </button>

          <div v-if="open" class="notification-dropdown">
            <div class="dropdown-header">
              <h3>Notifications</h3>
              <button @click="markAllAsRead">Mark all read</button>
            </div>

            <div class="notification-list">
              <div
                v-for="notification in notifications"
                :key="notification.id"
                class="notification-item"
                @click="markAsRead(notification.id)"
              >
                <p class="notification-message">{{ notification.message }}</p>
                <span class="notification-time">
                  {{ formatTime(notification.created_at) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      `,

      data() {
        return {
          open: false,
        }
      },

      computed: {
        notifications() {
          return dashboard.notifications.items
        },
        unreadCount() {
          return this.notifications.length
        },
      },

      methods: {
        toggle() {
          this.open = !this.open
        },
        markAsRead(id: number) {
          dashboard.notifications.markAsRead(id)
        },
        markAllAsRead() {
          dashboard.notifications.markAllAsRead()
        },
      },

      mounted() {
        dashboard.notifications.fetch()
        // Poll for new notifications
        setInterval(() => dashboard.notifications.fetch(), 60000)
      },
    })
  },
})
```

### Registering Plugins

```ts
// config/dashboard.ts
import notificationsPlugin from '../resources/dashboard/plugins/notifications'

export default {
  plugins: [
    notificationsPlugin,
  ],
}
```

## Custom Actions

### Bulk Actions

```ts
// resources/dashboard/actions/bulk-actions.ts
import { BulkAction } from '@stacksjs/dashboard'

export const exportUsersAction = new BulkAction({
  name: 'export',
  label: 'Export Selected',
  icon: 'download',

  async execute(selectedIds: number[]) {
    const users = await User.whereIn('id', selectedIds).get()
    const csv = generateCSV(users)
    downloadFile(csv, 'users-export.csv')
  },
})

export const deleteUsersAction = new BulkAction({
  name: 'delete',
  label: 'Delete Selected',
  icon: 'trash',
  confirmMessage: 'Are you sure you want to delete the selected users?',
  variant: 'danger',

  async execute(selectedIds: number[]) {
    await User.whereIn('id', selectedIds).delete()
    return { message: `Deleted ${selectedIds.length} users` }
  },
})
```

## Error Handling

```ts
try {
  const widget = await Dashboard.loadWidget('CustomWidget')
} catch (error) {
  if (error instanceof WidgetNotFoundError) {
    console.error('Widget not found:', error.widgetName)
  } else if (error instanceof WidgetDataError) {
    console.error('Failed to load widget data:', error.message)
  } else {
    console.error('Unknown dashboard error:', error)
  }
}
```

This documentation covers extending the Stacks dashboard with custom widgets, pages, themes, and plugins. Each example is designed for building powerful admin interfaces.
