import type { DashboardNavigationCard, DashboardNavigationHub } from './section-navigation'
import { canSeeDashboardCard, dashboardNavigationPath } from './section-navigation'

interface LandingDefinition {
  introduction: string
  primary: string
  featured: Record<string, string>
  groups?: Record<string, string[]>
}

const landings: Record<string, LandingDefinition> = {
  library: {
    introduction: 'Browse the pieces of your project, from interface components to functions and installed packages.',
    primary: '/library/components',
    featured: {
      '/functions': 'Find the shared functions available in your application.',
      '/packages': 'See the packages your project installs and depends on.',
      '/releases': 'Look through released versions of the project.',
    },
  },
  content: {
    introduction: 'Find what you’re working on, make changes, and keep published content organized.',
    primary: '/content/posts',
    featured: {
      '/content/pages': 'Edit the pages visitors find on your site.',
      '/content/files': 'Browse and organize the files on your storage disks.',
      '/content/blog': 'Review blog activity and publishing.',
      '/content/comments': 'Read and moderate responses to your posts.',
    },
    groups: {
      'Publishing': ['/content/dashboard', '/content/authors', '/content/categories', '/content/tags'],
      'Discoverability': ['/content/seo'],
    },
  },
  app: {
    introduction: 'Ship changes, follow background work, and see how the application is behaving.',
    primary: '/deployments',
    featured: {
      '/operations/scheduler': 'Review scheduled tasks and their recent runs.',
      '/requests': 'Inspect HTTP requests and response times.',
      '/jobs': 'Follow work as it runs in the background.',
      '/errors': 'Find captured exceptions and their context.',
    },
    groups: {
      'Background work': ['/actions', '/commands', '/queue', '/jobs'],
      'Diagnostics': ['/queries', '/realtime', '/search-engine'],
      'Messages': ['/inbox', '/notifications'],
    },
  },
  data: {
    introduction: 'Work with the people and records in your application, and see what’s changed recently.',
    primary: '/models',
    featured: {
      '/data/users': 'Review accounts and manage individual users.',
      '/data/teams': 'Browse teams and their members.',
      '/data/activity': 'See recent changes made in the application.',
      '/data/subscribers': 'Review the people on your subscriber list.',
    },
    groups: {
      'Data overview': ['/data/dashboard'],
    },
  },
  commerce: {
    introduction: 'Run the store from one place, from the products you sell to the orders customers place.',
    primary: '/commerce/orders',
    featured: {
      '/commerce/products': 'Manage products, prices, and availability.',
      '/commerce/customers': 'Find customers and review their order history.',
      '/commerce/payments': 'Inspect recorded payments and their status.',
      '/commerce/pos': 'Open the point of sale for in-person orders.',
    },
    groups: {
      'Catalog': ['/commerce/categories', '/commerce/manufacturers', '/commerce/units', '/commerce/variants', '/commerce/reviews'],
      'Promotions': ['/commerce/coupons', '/commerce/discounts', '/commerce/upsells', '/commerce/gift-cards', '/commerce/waitlist'],
      'Store operations': ['/commerce/dashboard', '/commerce/taxes', '/commerce/printers'],
    },
  },
  delivery: {
    introduction: 'Set up how orders reach customers and manage access to digital purchases.',
    primary: '/commerce/delivery',
    featured: {
      '/commerce/delivery/shipping-methods': 'Manage the ways customers can receive an order.',
      '/commerce/delivery/couriers': 'Review the couriers handling delivery.',
      '/commerce/delivery/delivery-routes': 'Organize delivery routes.',
      '/commerce/delivery/digital-delivery': 'Review digital items and their delivery.',
    },
    groups: {
      'Rates and regions': ['/commerce/delivery/shipping-rates', '/commerce/delivery/shipping-zones'],
      'Digital access': ['/commerce/delivery/license-keys'],
    },
  },
  marketing: {
    introduction: 'Plan outreach, keep track of your audiences, and see where customers are engaging.',
    primary: '/marketing/campaigns',
    featured: {
      '/marketing/lists': 'Organize the audiences you want to reach.',
      '/marketing/social-posts': 'Review and manage social posts.',
      '/marketing/abandoned-carts': 'See storefront carts left before checkout.',
      '/marketing/reviews': 'Review customer feedback on products.',
    },
  },
  analytics: {
    introduction: 'Understand how people find your application and what they do once they arrive.',
    primary: '/analytics',
    featured: {
      '/analytics/web': 'Review traffic, visits, and engagement.',
      '/analytics/pages': 'Find the pages people visit most.',
      '/analytics/referrers': 'See which sources send people to your site.',
      '/analytics/events': 'Explore events captured by the application.',
    },
    groups: {
      'Audience': ['/analytics/countries', '/analytics/browsers', '/analytics/devices'],
      'Channels': ['/analytics/blog', '/analytics/commerce', '/analytics/marketing'],
    },
  },
  management: {
    introduction: 'Check the services your application relies on and manage access to its infrastructure.',
    primary: '/health',
    featured: {
      '/cloud': 'Review the cloud resources connected to this project.',
      '/servers': 'Find the servers running your application.',
      '/logs': 'Read application logs and trace recent activity.',
      '/management/permissions': 'Review the roles and permissions used by the dashboard.',
    },
    groups: {
      'Infrastructure': ['/serverless', '/dns', '/remote', '/mailboxes'],
      'Team operations': ['/insights', '/kanban', '/ci'],
    },
  },
  utilities: {
    introduction: 'Configure your project and find the tools it uses to run.',
    primary: '/settings',
    featured: {
      '/settings/appearance': 'Choose a dashboard theme and color mode.',
      '/environment': 'Review the environment your application runs in.',
      '/access-tokens': 'Manage tokens used to connect to the application.',
      '/buddy': 'Browse commands for building and operating the project.',
    },
    groups: {
      'Email': ['/settings/mail'],
    },
  },
}

