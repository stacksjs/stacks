// @bun
// /Users/glennmichaeltorregosa/Documents/Projects/stacks/.stacks/core/router/dist/index.js
import process2 from "process";
import fs from "fs";
import {promisify} from "util";
async function importMiddlewares(directory) {
  const middlewares = [];
  const files = await readdir(directory);
  for (const file of files) {
    const imported = await import(path.join(directory, file));
    middlewares.push(imported.default);
  }
  return middlewares;
}
import {extname as extname2} from "path";
import {URL} from "url";
var serverResponse = function(req) {
  const url = new URL(req.url);
  const foundRoute = routesList.find((route2) => {
    const pattern = new RegExp(`^${route2.uri.replace(/:\w+/g, "\\w+")}$`);
    return pattern.test(url.pathname);
  });
  if (url.pathname === "/favicon.ico")
    return new Response("");
  if (!foundRoute)
    return new Response("Not found", { status: 404 });
  addRouteParamsAndQuery(url, foundRoute);
  executeMiddleware(foundRoute);
  return execute(foundRoute, req, { statusCode: foundRoute?.statusCode });
};
var normalizeWindowsPath = function(input = "") {
  if (!input || !input.includes("\\")) {
    return input;
  }
  return input.replace(/\\/g, "/");
};
var cwd = function() {
  if (typeof process !== "undefined") {
    return process.cwd().replace(/\\/g, "/");
  }
  return "/";
};
var normalizeString = function(path2, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0;index <= path2.length; ++index) {
    if (index < path2.length) {
      char = path2[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1)
        ;
      else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path2.slice(lastSlash + 1, index)}`;
        } else {
          res = path2.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
};
var _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
var resolve = function(...arguments_) {
  arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let index = arguments_.length - 1;index >= -1 && !resolvedAbsolute; index--) {
    const path2 = index >= 0 ? arguments_[index] : cwd();
    if (!path2 || path2.length === 0) {
      continue;
    }
    resolvedPath = `${path2}/${resolvedPath}`;
    resolvedAbsolute = isAbsolute(path2);
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
  if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
};
var isAbsolute = function(p) {
  return _IS_ABSOLUTE_RE.test(p);
};
var appPath = function(path3) {
  return projectPath(`app/${path3 || ""}`);
};
var projectPath = function(filePath = "") {
  let path3 = process2.cwd();
  while (path3.includes(".stacks"))
    path3 = resolve(path3, "..");
  return resolve(path3, filePath);
};
var readdir = promisify(fs.readdir);
var middlewareDirectory = appPath("/app/middleware");
var middlewares = await importMiddlewares(middlewareDirectory);

class Request {
  query = {};
  params = null;
  addQuery(url) {
    this.query = Object.fromEntries(url.searchParams);
  }
  get(element) {
    return this.query[element];
  }
  all() {
    return this.query;
  }
  has(element) {
    return element in this.query;
  }
  isEmpty() {
    return Object.keys(this.query).length === 0;
  }
  extractParamsFromRoute(routePattern, pathname) {
    const pattern = new RegExp(`^${routePattern.replace(/:(\w+)/g, (match2, paramName) => `(?<${paramName}>\\w+)`)}$`);
    const match = pattern.exec(pathname);
    if (match?.groups)
      this.params = match?.groups;
  }
  getParams(key) {
    return this.params ? this.params[key] || null : null;
  }
}
var request = new Request;
var addRouteParamsAndQuery = function(url, route2) {
  if (!isObjectNotEmpty(url.searchParams))
    request.addQuery(url);
  request.extractParamsFromRoute(route2.uri, url.pathname);
};
var executeMiddleware = function(route2) {
  const { middleware: middleware2 = null } = route2;
  if (middleware2 && middlewares && isObjectNotEmpty(middlewares)) {
    if (isString(middleware2)) {
      const middlewareItem = middlewares.find((middlewareItem2) => {
        return middlewareItem2.name === middleware2;
      });
      if (middlewareItem)
        middlewareItem.handle();
    } else {
      middleware2.forEach((m) => {
        const middlewareItem = middlewares.find((middlewareItem2) => {
          return middlewareItem2.name === m;
        });
        if (middlewareItem)
          middlewareItem.handle();
      });
    }
  }
};
var execute = function(route2, request3, { statusCode }) {
  if (!statusCode)
    statusCode = 200;
  if (route2?.method === "GET" && (statusCode === 301 || statusCode === 302)) {
    const callback = String(route2.callback);
    const response = Response.redirect(callback, statusCode);
    return noCache(response);
  }
  if (route2?.method !== request3.method)
    return new Response("Method not allowed", { status: 405 });
  if (isString(route2.callback) && extname2(route2.callback) === ".html") {
    try {
      const fileContent = Bun.file(route2.callback);
      return new Response(fileContent, { headers: { "Content-Type": "text/html" } });
    } catch (error) {
      return new Response("Error reading the HTML file", { status: 500 });
    }
  }
  if (isString(route2.callback))
    return new Response(route2.callback);
  if (isFunction(route2.callback)) {
    const result = route2.callback();
    return new Response(JSON.stringify(result));
  }
  if (isObject(route2.callback))
    return new Response(JSON.stringify(route2.callback));
  return new Response("Unknown callback type.", { status: 500 });
};
var noCache = function(response) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
};
var isString = function(val) {
  return typeof val === "string";
};
var isObjectNotEmpty = function(obj) {
  return Object.keys(obj).length > 0;
};
var isFunction = function(val) {
  return typeof val === "function";
};
var isObject = function(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
};
var routesList = await route.getRoutes();

class Router {
  routes = [];
  addRoute(method, uri, callback, statusCode) {
    const name = uri.replace(/\//g, ".").replace(/:/g, "");
    const pattern = new RegExp(`^${uri.replace(/:[a-zA-Z]+/g, (match) => {
      return "([a-zA-Z0-9-]+)";
    })}$`);
    let routeCallback;
    if (typeof callback === "string" || typeof callback === "object") {
      routeCallback = () => callback;
    } else {
      routeCallback = callback;
    }
    this.routes.push({
      name,
      method,
      url: uri,
      uri,
      callback: routeCallback,
      pattern,
      statusCode,
      paramNames: []
    });
  }
  get(path5, callback) {
    this.addRoute("GET", path5, callback, 200);
    return this;
  }
  post(path5, callback) {
    this.addRoute("POST", path5, callback, 201);
    return this;
  }
  view(path5, callback) {
    this.addRoute("GET", path5, callback, 200);
    return this;
  }
  redirect(path5, callback, status) {
    this.addRoute("GET", path5, callback, 302);
    return this;
  }
  delete(path5, callback) {
    this.addRoute("DELETE", path5, callback, 204);
    return this;
  }
  patch(path5, callback) {
    this.addRoute("PATCH", path5, callback, 202);
    return this;
  }
  put(path5, callback) {
    this.addRoute("PUT", path5, callback, 202);
    return this;
  }
  group(options, callback) {
    let cb;
    if (typeof options === "function") {
      cb = options;
      options = {};
    } else {
      if (!callback)
        throw new Error("Missing callback function for route group.");
      cb = callback;
    }
    const { prefix = "", middleware: middleware3 = [] } = options;
    const originalRoutes = this.routes;
    this.routes = [];
    cb();
    this.routes.forEach((r) => {
      r.uri = `${prefix}${r.uri}`;
      if (middleware3.length)
        r.middleware = middleware3;
      originalRoutes.push(r);
      return this;
    });
    this.routes = originalRoutes;
    return this;
  }
  name(name) {
    this.routes[this.routes.length - 1].name = name;
    return this;
  }
  middleware(middleware3) {
    this.routes[this.routes.length - 1].middleware = middleware3;
    return this;
  }
  prefix(prefix) {
    this.routes[this.routes.length - 1].prefix = prefix;
    return this;
  }
  async getRoutes() {
    await import(projectPath("routes/web.ts"));
    return this.routes;
  }
}
var route = new Router;

// src/drivers/aws/runtime/server.ts
var server_default = {
  async fetch(request2, server) {
    console.log("Request", {
      url: request2.url,
      method: request2.method,
      headers: request2.headers.toJSON(),
      body: request2.body ? await request2.text() : null
    });
    if (server.upgrade(request2)) {
      console.log("WebSocket upgraded");
      return;
    }
    return serverResponse(request2);
  },
  websocket: {}
};
export {
  server_default as default
};
