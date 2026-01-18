# Roadmap

This document outlines the planned development direction for Stacks. Our roadmap is community-driven and subject to change based on feedback and priorities.

## Current Focus

### v1.0 - Stable Foundation

The current focus is on stabilizing the core framework:

- **ORM** - Complete Eloquent-style ORM with migrations
- **Router** - Full-featured routing with middleware support
- **Authentication** - Complete auth system with social providers
- **Queue System** - Background job processing
- **CLI (Buddy)** - Comprehensive command-line tooling
- **Cloud Deployment** - AWS deployment automation

## Near Term

### Enhanced Developer Experience

- **Improved Error Messages** - Clear, actionable error output
- **IDE Integration** - Better VS Code extension support
- **Hot Module Replacement** - Faster development feedback
- **Dev Tools** - Browser extension for debugging

### Testing Improvements

- **Parallel Tests** - Run tests concurrently
- **Snapshot Testing** - Visual regression testing
- **Coverage Reporting** - Integrated code coverage
- **E2E Framework** - Built-in Playwright integration

### Documentation

- **Interactive Examples** - Live code playgrounds
- **Video Tutorials** - Step-by-step guides
- **API Reference** - Complete API documentation
- **Cookbook** - Common patterns and recipes

## Medium Term

### Performance

- **Build Optimization** - Faster production builds
- **Tree Shaking** - Better dead code elimination
- **Lazy Loading** - Component-level code splitting
- **SSR Streaming** - Streaming server-side rendering

### Framework Features

- **GraphQL Support** - Built-in GraphQL layer
- **WebSocket Abstraction** - Simplified real-time features
- **File Storage** - S3-compatible storage abstraction
- **Search** - Full-text search integration

### Multi-Platform

- **React Support** - First-class React integration
- **Svelte Support** - Svelte component libraries
- **React Native** - Mobile app support
- **Electron Alternative** - Lightweight desktop apps

## Long Term

### Ecosystem

- **Plugin System** - Community plugin marketplace
- **Starter Templates** - Project templates for common use cases
- **Component Library** - Official UI component library
- **Admin Dashboard** - Pre-built admin interface

### Infrastructure

- **Edge Functions** - Deploy to edge networks
- **Multi-Region** - Automatic multi-region deployment
- **Database Proxy** - Connection pooling and optimization
- **CDN Integration** - Built-in CDN configuration

### Enterprise

- **Team Features** - Collaboration tools
- **Audit Logging** - Compliance-ready logging
- **SSO Integration** - Enterprise authentication
- **Support Plans** - Commercial support options

## Completed

### Core Framework ✓

- [x] Project scaffolding
- [x] TypeScript configuration
- [x] ESLint and Prettier setup
- [x] Basic routing
- [x] Model definitions
- [x] Database migrations
- [x] Authentication basics

### Build System ✓

- [x] Vite integration
- [x] Component bundling
- [x] Function bundling
- [x] Type generation
- [x] Library builds

### Deployment ✓

- [x] AWS CDK integration
- [x] Lambda deployment
- [x] CloudFront distribution
- [x] Route 53 DNS

## How to Contribute

We welcome community input on our roadmap:

1. **Feature Requests** - Open an issue with `[Feature]` prefix
2. **Discussions** - Join our Discord for roadmap discussions
3. **Pull Requests** - Contribute directly to planned features
4. **Sponsorship** - Support development of specific features

## Versioning

Stacks follows [Semantic Versioning](https://semver.org/):

- **Major versions** (2.0, 3.0) - Breaking changes
- **Minor versions** (1.1, 1.2) - New features, backwards compatible
- **Patch versions** (1.0.1, 1.0.2) - Bug fixes only

## Release Schedule

- **Patch releases** - As needed for bug fixes
- **Minor releases** - Monthly feature releases
- **Major releases** - Annual major versions

## Stay Updated

- **GitHub** - Watch the repository for updates
- **Discord** - Join for real-time discussions
- **Twitter** - Follow [@stacksjs](https://twitter.com/stacksjs)
- **Blog** - Read release announcements
