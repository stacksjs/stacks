# Build a Frontend

This tutorial will guide you through building a frontend application with Stacks. You will learn how to create components using STX (Stacks Template Syntax), style them with Headwind CSS utilities, manage state, and set up routing.

## Stacks UI Engine

The Stacks UI engine is responsible for rendering the UI of your application. It is designed to be framework-agnostic, meaning that the built results can be used with any JavaScript or TypeScript framework.

The UI engine handles two core responsibilities:

1. **Rendering the Application** - Your main web application
2. **Rendering the Documentation** - Your docs site (powered by BunPress/VitePress)

## Creating Components with STX

STX (Stacks Template Syntax) is a simple, HTML-like syntax for building components. Components live in the `resources/components/` directory.

### Basic Component Structure

An STX component consists of three parts: script, template, and optional styles.

```html
<!-- resources/components/Greeting.stx -->
<script server>
// Props - values passed from parent components
const name = props.name || 'World'
const showTime = props.showTime || false

// Computed values
const greeting = `Hello, ${name}!`
const currentTime = new Date().toLocaleTimeString()
</script>

<div class="greeting-card">
  <h1>{{ greeting }}</h1>

  @if(showTime)
    <p class="time">Current time: {{ currentTime }}</p>
  @endif
</div>

<style scoped>
.greeting-card {
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f8f9fa;
}

.time {
  color: #6c757d;
  font-size: 0.875rem;
}
</style>
```

### Using Props

Props allow you to pass data from parent to child components:

```html
<!-- resources/components/Button.stx -->
<script server>
// Define props with defaults
const variant = props.variant || 'solid'  // 'solid' | 'outline'
const color = props.color || 'blue'       // 'blue' | 'slate' | 'white'
const href = props.href || ''
const customClass = props.customClass || ''

// Style mappings
const baseStyles = 'inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold'

const variantStyles = {
  solid: {
    blue: 'bg-blue-600 text-white hover:bg-blue-500',
    slate: 'bg-slate-900 text-white hover:bg-slate-700',
  },
  outline: {
    blue: 'ring-1 ring-blue-200 text-blue-700 hover:ring-blue-300',
    slate: 'ring-1 ring-slate-200 text-slate-700 hover:ring-slate-300',
  },
}

function getClassName() {
  return `${baseStyles} ${variantStyles[variant]?.[color] || ''} ${customClass}`
}
</script>

@if(!href)
  <button class="{{ getClassName() }}">
    <slot />
  </button>
@else
  <a href="{{ href }}" class="{{ getClassName() }}">
    <slot />
  </a>
@endif
```

Using the component:

```html
<!-- In another component or view -->
<Button variant="solid" color="blue">Click Me</Button>
<Button variant="outline" color="slate" href="/about">Learn More</Button>
```

### Using Slots

Slots allow you to pass content into components:

```html
<!-- resources/components/Card.stx -->
<script server>
const title = props.title || ''
</script>

<div class="card rounded-lg shadow-md bg-white p-6">
  @if(title)
    <h2 class="text-xl font-bold mb-4">{{ title }}</h2>
  @endif

  <div class="card-content">
    <slot />
  </div>

  @if(slots.footer)
    <div class="card-footer mt-4 pt-4 border-t">
      <slot name="footer" />
    </div>
  @endif
</div>
```

Using named slots:

```html
<Card title="My Card">
  <p>This is the main content.</p>

  <template #footer>
    <Button>Save</Button>
  </template>
</Card>
```

### Conditionals and Loops

STX provides Blade-like directives for control flow:

```html
<script server>
const items = props.items || []
const showEmpty = props.showEmpty || true
</script>

<ul class="item-list">
  @if(items.length > 0)
    @for(item of items)
      <li class="item">
        {{ item.name }}

        @if(item.isNew)
          <span class="badge">New</span>
        @endif
      </li>
    @endfor
  @elseif(showEmpty)
    <li class="empty">No items found</li>
  @endif
</ul>
```

## Styling with Headwind

Stacks uses Headwind, a utility-first CSS framework similar to Tailwind CSS. You can use utility classes directly in your templates.

### Common Utility Classes

