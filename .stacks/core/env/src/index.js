// @bun
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = (id) => {
  return import.meta.require(id);
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// /Users/glennmichaeltorregosa/Documents/Projects/stacks/node_modules/@stacksjs/env/src/index.ts
import {readFileSync, writeFileSync} from "fs";
import p from "process";
import {projectPath} from "@stacksjs/path";
import {ValidationBoolean, ValidationEnum, ValidationNumber} from "@stacksjs/validation";
function process() {
  return typeof Bun !== "undefined" ? Bun.env : p.env;
}
function writeEnv(key, value, options) {
  const envPath = options?.path || projectPath(".env");
  const env2 = readFileSync(envPath, "utf-8");
  const lines = env2.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index !== -1)
    lines[index] = `${key}=${value}`;
  else
    lines.push(`${key}=${value}`);
  writeFileSync(envPath, lines.join("\n"));
}

// /Users/glennmichaeltorregosa/Documents/Projects/stacks/.stacks/core/env/src/types.ts
import {validator} from "@stacksjs/validation";

// /Users/glennmichaeltorregosa/Documents/Projects/stacks/config/env.ts
import {validate} from "@stacksjs/validation";
var env_default = {
  APP_NAME: validate.string(),
  APP_ENV: validate.enum(["development", "staging", "production"]),
  APP_KEY: validate.string(),
  APP_URL: validate.string(),
  DEBUG: validate.boolean(),
  API_PREFIX: validate.string(),
  DOCS_PREFIX: validate.string(),
  DB_CONNECTION: validate.enum(["mysql", "sqlite", "postgres", "planetscale"]),
  DB_HOST: validate.string(),
  DB_PORT: validate.number(),
  DB_DATABASE: validate.string(),
  DB_USERNAME: validate.string(),
  DB_PASSWORD: validate.string(),
  AWS_ACCOUNT_ID: validate.string(),
  AWS_ACCESS_KEY_ID: validate.string(),
  AWS_SECRET_ACCESS_KEY: validate.string(),
  AWS_DEFAULT_REGION: validate.string(),
  AWS_DEFAULT_PASSWORD: validate.string(),
  MAIL_MAILER: validate.enum(["smtp", "mailgun", "ses", "postmark", "sendmail", "log"]),
  MAIL_HOST: validate.string(),
  MAIL_PORT: validate.number(),
  MAIL_USERNAME: validate.string(),
  MAIL_PASSWORD: validate.string(),
  MAIL_ENCRYPTION: validate.string(),
  MAIL_FROM_NAME: validate.string(),
  MAIL_FROM_ADDRESS: validate.string(),
  SEARCH_ENGINE_DRIVER: validate.enum(["meilisearch", "algolia", "typesense"]),
  MEILISEARCH_HOST: validate.string(),
  MEILISEARCH_KEY: validate.string(),
  FRONTEND_APP_ENV: validate.enum(["development", "staging", "production"]),
  FRONTEND_APP_URL: validate.string()
};

// /Users/glennmichaeltorregosa/Documents/Projects/stacks/.stacks/core/env/src/types.ts
var envStructure = Object.entries(env_default).reduce((acc, [key, value]) => {
  let validatorType;
  switch (typeof value) {
    case "string":
      validatorType = validator.string();
      break;
    case "number":
      validatorType = validator.number();
      break;
    case "boolean":
      validatorType = validator.boolean();
      break;
    default:
      if (Array.isArray(value)) {
        validatorType = validator.enum(value);
        break;
      }
      throw new Error(`Invalid env value for ${key}`);
  }
  const envKey = key;
  acc[envKey] = validatorType;
  return acc;
}, {});
var envSchema = validator.object(envStructure);

// /Users/glennmichaeltorregosa/Documents/Projects/stacks/node_modules/@stacksjs/env/src/index.ts
var enums = {
  APP_ENV: ["local", "dev", "development", "staging", "prod", "production"],
  DB_CONNECTION: ["mysql", "sqlite", "postgres", "planetscale"],
  MAIL_MAILER: ["smtp", "mailgun", "ses", "postmark", "sendmail", "log"],
  SEARCH_ENGINE_DRIVER: ["meilisearch", "algolia", "typesense"],
  FRONTEND_APP_ENV: ["development", "staging", "production"]
};
var handler = {
  get: (target, key) => {
    const value = target[key];
    if (value instanceof ValidationEnum)
      return target[key];
    if (value instanceof ValidationBoolean)
      return !!target[key];
    if (value instanceof ValidationNumber)
      return Number(target[key]);
    return value;
  }
};
var env2 = new Proxy(process(), handler);
export {
  writeEnv,
  process,
  envSchema,
  env2 as env,
  enums
};

export { __toESM, __commonJS, __require, __export, env2 as env };