interface LandingGroup {
  title: string
  first: DashboardNavigationCard[]
  more: DashboardNavigationCard[]
}

export function getDashboardSectionLanding(hub: DashboardNavigationHub, roles: readonly string[], localViewer: boolean): {
  introduction: string
  primary: DashboardNavigationCard | undefined
  featured: DashboardNavigationCard[]
  groups: LandingGroup[]
} {
  const design = landings[hub.id]
  const destinations = hub.destinations.filter(item => canSeeDashboardCard(item, roles, localViewer))
  const featuredByPath = design?.featured
  const primary = destinations.find(item => item.href === design?.primary)
    ?? destinations.find(item => featuredByPath?.[item.href])
    ?? destinations[0]
  const used = new Set(primary ? [primary.id] : [])
  const featured: DashboardNavigationCard[] = []
  for (const [href, description] of Object.entries(featuredByPath ?? {})) {
    const card = destinations.find(item => item.href === href && !used.has(item.id))
    if (card) {
      featured.push({ ...card, description })
      used.add(card.id)
    }
  }
  if (!design) {
    for (const card of destinations.filter(item => !used.has(item.id)).slice(0, 4)) {
      featured.push(card)
      used.add(card.id)
    }
  }

  const groups: LandingGroup[] = []
  function addGroup(title: string, matches: (card: DashboardNavigationCard) => boolean): void {
    const items = destinations.filter(card => !used.has(card.id) && matches(card))
    if (!items.length)
      return
    for (const item of items)
      used.add(item.id)
    groups.push({ title, first: items.slice(0, 4), more: items.slice(4) })
  }

  for (const [title, paths] of Object.entries(design?.groups ?? {})) {
    addGroup(title, ({ href }) => {
      if (!href.startsWith('/') || href.startsWith('//'))
        return false
      const path = dashboardNavigationPath(href)
      return paths.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    })
  }
  addGroup('Model records', item => item.href.startsWith('/models/'))
  addGroup('More pages', () => true)

  return { introduction: design?.introduction ?? hub.description ?? '', primary, featured, groups }
}