```html
<!-- Layout -->
<div class="flex items-center justify-between">
  <div class="grid grid-cols-3 gap-4">
    <!-- Grid items -->
  </div>
</div>

<!-- Spacing -->
<div class="p-4 m-2 px-6 py-3 mt-8 mb-4">
  <!-- Content with padding and margin -->
</div>

<!-- Typography -->
<h1 class="text-3xl font-bold text-gray-900">Title</h1>
<p class="text-sm text-gray-600 leading-relaxed">Body text</p>

<!-- Colors -->
<div class="bg-blue-500 text-white">
  <span class="text-blue-200">Colored text</span>
</div>

<!-- Borders and Shadows -->
<div class="border border-gray-200 rounded-lg shadow-md">
  <!-- Content -->
</div>

<!-- Responsive -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Responsive width -->
</div>

<!-- Dark Mode -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <!-- Dark mode support -->
</div>

<!-- Hover and Focus States -->
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-300">
  Hover me
</button>
```

### Using Icons

Stacks supports icon classes using the `i-` prefix:

```html
<i class="i-hugeicons-outline-book-open h-6 w-6 text-gray-500"></i>
<i class="i-hugeicons-outline-heart h-5 w-5 text-red-500"></i>
```

## State Management

### Local Component State

For simple state within a component, use the script section:

```html
<script server>
let count = 0

function increment() {
  count++
}

function decrement() {
  count--
}
</script>

<div class="counter">
  <button onclick="decrement()">-</button>
  <span>{{ count }}</span>
  <button onclick="increment()">+</button>
</div>
```

### Reactive State

For reactive state that updates the UI:

```html
<script server>
import { ref, computed } from '@stacksjs/reactivity'

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>

<div class="counter">
  <p>Count: {{ count.value }}</p>
  <p>Doubled: {{ doubled.value }}</p>
  <button onclick="increment()">Increment</button>
</div>
```

### Shared State

For state shared across components, create a store:

```typescript
// resources/functions/store.ts
import { reactive } from '@stacksjs/reactivity'

export const store = reactive({
  user: null,
  isAuthenticated: false,
  theme: 'light',
})

export function setUser(user) {
  store.user = user
  store.isAuthenticated = !!user
}

export function toggleTheme() {
  store.theme = store.theme === 'light' ? 'dark' : 'light'
}
```

Using the store in components:

```html
<script server>
import { store, toggleTheme } from '../functions/store'
</script>

<div class="theme-toggle">
  <span>Current theme: {{ store.theme }}</span>
  <button onclick="toggleTheme()">Toggle Theme</button>
</div>
```

## Routing

Stacks supports two routing strategies for your frontend:

### File-based Routing (Default)

With file-based routing, your file structure determines your routes. Files in `resources/views/` automatically become routes.

```
resources/views/
├── index.stx           # /
├── about.stx           # /about
├── contact.stx         # /contact
├── blog/
│   ├── index.stx       # /blog
│   └── [slug].stx      # /blog/:slug (dynamic route)
└── dashboard/
    ├── index.stx       # /dashboard
    └── settings.stx    # /dashboard/settings
```

#### Dynamic Routes

Use square brackets for dynamic segments:

```html
<!-- resources/views/blog/[slug].stx -->
<script server>
const slug = params.slug
// Fetch blog post using slug
</script>

<article>
  <h1>Blog Post: {{ slug }}</h1>
</article>
```

### Laravel-like Routing

For more control, use explicit route definitions:

```typescript
// routes/web.ts
import { route } from '@stacksjs/router'

route.get('/', 'HomeController@index')
route.get('/about', 'AboutController@show')
route.get('/blog/:slug', 'BlogController@show')
route.get('/dashboard', 'DashboardController@index').middleware('auth')
```

### Navigation

Use the Link component or standard anchor tags:

```html
<!-- Using anchor tags with utility classes -->
<nav class="flex gap-4">
  <a href="/" class="text-blue-600 hover:underline">Home</a>
  <a href="/about" class="text-blue-600 hover:underline">About</a>
  <a href="/contact" class="text-blue-600 hover:underline">Contact</a>
</nav>
```

## Layouts

Create reusable layouts for consistent page structure:

