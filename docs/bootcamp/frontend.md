# How to build a frontend?

Before getting started, it is important to understand a few fundamental concepts about "Stacks frontends" _which you will notice reused throughout Stacks ecosystem._

## Stacks UI Engine

The Stacks UI engine is responsible for rendering the UI of a Stacks codebase. It is designed to be framework-agnostic, meaning that the built results can be used with any JavaScript or TypeScript framework.

The UI engine is made up of two core responsibilities:

1. Rendering the Application
2. Rendering the Documentation

Now, let's diver deeper.

### The Application Frontend

The source of the application frontend lives in `./resources/views` and there are two ways to expose "views" (pages) to the server.

1. File-based routing
2. Laravel-like routing

By default, file-based routing enabled, but you may also choose to use a more traditional, Laravel-like router.

#### File-based Routing

File-based routing is the default routing strategy for Stacks. It is designed to be simple and intuitive. It is also a recommended routing strategy for most applications.

#### Laravel-like Routing

Laravel-like routing is an alternative routing strategy for Stacks applications. It is designed to be familiar to those who have used Laravel before. It is also the recommended routing strategy for applications that potentially require more complex routing.

At the end of the day, it is up to you to decide which routing strategy feels most intuitive to you and your environment. Stacks helps you get started with both.

### The Documentation Frontend

The source of the documentation frontend lives in `./docs`. Under the hood, Stacks is powered by [VitePress](https://vitepress.vuejs.org/), and, in short, the markdown files in `./docs` are compiled into a static website that is automatically served by the Stacks server.

wip

<!-- ## Stacks Components -->
