/**
 * The pagination contract, which now lives in its own package.
 *
 * It moved because `@stacksjs/router` needs it too: the ORM builds a page of
 * rows, the router recognises one in a handler's return value and serializes
 * it. While the shape lived here, the router had to depend on the ORM to
 * recognise it - and the ORM depends on the router to register the routes its
 * models generate. Two packages depending on each other is a cycle no publish
 * order can satisfy, and it is half the reason the framework's release order
 * could not be made correct.
 *
 * Re-exported rather than moved outright so that `@stacksjs/orm` keeps
 * exporting `Paginator`, `toPaginator` and the rest: an application importing
 * them from here does not have to care that they are defined elsewhere now.
 */

export * from '@stacksjs/pagination'