```html
<!-- resources/layouts/Default.stx -->
<script server>
const title = props.title || 'My App'
</script>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }}</title>
</head>
<body class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <header class="bg-white dark:bg-gray-800 shadow">
    <nav class="max-w-7xl mx-auto px-4 py-4">
      <Logo />
      <!-- Navigation items -->
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-8">
    <slot />
  </main>

  <footer class="bg-gray-100 dark:bg-gray-800 py-8">
    <div class="max-w-7xl mx-auto px-4 text-center text-gray-600">
      &copy; 2024 My App. All rights reserved.
    </div>
  </footer>
</body>
</html>
```

Using the layout in a view:

```html
<!-- resources/views/index.stx -->
<script server>
layout = 'Default'
</script>

<div class="space-y-8">
  <HelloWorld />

  <section>
    <h2 class="text-2xl font-bold mb-4">Welcome to My App</h2>
    <p class="text-gray-600">Build amazing things with Stacks.</p>
  </section>
</div>
```

## Complete Example: Task Manager

Let us build a simple task manager to demonstrate all concepts:

```html
<!-- resources/components/TaskItem.stx -->
<script server>
const task = props.task
const onToggle = props.onToggle
const onDelete = props.onDelete
</script>

<li class="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
  <input
    type="checkbox"
    checked="{{ task.completed }}"
    onchange="onToggle(task.id)"
    class="h-5 w-5 rounded border-gray-300"
  />

  <span class="{{ task.completed ? 'line-through text-gray-400' : 'text-gray-900' }} flex-1">
    {{ task.title }}
  </span>

  <button
    onclick="onDelete(task.id)"
    class="text-red-500 hover:text-red-700"
  >
    <i class="i-hugeicons-outline-trash h-5 w-5"></i>
  </button>
</li>
```

```html
<!-- resources/components/TaskList.stx -->
<script server>
import { ref } from '@stacksjs/reactivity'

const tasks = ref([
  { id: 1, title: 'Learn Stacks', completed: false },
  { id: 2, title: 'Build an app', completed: false },
  { id: 3, title: 'Deploy to production', completed: false },
])

const newTaskTitle = ref('')

function addTask() {
  if (newTaskTitle.value.trim()) {
    tasks.value.push({
      id: Date.now(),
      title: newTaskTitle.value,
      completed: false,
    })
    newTaskTitle.value = ''
  }
}

function toggleTask(id) {
  const task = tasks.value.find(t => t.id === id)
  if (task) {
    task.completed = !task.completed
  }
}

function deleteTask(id) {
  tasks.value = tasks.value.filter(t => t.id !== id)
}

const completedCount = computed(() =>
  tasks.value.filter(t => t.completed).length
)
</script>

<div class="max-w-md mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Task Manager</h1>

  <!-- Add Task Form -->
  <div class="flex gap-2 mb-6">
    <input
      type="text"
      value="{{ newTaskTitle.value }}"
      oninput="newTaskTitle.value = event.target.value"
      placeholder="Add a new task..."
      class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
    />
    <Button variant="solid" color="blue" onclick="addTask()">
      Add
    </Button>
  </div>

  <!-- Task List -->
  <ul class="space-y-2">
    @for(task of tasks.value)
      <TaskItem
        task="{{ task }}"
        onToggle="{{ toggleTask }}"
        onDelete="{{ deleteTask }}"
      />
    @endfor
  </ul>

  <!-- Summary -->
  <p class="mt-4 text-sm text-gray-600">
    {{ completedCount.value }} of {{ tasks.value.length }} tasks completed
  </p>
</div>
```

## Configuration

Configure your STX components in `stx.config.ts`:

```typescript
// stx.config.ts
export default {
  // Components directory - for user-defined components
  componentsDir: 'resources/components',

  // Layouts directory - for layout templates
  layoutsDir: 'resources/layouts',

  // Partials directory - for partial templates
  partialsDir: 'resources/partials',
}
```

## Next Steps

Now that you know how to build frontends with Stacks, continue to:

- [Build an API](/bootcamp/api) - Create backend endpoints for your frontend
- [Authentication How-To](/bootcamp/how-to/authentication) - Add user authentication
- [Testing How-To](/bootcamp/how-to/testing) - Write tests for your components

## Related Documentation

- [Components Guide](/basics/components)
- [Views Guide](/basics/views)
- [Routing Guide](/basics/routing)
