import ae, { resolve as Yi } from "path";
var Z = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Ui(e) {
  var t = e.default;
  if (typeof t == "function") {
    var i = function() {
      return t.apply(this, arguments);
    };
    i.prototype = t.prototype;
  } else
    i = {};
  return Object.defineProperty(i, "__esModule", { value: !0 }), Object.keys(e).forEach(function(r) {
    var n = Object.getOwnPropertyDescriptor(e, r);
    Object.defineProperty(i, r, n.get ? n : {
      enumerable: !0,
      get: function() {
        return e[r];
      }
    });
  }), i;
}
var re = { exports: {} }, J = typeof Reflect == "object" ? Reflect : null, Nt = J && typeof J.apply == "function" ? J.apply : function(t, i, r) {
  return Function.prototype.apply.call(t, i, r);
}, ne;
J && typeof J.ownKeys == "function" ? ne = J.ownKeys : Object.getOwnPropertySymbols ? ne = function(t) {
  return Object.getOwnPropertyNames(t).concat(Object.getOwnPropertySymbols(t));
} : ne = function(t) {
  return Object.getOwnPropertyNames(t);
};
function Wi(e) {
  console && console.warn && console.warn(e);
}
var di = Number.isNaN || function(t) {
  return t !== t;
};
function M() {
  M.init.call(this);
}
re.exports = M;
re.exports.once = Ji;
M.EventEmitter = M;
M.prototype._events = void 0;
M.prototype._eventsCount = 0;
M.prototype._maxListeners = void 0;
var Ht = 10;
function le(e) {
  if (typeof e != "function")
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof e);
}
Object.defineProperty(M, "defaultMaxListeners", {
  enumerable: !0,
  get: function() {
    return Ht;
  },
  set: function(e) {
    if (typeof e != "number" || e < 0 || di(e))
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + e + ".");
    Ht = e;
  }
});
M.init = function() {
  (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
};
M.prototype.setMaxListeners = function(t) {
  if (typeof t != "number" || t < 0 || di(t))
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + t + ".");
  return this._maxListeners = t, this;
};
function fi(e) {
  return e._maxListeners === void 0 ? M.defaultMaxListeners : e._maxListeners;
}
M.prototype.getMaxListeners = function() {
  return fi(this);
};
M.prototype.emit = function(t) {
  for (var i = [], r = 1; r < arguments.length; r++)
    i.push(arguments[r]);
  var n = t === "error", a = this._events;
  if (a !== void 0)
    n = n && a.error === void 0;
  else if (!n)
    return !1;
  if (n) {
    var s;
    if (i.length > 0 && (s = i[0]), s instanceof Error)
      throw s;
    var d = new Error("Unhandled error." + (s ? " (" + s.message + ")" : ""));
    throw d.context = s, d;
  }
  var l = a[t];
  if (l === void 0)
    return !1;
  if (typeof l == "function")
    Nt(l, this, i);
  else
    for (var u = l.length, o = yi(l, u), r = 0; r < u; ++r)
      Nt(o[r], this, i);
  return !0;
};
function pi(e, t, i, r) {
  var n, a, s;
  if (le(i), a = e._events, a === void 0 ? (a = e._events = /* @__PURE__ */ Object.create(null), e._eventsCount = 0) : (a.newListener !== void 0 && (e.emit(
    "newListener",
    t,
    i.listener ? i.listener : i
  ), a = e._events), s = a[t]), s === void 0)
    s = a[t] = i, ++e._eventsCount;
  else if (typeof s == "function" ? s = a[t] = r ? [i, s] : [s, i] : r ? s.unshift(i) : s.push(i), n = fi(e), n > 0 && s.length > n && !s.warned) {
    s.warned = !0;
    var d = new Error("Possible EventEmitter memory leak detected. " + s.length + " " + String(t) + " listeners added. Use emitter.setMaxListeners() to increase limit");
    d.name = "MaxListenersExceededWarning", d.emitter = e, d.type = t, d.count = s.length, Wi(d);
  }
  return e;
}
M.prototype.addListener = function(t, i) {
  return pi(this, t, i, !1);
};
M.prototype.on = M.prototype.addListener;
M.prototype.prependListener = function(t, i) {
  return pi(this, t, i, !0);
};
function Gi() {
  if (!this.fired)
    return this.target.removeListener(this.type, this.wrapFn), this.fired = !0, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
}
function mi(e, t, i) {
  var r = { fired: !1, wrapFn: void 0, target: e, type: t, listener: i }, n = Gi.bind(r);
  return n.listener = i, r.wrapFn = n, n;
}
M.prototype.once = function(t, i) {
  return le(i), this.on(t, mi(this, t, i)), this;
};
M.prototype.prependOnceListener = function(t, i) {
  return le(i), this.prependListener(t, mi(this, t, i)), this;
};
M.prototype.removeListener = function(t, i) {
  var r, n, a, s, d;
  if (le(i), n = this._events, n === void 0)
    return this;
  if (r = n[t], r === void 0)
    return this;
  if (r === i || r.listener === i)
    --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete n[t], n.removeListener && this.emit("removeListener", t, r.listener || i));
  else if (typeof r != "function") {
    for (a = -1, s = r.length - 1; s >= 0; s--)
      if (r[s] === i || r[s].listener === i) {
        d = r[s].listener, a = s;
        break;
      }
    if (a < 0)
      return this;
    a === 0 ? r.shift() : zi(r, a), r.length === 1 && (n[t] = r[0]), n.removeListener !== void 0 && this.emit("removeListener", t, d || i);
  }
  return this;
};
M.prototype.off = M.prototype.removeListener;
M.prototype.removeAllListeners = function(t) {
  var i, r, n;
  if (r = this._events, r === void 0)
    return this;
  if (r.removeListener === void 0)
    return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : r[t] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete r[t]), this;
  if (arguments.length === 0) {
    var a = Object.keys(r), s;
    for (n = 0; n < a.length; ++n)
      s = a[n], s !== "removeListener" && this.removeAllListeners(s);
    return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
  }
  if (i = r[t], typeof i == "function")
    this.removeListener(t, i);
  else if (i !== void 0)
    for (n = i.length - 1; n >= 0; n--)
      this.removeListener(t, i[n]);
  return this;
};
function gi(e, t, i) {
  var r = e._events;
  if (r === void 0)
    return [];
  var n = r[t];
  return n === void 0 ? [] : typeof n == "function" ? i ? [n.listener || n] : [n] : i ? Ki(n) : yi(n, n.length);
}
M.prototype.listeners = function(t) {
  return gi(this, t, !0);
};
M.prototype.rawListeners = function(t) {
  return gi(this, t, !1);
};
M.listenerCount = function(e, t) {
  return typeof e.listenerCount == "function" ? e.listenerCount(t) : vi.call(e, t);
};
M.prototype.listenerCount = vi;
function vi(e) {
  var t = this._events;
  if (t !== void 0) {
    var i = t[e];
    if (typeof i == "function")
      return 1;
    if (i !== void 0)
      return i.length;
  }
  return 0;
}
M.prototype.eventNames = function() {
  return this._eventsCount > 0 ? ne(this._events) : [];
};
function yi(e, t) {
  for (var i = new Array(t), r = 0; r < t; ++r)
    i[r] = e[r];
  return i;
}
function zi(e, t) {
  for (; t + 1 < e.length; t++)
    e[t] = e[t + 1];
  e.pop();
}
function Ki(e) {
  for (var t = new Array(e.length), i = 0; i < t.length; ++i)
    t[i] = e[i].listener || e[i];
  return t;
}
function Ji(e, t) {
  return new Promise(function(i, r) {
    function n(s) {
      e.removeListener(t, a), r(s);
    }
    function a() {
      typeof e.removeListener == "function" && e.removeListener("error", n), i([].slice.call(arguments));
    }
    bi(e, t, a, { once: !0 }), t !== "error" && Zi(e, n, { once: !0 });
  });
}
function Zi(e, t, i) {
  typeof e.on == "function" && bi(e, "error", t, i);
}
function bi(e, t, i, r) {
  if (typeof e.on == "function")
    r.once ? e.once(t, i) : e.on(t, i);
  else if (typeof e.addEventListener == "function")
    e.addEventListener(t, function n(a) {
      r.once && e.removeEventListener(t, n), i(a);
    });
  else
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof e);
}
function he(e) {
  return e == null ? [] : Array.isArray(e) ? e : [e];
}
function Xi(e, t, i, r) {
  var n, a = e[t], s = ~r.string.indexOf(t) ? i == null || i === !0 ? "" : String(i) : typeof i == "boolean" ? i : ~r.boolean.indexOf(t) ? i === "false" ? !1 : i === "true" || (e._.push((n = +i, n * 0 === 0 ? n : i)), !!i) : (n = +i, n * 0 === 0 ? n : i);
  e[t] = a == null ? s : Array.isArray(a) ? a.concat(s) : [a, s];
}
function Qi(e, t) {
  e = e || [], t = t || {};
  var i, r, n, a, s, d = { _: [] }, l = 0, u = 0, o = 0, p = e.length;
  const h = t.alias !== void 0, c = t.unknown !== void 0, m = t.default !== void 0;
  if (t.alias = t.alias || {}, t.string = he(t.string), t.boolean = he(t.boolean), h)
    for (i in t.alias)
      for (r = t.alias[i] = he(t.alias[i]), l = 0; l < r.length; l++)
        (t.alias[r[l]] = r.concat(i)).splice(l, 1);
  for (l = t.boolean.length; l-- > 0; )
    for (r = t.alias[t.boolean[l]] || [], u = r.length; u-- > 0; )
      t.boolean.push(r[u]);
  for (l = t.string.length; l-- > 0; )
    for (r = t.alias[t.string[l]] || [], u = r.length; u-- > 0; )
      t.string.push(r[u]);
  if (m) {
    for (i in t.default)
      if (a = typeof t.default[i], r = t.alias[i] = t.alias[i] || [], t[a] !== void 0)
        for (t[a].push(i), l = 0; l < r.length; l++)
          t[a].push(r[l]);
  }
  const x = c ? Object.keys(t.alias) : [];
  for (l = 0; l < p; l++) {
    if (n = e[l], n === "--") {
      d._ = d._.concat(e.slice(++l));
      break;
    }
    for (u = 0; u < n.length && n.charCodeAt(u) === 45; u++)
      ;
    if (u === 0)
      d._.push(n);
    else if (n.substring(u, u + 3) === "no-") {
      if (a = n.substring(u + 3), c && !~x.indexOf(a))
        return t.unknown(n);
      d[a] = !1;
    } else {
      for (o = u + 1; o < n.length && n.charCodeAt(o) !== 61; o++)
        ;
      for (a = n.substring(u, o), s = n.substring(++o) || l + 1 === p || ("" + e[l + 1]).charCodeAt(0) === 45 || e[++l], r = u === 2 ? [a] : a, o = 0; o < r.length; o++) {
        if (a = r[o], c && !~x.indexOf(a))
          return t.unknown("-".repeat(u) + a);
        Xi(d, a, o + 1 < r.length || s, t);
      }
    }
  }
  if (m)
    for (i in t.default)
      d[i] === void 0 && (d[i] = t.default[i]);
  if (h)
    for (i in d)
      for (r = t.alias[i] || []; r.length > 0; )
        d[r.shift()] = d[i];
  return d;
}
const wi = (e) => e.replace(/[<[].+/, "").trim(), es = (e) => {
  const t = /<([^>]+)>/g, i = /\[([^\]]+)\]/g, r = [], n = (d) => {
    let l = !1, u = d[1];
    return u.startsWith("...") && (u = u.slice(3), l = !0), {
      required: d[0].startsWith("<"),
      value: u,
      variadic: l
    };
  };
  let a;
  for (; a = t.exec(e); )
    r.push(n(a));
  let s;
  for (; s = i.exec(e); )
    r.push(n(s));
  return r;
}, ts = (e) => {
  const t = { alias: {}, boolean: [] };
  for (const [i, r] of e.entries())
    r.names.length > 1 && (t.alias[r.names[0]] = r.names.slice(1)), r.isBoolean && (r.negated && e.some((a, s) => s !== i && a.names.some((d) => r.names.includes(d)) && typeof a.required == "boolean") || t.boolean.push(r.names[0]));
  return t;
}, Bt = (e) => e.sort((t, i) => t.length > i.length ? -1 : 1)[0], Vt = (e, t) => e.length >= t ? e : `${e}${" ".repeat(t - e.length)}`, rs = (e) => e.replace(/([a-z])-([a-z])/g, (t, i, r) => i + r.toUpperCase()), is = (e, t, i) => {
  let r = 0, n = t.length, a = e, s;
  for (; r < n; ++r)
    s = a[t[r]], a = a[t[r]] = r === n - 1 ? i : s != null ? s : !!~t[r + 1].indexOf(".") || !(+t[r + 1] > -1) ? {} : [];
}, ss = (e, t) => {
  for (const i of Object.keys(t)) {
    const r = t[i];
    r.shouldTransform && (e[i] = Array.prototype.concat.call([], e[i]), typeof r.transformFunction == "function" && (e[i] = e[i].map(r.transformFunction)));
  }
}, ns = (e) => {
  const t = /([^\\\/]+)$/.exec(e);
  return t ? t[1] : "";
}, xi = (e) => e.split(".").map((t, i) => i === 0 ? rs(t) : t).join(".");
class ce extends Error {
  constructor(t) {
    super(t), this.name = this.constructor.name, typeof Error.captureStackTrace == "function" ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error(t).stack;
  }
}
class os {
  constructor(t, i, r) {
    this.rawName = t, this.description = i, this.config = Object.assign({}, r), t = t.replace(/\.\*/g, ""), this.negated = !1, this.names = wi(t).split(",").map((n) => {
      let a = n.trim().replace(/^-{1,2}/, "");
      return a.startsWith("no-") && (this.negated = !0, a = a.replace(/^no-/, "")), xi(a);
    }).sort((n, a) => n.length > a.length ? 1 : -1), this.name = this.names[this.names.length - 1], this.negated && this.config.default == null && (this.config.default = !0), t.includes("<") ? this.required = !0 : t.includes("[") ? this.required = !1 : this.isBoolean = !0;
  }
}
const as = process.argv, ls = `${process.platform}-${process.arch} node-${process.version}`;
class Si {
  constructor(t, i, r = {}, n) {
    this.rawName = t, this.description = i, this.config = r, this.cli = n, this.options = [], this.aliasNames = [], this.name = wi(t), this.args = es(t), this.examples = [];
  }
  usage(t) {
    return this.usageText = t, this;
  }
  allowUnknownOptions() {
    return this.config.allowUnknownOptions = !0, this;
  }
  ignoreOptionDefaultValue() {
    return this.config.ignoreOptionDefaultValue = !0, this;
  }
  version(t, i = "-v, --version") {
    return this.versionNumber = t, this.option(i, "Display version number"), this;
  }
  example(t) {
    return this.examples.push(t), this;
  }
  option(t, i, r) {
    const n = new os(t, i, r);
    return this.options.push(n), this;
  }
  alias(t) {
    return this.aliasNames.push(t), this;
  }
  action(t) {
    return this.commandAction = t, this;
  }
  isMatched(t) {
    return this.name === t || this.aliasNames.includes(t);
  }
  get isDefaultCommand() {
    return this.name === "" || this.aliasNames.includes("!");
  }
  get isGlobalCommand() {
    return this instanceof Oi;
  }
  hasOption(t) {
    return t = t.split(".")[0], this.options.find((i) => i.names.includes(t));
  }
  outputHelp() {
    const { name: t, commands: i } = this.cli, {
      versionNumber: r,
      options: n,
      helpCallback: a
    } = this.cli.globalCommand;
    let s = [
      {
        body: `${t}${r ? `/${r}` : ""}`
      }
    ];
    if (s.push({
      title: "Usage",
      body: `  $ ${t} ${this.usageText || this.rawName}`
    }), (this.isGlobalCommand || this.isDefaultCommand) && i.length > 0) {
      const u = Bt(i.map((o) => o.rawName));
      s.push({
        title: "Commands",
        body: i.map((o) => `  ${Vt(o.rawName, u.length)}  ${o.description}`).join(`
`)
      }), s.push({
        title: "For more info, run any command with the `--help` flag",
        body: i.map((o) => `  $ ${t}${o.name === "" ? "" : ` ${o.name}`} --help`).join(`
`)
      });
    }
    let l = this.isGlobalCommand ? n : [...this.options, ...n || []];
    if (!this.isGlobalCommand && !this.isDefaultCommand && (l = l.filter((u) => u.name !== "version")), l.length > 0) {
      const u = Bt(l.map((o) => o.rawName));
      s.push({
        title: "Options",
        body: l.map((o) => `  ${Vt(o.rawName, u.length)}  ${o.description} ${o.config.default === void 0 ? "" : `(default: ${o.config.default})`}`).join(`
`)
      });
    }
    this.examples.length > 0 && s.push({
      title: "Examples",
      body: this.examples.map((u) => typeof u == "function" ? u(t) : u).join(`
`)
    }), a && (s = a(s) || s), console.log(s.map((u) => u.title ? `${u.title}:
${u.body}` : u.body).join(`

`));
  }
  outputVersion() {
    const { name: t } = this.cli, { versionNumber: i } = this.cli.globalCommand;
    i && console.log(`${t}/${i} ${ls}`);
  }
  checkRequiredArgs() {
    const t = this.args.filter((i) => i.required).length;
    if (this.cli.args.length < t)
      throw new ce(`missing required args for command \`${this.rawName}\``);
  }
  checkUnknownOptions() {
    const { options: t, globalCommand: i } = this.cli;
    if (!this.config.allowUnknownOptions) {
      for (const r of Object.keys(t))
        if (r !== "--" && !this.hasOption(r) && !i.hasOption(r))
          throw new ce(`Unknown option \`${r.length > 1 ? `--${r}` : `-${r}`}\``);
    }
  }
  checkOptionValue() {
    const { options: t, globalCommand: i } = this.cli, r = [...i.options, ...this.options];
    for (const n of r) {
      const a = t[n.name.split(".")[0]];
      if (n.required) {
        const s = r.some((d) => d.negated && d.names.includes(n.name));
        if (a === !0 || a === !1 && !s)
          throw new ce(`option \`${n.rawName}\` value is missing`);
      }
    }
  }
}
class Oi extends Si {
  constructor(t) {
    super("@@global@@", "", {}, t);
  }
}
var ie = Object.assign;
class us extends re.exports.EventEmitter {
  constructor(t = "") {
    super(), this.name = t, this.commands = [], this.rawArgs = [], this.args = [], this.options = {}, this.globalCommand = new Oi(this), this.globalCommand.usage("<command> [options]");
  }
  usage(t) {
    return this.globalCommand.usage(t), this;
  }
  command(t, i, r) {
    const n = new Si(t, i || "", r, this);
    return n.globalCommand = this.globalCommand, this.commands.push(n), n;
  }
  option(t, i, r) {
    return this.globalCommand.option(t, i, r), this;
  }
  help(t) {
    return this.globalCommand.option("-h, --help", "Display this message"), this.globalCommand.helpCallback = t, this.showHelpOnExit = !0, this;
  }
  version(t, i = "-v, --version") {
    return this.globalCommand.version(t, i), this.showVersionOnExit = !0, this;
  }
  example(t) {
    return this.globalCommand.example(t), this;
  }
  outputHelp() {
    this.matchedCommand ? this.matchedCommand.outputHelp() : this.globalCommand.outputHelp();
  }
  outputVersion() {
    this.globalCommand.outputVersion();
  }
  setParsedInfo({ args: t, options: i }, r, n) {
    return this.args = t, this.options = i, r && (this.matchedCommand = r), n && (this.matchedCommandName = n), this;
  }
  unsetMatchedCommand() {
    this.matchedCommand = void 0, this.matchedCommandName = void 0;
  }
  parse(t = as, {
    run: i = !0
  } = {}) {
    this.rawArgs = t, this.name || (this.name = t[1] ? ns(t[1]) : "cli");
    let r = !0;
    for (const a of this.commands) {
      const s = this.mri(t.slice(2), a), d = s.args[0];
      if (a.isMatched(d)) {
        r = !1;
        const l = ie(ie({}, s), {
          args: s.args.slice(1)
        });
        this.setParsedInfo(l, a, d), this.emit(`command:${d}`, a);
      }
    }
    if (r) {
      for (const a of this.commands)
        if (a.name === "") {
          r = !1;
          const s = this.mri(t.slice(2), a);
          this.setParsedInfo(s, a), this.emit("command:!", a);
        }
    }
    if (r) {
      const a = this.mri(t.slice(2));
      this.setParsedInfo(a);
    }
    this.options.help && this.showHelpOnExit && (this.outputHelp(), i = !1, this.unsetMatchedCommand()), this.options.version && this.showVersionOnExit && this.matchedCommandName == null && (this.outputVersion(), i = !1, this.unsetMatchedCommand());
    const n = { args: this.args, options: this.options };
    return i && this.runMatchedCommand(), !this.matchedCommand && this.args[0] && this.emit("command:*"), n;
  }
  mri(t, i) {
    const r = [
      ...this.globalCommand.options,
      ...i ? i.options : []
    ], n = ts(r);
    let a = [];
    const s = t.indexOf("--");
    s > -1 && (a = t.slice(s + 1), t = t.slice(0, s));
    let d = Qi(t, n);
    d = Object.keys(d).reduce((h, c) => ie(ie({}, h), {
      [xi(c)]: d[c]
    }), { _: [] });
    const l = d._, u = {
      "--": a
    }, o = i && i.config.ignoreOptionDefaultValue ? i.config.ignoreOptionDefaultValue : this.globalCommand.config.ignoreOptionDefaultValue;
    let p = /* @__PURE__ */ Object.create(null);
    for (const h of r) {
      if (!o && h.config.default !== void 0)
        for (const c of h.names)
          u[c] = h.config.default;
      Array.isArray(h.config.type) && p[h.name] === void 0 && (p[h.name] = /* @__PURE__ */ Object.create(null), p[h.name].shouldTransform = !0, p[h.name].transformFunction = h.config.type[0]);
    }
    for (const h of Object.keys(d))
      if (h !== "_") {
        const c = h.split(".");
        is(u, c, d[h]), ss(u, p);
      }
    return {
      args: l,
      options: u
    };
  }
  runMatchedCommand() {
    const { args: t, options: i, matchedCommand: r } = this;
    if (!r || !r.commandAction)
      return;
    r.checkUnknownOptions(), r.checkOptionValue(), r.checkRequiredArgs();
    const n = [];
    return r.args.forEach((a, s) => {
      a.variadic ? n.push(t.slice(s)) : n.push(t[s]);
    }), n.push(i), r.commandAction.apply(this, n);
  }
}
const hs = (e = "") => new us(e), N = "0.23.0";
var de = {}, fe, Yt;
function P() {
  if (Yt)
    return fe;
  Yt = 1;
  const { FORCE_COLOR: e, NODE_DISABLE_COLORS: t, TERM: i } = process.env, r = {
    enabled: !t && i !== "dumb" && e !== "0",
    reset: s(0, 0),
    bold: s(1, 22),
    dim: s(2, 22),
    italic: s(3, 23),
    underline: s(4, 24),
    inverse: s(7, 27),
    hidden: s(8, 28),
    strikethrough: s(9, 29),
    black: s(30, 39),
    red: s(31, 39),
    green: s(32, 39),
    yellow: s(33, 39),
    blue: s(34, 39),
    magenta: s(35, 39),
    cyan: s(36, 39),
    white: s(37, 39),
    gray: s(90, 39),
    grey: s(90, 39),
    bgBlack: s(40, 49),
    bgRed: s(41, 49),
    bgGreen: s(42, 49),
    bgYellow: s(43, 49),
    bgBlue: s(44, 49),
    bgMagenta: s(45, 49),
    bgCyan: s(46, 49),
    bgWhite: s(47, 49)
  };
  function n(d, l) {
    let u = 0, o, p = "", h = "";
    for (; u < d.length; u++)
      o = d[u], p += o.open, h += o.close, l.includes(o.close) && (l = l.replace(o.rgx, o.close + o.open));
    return p + l + h;
  }
  function a(d, l) {
    let u = { has: d, keys: l };
    return u.reset = r.reset.bind(u), u.bold = r.bold.bind(u), u.dim = r.dim.bind(u), u.italic = r.italic.bind(u), u.underline = r.underline.bind(u), u.inverse = r.inverse.bind(u), u.hidden = r.hidden.bind(u), u.strikethrough = r.strikethrough.bind(u), u.black = r.black.bind(u), u.red = r.red.bind(u), u.green = r.green.bind(u), u.yellow = r.yellow.bind(u), u.blue = r.blue.bind(u), u.magenta = r.magenta.bind(u), u.cyan = r.cyan.bind(u), u.white = r.white.bind(u), u.gray = r.gray.bind(u), u.grey = r.grey.bind(u), u.bgBlack = r.bgBlack.bind(u), u.bgRed = r.bgRed.bind(u), u.bgGreen = r.bgGreen.bind(u), u.bgYellow = r.bgYellow.bind(u), u.bgBlue = r.bgBlue.bind(u), u.bgMagenta = r.bgMagenta.bind(u), u.bgCyan = r.bgCyan.bind(u), u.bgWhite = r.bgWhite.bind(u), u;
  }
  function s(d, l) {
    let u = {
      open: `\x1B[${d}m`,
      close: `\x1B[${l}m`,
      rgx: new RegExp(`\\x1b\\[${l}m`, "g")
    };
    return function(o) {
      return this !== void 0 && this.has !== void 0 ? (this.has.includes(d) || (this.has.push(d), this.keys.push(u)), o === void 0 ? this : r.enabled ? n(this.keys, o + "") : o + "") : o === void 0 ? a([d], [u]) : r.enabled ? n([u], o + "") : o + "";
    };
  }
  return fe = r, fe;
}
const $i = {}, cs = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: $i
}, Symbol.toStringTag, { value: "Module" })), X = /* @__PURE__ */ Ui(cs);
var pe, Ut;
function ds() {
  return Ut || (Ut = 1, pe = (e, t) => {
    if (!(e.meta && e.name !== "escape")) {
      if (e.ctrl) {
        if (e.name === "a")
          return "first";
        if (e.name === "c" || e.name === "d")
          return "abort";
        if (e.name === "e")
          return "last";
        if (e.name === "g")
          return "reset";
      }
      if (t) {
        if (e.name === "j")
          return "down";
        if (e.name === "k")
          return "up";
      }
      return e.name === "return" || e.name === "enter" ? "submit" : e.name === "backspace" ? "delete" : e.name === "delete" ? "deleteForward" : e.name === "abort" ? "abort" : e.name === "escape" ? "exit" : e.name === "tab" ? "next" : e.name === "pagedown" ? "nextPage" : e.name === "pageup" ? "prevPage" : e.name === "home" ? "home" : e.name === "end" ? "end" : e.name === "up" ? "up" : e.name === "down" ? "down" : e.name === "right" ? "right" : e.name === "left" ? "left" : !1;
    }
  }), pe;
}
var me, Wt;
function Et() {
  return Wt || (Wt = 1, me = (e) => {
    const t = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"].join("|"), i = new RegExp(t, "g");
    return typeof e == "string" ? e.replace(i, "") : e;
  }), me;
}
var ge, Gt;
function E() {
  if (Gt)
    return ge;
  Gt = 1;
  const e = "\x1B", t = `${e}[`, i = "\x07", r = {
    to(s, d) {
      return d ? `${t}${d + 1};${s + 1}H` : `${t}${s + 1}G`;
    },
    move(s, d) {
      let l = "";
      return s < 0 ? l += `${t}${-s}D` : s > 0 && (l += `${t}${s}C`), d < 0 ? l += `${t}${-d}A` : d > 0 && (l += `${t}${d}B`), l;
    },
    up: (s = 1) => `${t}${s}A`,
    down: (s = 1) => `${t}${s}B`,
    forward: (s = 1) => `${t}${s}C`,
    backward: (s = 1) => `${t}${s}D`,
    nextLine: (s = 1) => `${t}E`.repeat(s),
    prevLine: (s = 1) => `${t}F`.repeat(s),
    left: `${t}G`,
    hide: `${t}?25l`,
    show: `${t}?25h`,
    save: `${e}7`,
    restore: `${e}8`
  }, n = {
    up: (s = 1) => `${t}S`.repeat(s),
    down: (s = 1) => `${t}T`.repeat(s)
  }, a = {
    screen: `${t}2J`,
    up: (s = 1) => `${t}1J`.repeat(s),
    down: (s = 1) => `${t}J`.repeat(s),
    line: `${t}2K`,
    lineEnd: `${t}K`,
    lineStart: `${t}1K`,
    lines(s) {
      let d = "";
      for (let l = 0; l < s; l++)
        d += this.line + (l < s - 1 ? r.up() : "");
      return s && (d += r.left), d;
    }
  };
  return ge = { cursor: r, scroll: n, erase: a, beep: i }, ge;
}
var ve, zt;
function fs() {
  if (zt)
    return ve;
  zt = 1;
  function e(l, u) {
    var o = typeof Symbol < "u" && l[Symbol.iterator] || l["@@iterator"];
    if (!o) {
      if (Array.isArray(l) || (o = t(l)) || u && l && typeof l.length == "number") {
        o && (l = o);
        var p = 0, h = function() {
        };
        return { s: h, n: function() {
          return p >= l.length ? { done: !0 } : { done: !1, value: l[p++] };
        }, e: function(g) {
          throw g;
        }, f: h };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var c = !0, m = !1, x;
    return { s: function() {
      o = o.call(l);
    }, n: function() {
      var g = o.next();
      return c = g.done, g;
    }, e: function(g) {
      m = !0, x = g;
    }, f: function() {
      try {
        !c && o.return != null && o.return();
      } finally {
        if (m)
          throw x;
      }
    } };
  }
  function t(l, u) {
    if (!!l) {
      if (typeof l == "string")
        return i(l, u);
      var o = Object.prototype.toString.call(l).slice(8, -1);
      if (o === "Object" && l.constructor && (o = l.constructor.name), o === "Map" || o === "Set")
        return Array.from(l);
      if (o === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o))
        return i(l, u);
    }
  }
  function i(l, u) {
    (u == null || u > l.length) && (u = l.length);
    for (var o = 0, p = new Array(u); o < u; o++)
      p[o] = l[o];
    return p;
  }
  const r = Et(), n = E(), a = n.erase, s = n.cursor, d = (l) => [...r(l)].length;
  return ve = function(l, u) {
    if (!u)
      return a.line + s.to(0);
    let o = 0;
    const p = l.split(/\r?\n/);
    var h = e(p), c;
    try {
      for (h.s(); !(c = h.n()).done; ) {
        let m = c.value;
        o += 1 + Math.floor(Math.max(d(m) - 1, 0) / u);
      }
    } catch (m) {
      h.e(m);
    } finally {
      h.f();
    }
    return a.lines(o);
  }, ve;
}
var ye, Kt;
function _i() {
  if (Kt)
    return ye;
  Kt = 1;
  const e = {
    arrowUp: "\u2191",
    arrowDown: "\u2193",
    arrowLeft: "\u2190",
    arrowRight: "\u2192",
    radioOn: "\u25C9",
    radioOff: "\u25EF",
    tick: "\u2714",
    cross: "\u2716",
    ellipsis: "\u2026",
    pointerSmall: "\u203A",
    line: "\u2500",
    pointer: "\u276F"
  }, t = {
    arrowUp: e.arrowUp,
    arrowDown: e.arrowDown,
    arrowLeft: e.arrowLeft,
    arrowRight: e.arrowRight,
    radioOn: "(*)",
    radioOff: "( )",
    tick: "\u221A",
    cross: "\xD7",
    ellipsis: "...",
    pointerSmall: "\xBB",
    line: "\u2500",
    pointer: ">"
  };
  return ye = process.platform === "win32" ? t : e, ye;
}
var be, Jt;
function ps() {
  if (Jt)
    return be;
  Jt = 1;
  const e = P(), t = _i(), i = Object.freeze({
    password: {
      scale: 1,
      render: (l) => "*".repeat(l.length)
    },
    emoji: {
      scale: 2,
      render: (l) => "\u{1F603}".repeat(l.length)
    },
    invisible: {
      scale: 0,
      render: (l) => ""
    },
    default: {
      scale: 1,
      render: (l) => `${l}`
    }
  }), r = (l) => i[l] || i.default, n = Object.freeze({
    aborted: e.red(t.cross),
    done: e.green(t.tick),
    exited: e.yellow(t.cross),
    default: e.cyan("?")
  });
  return be = {
    styles: i,
    render: r,
    symbols: n,
    symbol: (l, u, o) => u ? n.aborted : o ? n.exited : l ? n.done : n.default,
    delimiter: (l) => e.gray(l ? t.ellipsis : t.pointerSmall),
    item: (l, u) => e.gray(l ? u ? t.pointerSmall : "+" : t.line)
  }, be;
}
var we, Zt;
function ms() {
  if (Zt)
    return we;
  Zt = 1;
  const e = Et();
  return we = function(t, i) {
    let r = String(e(t) || "").split(/\r?\n/);
    return i ? r.map((n) => Math.ceil(n.length / i)).reduce((n, a) => n + a) : r.length;
  }, we;
}
var xe, Xt;
function gs() {
  return Xt || (Xt = 1, xe = (e, t = {}) => {
    const i = Number.isSafeInteger(parseInt(t.margin)) ? new Array(parseInt(t.margin)).fill(" ").join("") : t.margin || "", r = t.width;
    return (e || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((a, s) => (s.length + i.length >= r || a[a.length - 1].length + s.length + 1 < r ? a[a.length - 1] += ` ${s}` : a.push(`${i}${s}`), a), [i]).join(`
`)).join(`
`);
  }), xe;
}
var Se, Qt;
function vs() {
  return Qt || (Qt = 1, Se = (e, t, i) => {
    i = i || t;
    let r = Math.min(t - i, e - Math.floor(i / 2));
    r < 0 && (r = 0);
    let n = Math.min(r + i, t);
    return {
      startIndex: r,
      endIndex: n
    };
  }), Se;
}
var Oe, er;
function H() {
  return er || (er = 1, Oe = {
    action: ds(),
    clear: fs(),
    style: ps(),
    strip: Et(),
    figures: _i(),
    lines: ms(),
    wrap: gs(),
    entriesToDisplay: vs()
  }), Oe;
}
var $e, tr;
function U() {
  if (tr)
    return $e;
  tr = 1;
  const e = X, t = H(), i = t.action, r = re.exports, n = E(), a = n.beep, s = n.cursor, d = P();
  class l extends r {
    constructor(o = {}) {
      super(), this.firstRender = !0, this.in = o.stdin || process.stdin, this.out = o.stdout || process.stdout, this.onRender = (o.onRender || (() => {
      })).bind(this);
      const p = e.createInterface({
        input: this.in,
        escapeCodeTimeout: 50
      });
      e.emitKeypressEvents(this.in, p), this.in.isTTY && this.in.setRawMode(!0);
      const h = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, c = (m, x) => {
        let y = i(x, h);
        y === !1 ? this._ && this._(m, x) : typeof this[y] == "function" ? this[y](x) : this.bell();
      };
      this.close = () => {
        this.out.write(s.show), this.in.removeListener("keypress", c), this.in.isTTY && this.in.setRawMode(!1), p.close(), this.emit(this.aborted ? "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", c);
    }
    fire() {
      this.emit("state", {
        value: this.value,
        aborted: !!this.aborted,
        exited: !!this.exited
      });
    }
    bell() {
      this.out.write(a);
    }
    render() {
      this.onRender(d), this.firstRender && (this.firstRender = !1);
    }
  }
  return $e = l, $e;
}
var _e, rr;
function ys() {
  if (rr)
    return _e;
  rr = 1;
  function e(c, m, x, y, g, v, S) {
    try {
      var b = c[v](S), f = b.value;
    } catch (w) {
      x(w);
      return;
    }
    b.done ? m(f) : Promise.resolve(f).then(y, g);
  }
  function t(c) {
    return function() {
      var m = this, x = arguments;
      return new Promise(function(y, g) {
        var v = c.apply(m, x);
        function S(f) {
          e(v, y, g, S, b, "next", f);
        }
        function b(f) {
          e(v, y, g, S, b, "throw", f);
        }
        S(void 0);
      });
    };
  }
  const i = P(), r = U(), n = E(), a = n.erase, s = n.cursor, d = H(), l = d.style, u = d.clear, o = d.lines, p = d.figures;
  class h extends r {
    constructor(m = {}) {
      super(m), this.transform = l.render(m.style), this.scale = this.transform.scale, this.msg = m.message, this.initial = m.initial || "", this.validator = m.validate || (() => !0), this.value = "", this.errorMsg = m.error || "Please Enter A Valid Value", this.cursor = Number(!!this.initial), this.cursorOffset = 0, this.clear = u("", this.out.columns), this.render();
    }
    set value(m) {
      !m && this.initial ? (this.placeholder = !0, this.rendered = i.gray(this.transform.render(this.initial))) : (this.placeholder = !1, this.rendered = this.transform.render(m)), this._value = m, this.fire();
    }
    get value() {
      return this._value;
    }
    reset() {
      this.value = "", this.cursor = Number(!!this.initial), this.cursorOffset = 0, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.value = this.value || this.initial, this.done = this.aborted = !0, this.error = !1, this.red = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    validate() {
      var m = this;
      return t(function* () {
        let x = yield m.validator(m.value);
        typeof x == "string" && (m.errorMsg = x, x = !1), m.error = !x;
      })();
    }
    submit() {
      var m = this;
      return t(function* () {
        if (m.value = m.value || m.initial, m.cursorOffset = 0, m.cursor = m.rendered.length, yield m.validate(), m.error) {
          m.red = !0, m.fire(), m.render();
          return;
        }
        m.done = !0, m.aborted = !1, m.fire(), m.render(), m.out.write(`
`), m.close();
      })();
    }
    next() {
      if (!this.placeholder)
        return this.bell();
      this.value = this.initial, this.cursor = this.rendered.length, this.fire(), this.render();
    }
    moveCursor(m) {
      this.placeholder || (this.cursor = this.cursor + m, this.cursorOffset += m);
    }
    _(m, x) {
      let y = this.value.slice(0, this.cursor), g = this.value.slice(this.cursor);
      this.value = `${y}${m}${g}`, this.red = !1, this.cursor = this.placeholder ? 0 : y.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart())
        return this.bell();
      let m = this.value.slice(0, this.cursor - 1), x = this.value.slice(this.cursor);
      this.value = `${m}${x}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      let m = this.value.slice(0, this.cursor), x = this.value.slice(this.cursor + 1);
      this.value = `${m}${x}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length, this.render();
    }
    left() {
      if (this.cursor <= 0 || this.placeholder)
        return this.bell();
      this.moveCursor(-1), this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      this.moveCursor(1), this.render();
    }
    isCursorAtStart() {
      return this.cursor === 0 || this.placeholder && this.cursor === 1;
    }
    isCursorAtEnd() {
      return this.cursor === this.rendered.length || this.placeholder && this.cursor === this.rendered.length + 1;
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(s.down(o(this.outputError, this.out.columns) - 1) + u(this.outputError, this.out.columns)), this.out.write(u(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [l.symbol(this.done, this.aborted), i.bold(this.msg), l.delimiter(this.done), this.red ? i.red(this.rendered) : this.rendered].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((m, x, y) => m + `
${y ? " " : p.pointerSmall} ${i.red().italic(x)}`, "")), this.out.write(a.line + s.to(0) + this.outputText + s.save + this.outputError + s.restore + s.move(this.cursorOffset, 0)));
    }
  }
  return _e = h, _e;
}
var Te, ir;
function bs() {
  if (ir)
    return Te;
  ir = 1;
  const e = P(), t = U(), i = H(), r = i.style, n = i.clear, a = i.figures, s = i.wrap, d = i.entriesToDisplay, l = E(), u = l.cursor;
  class o extends t {
    constructor(h = {}) {
      super(h), this.msg = h.message, this.hint = h.hint || "- Use arrow-keys. Return to submit.", this.warn = h.warn || "- This option is disabled", this.cursor = h.initial || 0, this.choices = h.choices.map((c, m) => (typeof c == "string" && (c = {
        title: c,
        value: m
      }), {
        title: c && (c.title || c.value || c),
        value: c && (c.value === void 0 ? m : c.value),
        description: c && c.description,
        selected: c && c.selected,
        disabled: c && c.disabled
      })), this.optionsPerPage = h.optionsPerPage || 10, this.value = (this.choices[this.cursor] || {}).value, this.clear = n("", this.out.columns), this.render();
    }
    moveCursor(h) {
      this.cursor = h, this.value = this.choices[h].value, this.fire();
    }
    reset() {
      this.moveCursor(0), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.selection.disabled ? this.bell() : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.moveCursor(0), this.render();
    }
    last() {
      this.moveCursor(this.choices.length - 1), this.render();
    }
    up() {
      this.cursor === 0 ? this.moveCursor(this.choices.length - 1) : this.moveCursor(this.cursor - 1), this.render();
    }
    down() {
      this.cursor === this.choices.length - 1 ? this.moveCursor(0) : this.moveCursor(this.cursor + 1), this.render();
    }
    next() {
      this.moveCursor((this.cursor + 1) % this.choices.length), this.render();
    }
    _(h, c) {
      if (h === " ")
        return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(u.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render();
      let h = d(this.cursor, this.choices.length, this.optionsPerPage), c = h.startIndex, m = h.endIndex;
      if (this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(!1), this.done ? this.selection.title : this.selection.disabled ? e.yellow(this.warn) : e.gray(this.hint)].join(" "), !this.done) {
        this.outputText += `
`;
        for (let x = c; x < m; x++) {
          let y, g, v = "", S = this.choices[x];
          x === c && c > 0 ? g = a.arrowUp : x === m - 1 && m < this.choices.length ? g = a.arrowDown : g = " ", S.disabled ? (y = this.cursor === x ? e.gray().underline(S.title) : e.strikethrough().gray(S.title), g = (this.cursor === x ? e.bold().gray(a.pointer) + " " : "  ") + g) : (y = this.cursor === x ? e.cyan().underline(S.title) : S.title, g = (this.cursor === x ? e.cyan(a.pointer) + " " : "  ") + g, S.description && this.cursor === x && (v = ` - ${S.description}`, (g.length + y.length + v.length >= this.out.columns || S.description.split(/\r?\n/).length > 1) && (v = `
` + s(S.description, {
            margin: 3,
            width: this.out.columns
          })))), this.outputText += `${g} ${y}${e.gray(v)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  }
  return Te = o, Te;
}
var Ce, sr;
function ws() {
  if (sr)
    return Ce;
  sr = 1;
  const e = P(), t = U(), i = H(), r = i.style, n = i.clear, a = E(), s = a.cursor, d = a.erase;
  class l extends t {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.value = !!o.initial, this.active = o.active || "on", this.inactive = o.inactive || "off", this.initialValue = this.value, this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    deactivate() {
      if (this.value === !1)
        return this.bell();
      this.value = !1, this.render();
    }
    activate() {
      if (this.value === !0)
        return this.bell();
      this.value = !0, this.render();
    }
    delete() {
      this.deactivate();
    }
    left() {
      this.deactivate();
    }
    right() {
      this.activate();
    }
    down() {
      this.deactivate();
    }
    up() {
      this.activate();
    }
    next() {
      this.value = !this.value, this.fire(), this.render();
    }
    _(o, p) {
      if (o === " ")
        this.value = !this.value;
      else if (o === "1")
        this.value = !0;
      else if (o === "0")
        this.value = !1;
      else
        return this.bell();
      this.render();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(s.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render(), this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(this.done), this.value ? this.inactive : e.cyan().underline(this.inactive), e.gray("/"), this.value ? e.cyan().underline(this.active) : this.active].join(" "), this.out.write(d.line + s.to(0) + this.outputText));
    }
  }
  return Ce = l, Ce;
}
var Me, nr;
function V() {
  if (nr)
    return Me;
  nr = 1;
  class e {
    constructor({
      token: i,
      date: r,
      parts: n,
      locales: a
    }) {
      this.token = i, this.date = r || new Date(), this.parts = n || [this], this.locales = a || {};
    }
    up() {
    }
    down() {
    }
    next() {
      const i = this.parts.indexOf(this);
      return this.parts.find((r, n) => n > i && r instanceof e);
    }
    setTo(i) {
    }
    prev() {
      let i = [].concat(this.parts).reverse();
      const r = i.indexOf(this);
      return i.find((n, a) => a > r && n instanceof e);
    }
    toString() {
      return String(this.date);
    }
  }
  return Me = e, Me;
}
var Pe, or;
function xs() {
  if (or)
    return Pe;
  or = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setHours((this.date.getHours() + 12) % 24);
    }
    down() {
      this.up();
    }
    toString() {
      let r = this.date.getHours() > 12 ? "pm" : "am";
      return /\A/.test(this.token) ? r.toUpperCase() : r;
    }
  }
  return Pe = t, Pe;
}
var Ee, ar;
function Ss() {
  if (ar)
    return Ee;
  ar = 1;
  const e = V(), t = (r) => (r = r % 10, r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th");
  class i extends e {
    constructor(n = {}) {
      super(n);
    }
    up() {
      this.date.setDate(this.date.getDate() + 1);
    }
    down() {
      this.date.setDate(this.date.getDate() - 1);
    }
    setTo(n) {
      this.date.setDate(parseInt(n.substr(-2)));
    }
    toString() {
      let n = this.date.getDate(), a = this.date.getDay();
      return this.token === "DD" ? String(n).padStart(2, "0") : this.token === "Do" ? n + t(n) : this.token === "d" ? a + 1 : this.token === "ddd" ? this.locales.weekdaysShort[a] : this.token === "dddd" ? this.locales.weekdays[a] : n;
    }
  }
  return Ee = i, Ee;
}
var Ae, lr;
function Os() {
  if (lr)
    return Ae;
  lr = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setHours(this.date.getHours() + 1);
    }
    down() {
      this.date.setHours(this.date.getHours() - 1);
    }
    setTo(r) {
      this.date.setHours(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getHours();
      return /h/.test(this.token) && (r = r % 12 || 12), this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return Ae = t, Ae;
}
var De, ur;
function $s() {
  if (ur)
    return De;
  ur = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMilliseconds(this.date.getMilliseconds() + 1);
    }
    down() {
      this.date.setMilliseconds(this.date.getMilliseconds() - 1);
    }
    setTo(r) {
      this.date.setMilliseconds(parseInt(r.substr(-this.token.length)));
    }
    toString() {
      return String(this.date.getMilliseconds()).padStart(4, "0").substr(0, this.token.length);
    }
  }
  return De = t, De;
}
var Re, hr;
function _s() {
  if (hr)
    return Re;
  hr = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMinutes(this.date.getMinutes() + 1);
    }
    down() {
      this.date.setMinutes(this.date.getMinutes() - 1);
    }
    setTo(r) {
      this.date.setMinutes(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getMinutes();
      return this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return Re = t, Re;
}
var Ie, cr;
function Ts() {
  if (cr)
    return Ie;
  cr = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMonth(this.date.getMonth() + 1);
    }
    down() {
      this.date.setMonth(this.date.getMonth() - 1);
    }
    setTo(r) {
      r = parseInt(r.substr(-2)) - 1, this.date.setMonth(r < 0 ? 0 : r);
    }
    toString() {
      let r = this.date.getMonth(), n = this.token.length;
      return n === 2 ? String(r + 1).padStart(2, "0") : n === 3 ? this.locales.monthsShort[r] : n === 4 ? this.locales.months[r] : String(r + 1);
    }
  }
  return Ie = t, Ie;
}
var qe, dr;
function Cs() {
  if (dr)
    return qe;
  dr = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setSeconds(this.date.getSeconds() + 1);
    }
    down() {
      this.date.setSeconds(this.date.getSeconds() - 1);
    }
    setTo(r) {
      this.date.setSeconds(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getSeconds();
      return this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return qe = t, qe;
}
var ke, fr;
function Ms() {
  if (fr)
    return ke;
  fr = 1;
  const e = V();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setFullYear(this.date.getFullYear() + 1);
    }
    down() {
      this.date.setFullYear(this.date.getFullYear() - 1);
    }
    setTo(r) {
      this.date.setFullYear(r.substr(-4));
    }
    toString() {
      let r = String(this.date.getFullYear()).padStart(4, "0");
      return this.token.length === 2 ? r.substr(-2) : r;
    }
  }
  return ke = t, ke;
}
var je, pr;
function Ps() {
  return pr || (pr = 1, je = {
    DatePart: V(),
    Meridiem: xs(),
    Day: Ss(),
    Hours: Os(),
    Milliseconds: $s(),
    Minutes: _s(),
    Month: Ts(),
    Seconds: Cs(),
    Year: Ms()
  }), je;
}
var Le, mr;
function Es() {
  if (mr)
    return Le;
  mr = 1;
  function e($, _, C, R, A, D, j) {
    try {
      var q = $[D](j), k = q.value;
    } catch (z) {
      C(z);
      return;
    }
    q.done ? _(k) : Promise.resolve(k).then(R, A);
  }
  function t($) {
    return function() {
      var _ = this, C = arguments;
      return new Promise(function(R, A) {
        var D = $.apply(_, C);
        function j(k) {
          e(D, R, A, j, q, "next", k);
        }
        function q(k) {
          e(D, R, A, j, q, "throw", k);
        }
        j(void 0);
      });
    };
  }
  const i = P(), r = U(), n = H(), a = n.style, s = n.clear, d = n.figures, l = E(), u = l.erase, o = l.cursor, p = Ps(), h = p.DatePart, c = p.Meridiem, m = p.Day, x = p.Hours, y = p.Milliseconds, g = p.Minutes, v = p.Month, S = p.Seconds, b = p.Year, f = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g, w = {
    1: ({
      token: $
    }) => $.replace(/\\(.)/g, "$1"),
    2: ($) => new m($),
    3: ($) => new v($),
    4: ($) => new b($),
    5: ($) => new c($),
    6: ($) => new x($),
    7: ($) => new g($),
    8: ($) => new S($),
    9: ($) => new y($)
  }, O = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  };
  class T extends r {
    constructor(_ = {}) {
      super(_), this.msg = _.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(O, _.locales), this._date = _.initial || new Date(), this.errorMsg = _.error || "Please Enter A Valid Value", this.validator = _.validate || (() => !0), this.mask = _.mask || "YYYY-MM-DD HH:mm:ss", this.clear = s("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(_) {
      _ && this._date.setTime(_.getTime());
    }
    set mask(_) {
      let C;
      for (this.parts = []; C = f.exec(_); ) {
        let A = C.shift(), D = C.findIndex((j) => j != null);
        this.parts.push(D in w ? w[D]({
          token: C[D] || A,
          date: this.date,
          parts: this.parts,
          locales: this.locales
        }) : C[D] || A);
      }
      let R = this.parts.reduce((A, D) => (typeof D == "string" && typeof A[A.length - 1] == "string" ? A[A.length - 1] += D : A.push(D), A), []);
      this.parts.splice(0), this.parts.push(...R), this.reset();
    }
    moveCursor(_) {
      this.typed = "", this.cursor = _, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((_) => _ instanceof h)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    validate() {
      var _ = this;
      return t(function* () {
        let C = yield _.validator(_.value);
        typeof C == "string" && (_.errorMsg = C, C = !1), _.error = !C;
      })();
    }
    submit() {
      var _ = this;
      return t(function* () {
        if (yield _.validate(), _.error) {
          _.color = "red", _.fire(), _.render();
          return;
        }
        _.done = !0, _.aborted = !1, _.fire(), _.render(), _.out.write(`
`), _.close();
      })();
    }
    up() {
      this.typed = "", this.parts[this.cursor].up(), this.render();
    }
    down() {
      this.typed = "", this.parts[this.cursor].down(), this.render();
    }
    left() {
      let _ = this.parts[this.cursor].prev();
      if (_ == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(_)), this.render();
    }
    right() {
      let _ = this.parts[this.cursor].next();
      if (_ == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(_)), this.render();
    }
    next() {
      let _ = this.parts[this.cursor].next();
      this.moveCursor(_ ? this.parts.indexOf(_) : this.parts.findIndex((C) => C instanceof h)), this.render();
    }
    _(_) {
      /\d/.test(_) && (this.typed += _, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(o.hide) : this.out.write(s(this.outputText, this.out.columns)), super.render(), this.outputText = [a.symbol(this.done, this.aborted), i.bold(this.msg), a.delimiter(!1), this.parts.reduce((_, C, R) => _.concat(R === this.cursor && !this.done ? i.cyan().underline(C.toString()) : C), []).join("")].join(" "), this.error && (this.outputText += this.errorMsg.split(`
`).reduce((_, C, R) => _ + `
${R ? " " : d.pointerSmall} ${i.red().italic(C)}`, "")), this.out.write(u.line + o.to(0) + this.outputText));
    }
  }
  return Le = T, Le;
}
var Fe, gr;
function As() {
  if (gr)
    return Fe;
  gr = 1;
  function e(y, g, v, S, b, f, w) {
    try {
      var O = y[f](w), T = O.value;
    } catch ($) {
      v($);
      return;
    }
    O.done ? g(T) : Promise.resolve(T).then(S, b);
  }
  function t(y) {
    return function() {
      var g = this, v = arguments;
      return new Promise(function(S, b) {
        var f = y.apply(g, v);
        function w(T) {
          e(f, S, b, w, O, "next", T);
        }
        function O(T) {
          e(f, S, b, w, O, "throw", T);
        }
        w(void 0);
      });
    };
  }
  const i = P(), r = U(), n = E(), a = n.cursor, s = n.erase, d = H(), l = d.style, u = d.figures, o = d.clear, p = d.lines, h = /[0-9]/, c = (y) => y !== void 0, m = (y, g) => {
    let v = Math.pow(10, g);
    return Math.round(y * v) / v;
  };
  class x extends r {
    constructor(g = {}) {
      super(g), this.transform = l.render(g.style), this.msg = g.message, this.initial = c(g.initial) ? g.initial : "", this.float = !!g.float, this.round = g.round || 2, this.inc = g.increment || 1, this.min = c(g.min) ? g.min : -1 / 0, this.max = c(g.max) ? g.max : 1 / 0, this.errorMsg = g.error || "Please Enter A Valid Value", this.validator = g.validate || (() => !0), this.color = "cyan", this.value = "", this.typed = "", this.lastHit = 0, this.render();
    }
    set value(g) {
      !g && g !== 0 ? (this.placeholder = !0, this.rendered = i.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder = !1, this.rendered = this.transform.render(`${m(g, this.round)}`), this._value = m(g, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(g) {
      return this.float ? parseFloat(g) : parseInt(g);
    }
    valid(g) {
      return g === "-" || g === "." && this.float || h.test(g);
    }
    reset() {
      this.typed = "", this.value = "", this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      let g = this.value;
      this.value = g !== "" ? g : this.initial, this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    validate() {
      var g = this;
      return t(function* () {
        let v = yield g.validator(g.value);
        typeof v == "string" && (g.errorMsg = v, v = !1), g.error = !v;
      })();
    }
    submit() {
      var g = this;
      return t(function* () {
        if (yield g.validate(), g.error) {
          g.color = "red", g.fire(), g.render();
          return;
        }
        let v = g.value;
        g.value = v !== "" ? v : g.initial, g.done = !0, g.aborted = !1, g.error = !1, g.fire(), g.render(), g.out.write(`
`), g.close();
      })();
    }
    up() {
      if (this.typed = "", this.value === "" && (this.value = this.min - this.inc), this.value >= this.max)
        return this.bell();
      this.value += this.inc, this.color = "cyan", this.fire(), this.render();
    }
    down() {
      if (this.typed = "", this.value === "" && (this.value = this.min + this.inc), this.value <= this.min)
        return this.bell();
      this.value -= this.inc, this.color = "cyan", this.fire(), this.render();
    }
    delete() {
      let g = this.value.toString();
      if (g.length === 0)
        return this.bell();
      this.value = this.parse(g = g.slice(0, -1)) || "", this.value !== "" && this.value < this.min && (this.value = this.min), this.color = "cyan", this.fire(), this.render();
    }
    next() {
      this.value = this.initial, this.fire(), this.render();
    }
    _(g, v) {
      if (!this.valid(g))
        return this.bell();
      const S = Date.now();
      if (S - this.lastHit > 1e3 && (this.typed = ""), this.typed += g, this.lastHit = S, this.color = "cyan", g === ".")
        return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(a.down(p(this.outputError, this.out.columns) - 1) + o(this.outputError, this.out.columns)), this.out.write(o(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [l.symbol(this.done, this.aborted), i.bold(this.msg), l.delimiter(this.done), !this.done || !this.done && !this.placeholder ? i[this.color]().underline(this.rendered) : this.rendered].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((g, v, S) => g + `
${S ? " " : u.pointerSmall} ${i.red().italic(v)}`, "")), this.out.write(s.line + a.to(0) + this.outputText + a.save + this.outputError + a.restore));
    }
  }
  return Fe = x, Fe;
}
var Ne, vr;
function Ti() {
  if (vr)
    return Ne;
  vr = 1;
  const e = P(), t = E(), i = t.cursor, r = U(), n = H(), a = n.clear, s = n.figures, d = n.style, l = n.wrap, u = n.entriesToDisplay;
  class o extends r {
    constructor(h = {}) {
      super(h), this.msg = h.message, this.cursor = h.cursor || 0, this.scrollIndex = h.cursor || 0, this.hint = h.hint || "", this.warn = h.warn || "- This option is disabled -", this.minSelected = h.min, this.showMinError = !1, this.maxChoices = h.max, this.instructions = h.instructions, this.optionsPerPage = h.optionsPerPage || 10, this.value = h.choices.map((c, m) => (typeof c == "string" && (c = {
        title: c,
        value: m
      }), {
        title: c && (c.title || c.value || c),
        description: c && c.description,
        value: c && (c.value === void 0 ? m : c.value),
        selected: c && c.selected,
        disabled: c && c.disabled
      })), this.clear = a("", this.out.columns), h.overrideRender || this.render();
    }
    reset() {
      this.value.map((h) => !h.selected), this.cursor = 0, this.fire(), this.render();
    }
    selected() {
      return this.value.filter((h) => h.selected);
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      const h = this.value.filter((c) => c.selected);
      this.minSelected && h.length < this.minSelected ? (this.showMinError = !0, this.render()) : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.value.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.value.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.value.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.value[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((h) => h.selected).length >= this.maxChoices)
        return this.bell();
      this.value[this.cursor].selected = !0, this.render();
    }
    handleSpaceToggle() {
      const h = this.value[this.cursor];
      if (h.selected)
        h.selected = !1, this.render();
      else {
        if (h.disabled || this.value.filter((c) => c.selected).length >= this.maxChoices)
          return this.bell();
        h.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      const h = !this.value[this.cursor].selected;
      this.value.filter((c) => !c.disabled).forEach((c) => c.selected = h), this.render();
    }
    _(h, c) {
      if (h === " ")
        this.handleSpaceToggle();
      else if (h === "a")
        this.toggleAll();
      else
        return this.bell();
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${s.arrowUp}/${s.arrowDown}: Highlight option
    ${s.arrowLeft}/${s.arrowRight}/[space]: Toggle selection
` + (this.maxChoices === void 0 ? `    a: Toggle all
` : "") + "    enter/return: Complete answer" : "";
    }
    renderOption(h, c, m, x) {
      const y = (c.selected ? e.green(s.radioOn) : s.radioOff) + " " + x + " ";
      let g, v;
      return c.disabled ? g = h === m ? e.gray().underline(c.title) : e.strikethrough().gray(c.title) : (g = h === m ? e.cyan().underline(c.title) : c.title, h === m && c.description && (v = ` - ${c.description}`, (y.length + g.length + v.length >= this.out.columns || c.description.split(/\r?\n/).length > 1) && (v = `
` + l(c.description, {
        margin: y.length,
        width: this.out.columns
      })))), y + g + e.gray(v || "");
    }
    paginateOptions(h) {
      if (h.length === 0)
        return e.red("No matches for this query.");
      let c = u(this.cursor, h.length, this.optionsPerPage), m = c.startIndex, x = c.endIndex, y, g = [];
      for (let v = m; v < x; v++)
        v === m && m > 0 ? y = s.arrowUp : v === x - 1 && x < h.length ? y = s.arrowDown : y = " ", g.push(this.renderOption(this.cursor, h[v], v, y));
      return `
` + g.join(`
`);
    }
    renderOptions(h) {
      return this.done ? "" : this.paginateOptions(h);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((c) => c.selected).map((c) => c.title).join(", ");
      const h = [e.gray(this.hint), this.renderInstructions()];
      return this.value[this.cursor].disabled && h.push(e.yellow(this.warn)), h.join(" ");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender && this.out.write(i.hide), super.render();
      let h = [d.symbol(this.done, this.aborted), e.bold(this.msg), d.delimiter(!1), this.renderDoneOrInstructions()].join(" ");
      this.showMinError && (h += e.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), h += this.renderOptions(this.value), this.out.write(this.clear + h), this.clear = a(h, this.out.columns);
    }
  }
  return Ne = o, Ne;
}
var He, yr;
function Ds() {
  if (yr)
    return He;
  yr = 1;
  function e(g, v, S, b, f, w, O) {
    try {
      var T = g[w](O), $ = T.value;
    } catch (_) {
      S(_);
      return;
    }
    T.done ? v($) : Promise.resolve($).then(b, f);
  }
  function t(g) {
    return function() {
      var v = this, S = arguments;
      return new Promise(function(b, f) {
        var w = g.apply(v, S);
        function O($) {
          e(w, b, f, O, T, "next", $);
        }
        function T($) {
          e(w, b, f, O, T, "throw", $);
        }
        O(void 0);
      });
    };
  }
  const i = P(), r = U(), n = E(), a = n.erase, s = n.cursor, d = H(), l = d.style, u = d.clear, o = d.figures, p = d.wrap, h = d.entriesToDisplay, c = (g, v) => g[v] && (g[v].value || g[v].title || g[v]), m = (g, v) => g[v] && (g[v].title || g[v].value || g[v]), x = (g, v) => {
    const S = g.findIndex((b) => b.value === v || b.title === v);
    return S > -1 ? S : void 0;
  };
  class y extends r {
    constructor(v = {}) {
      super(v), this.msg = v.message, this.suggest = v.suggest, this.choices = v.choices, this.initial = typeof v.initial == "number" ? v.initial : x(v.choices, v.initial), this.select = this.initial || v.cursor || 0, this.i18n = {
        noMatches: v.noMatches || "no matches found"
      }, this.fallback = v.fallback || this.initial, this.clearFirst = v.clearFirst || !1, this.suggestions = [], this.input = "", this.limit = v.limit || 10, this.cursor = 0, this.transform = l.render(v.style), this.scale = this.transform.scale, this.render = this.render.bind(this), this.complete = this.complete.bind(this), this.clear = u("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(v) {
      this._fb = Number.isSafeInteger(parseInt(v)) ? parseInt(v) : v;
    }
    get fallback() {
      let v;
      return typeof this._fb == "number" ? v = this.choices[this._fb] : typeof this._fb == "string" && (v = {
        title: this._fb
      }), v || this._fb || {
        title: this.i18n.noMatches
      };
    }
    moveSelect(v) {
      this.select = v, this.suggestions.length > 0 ? this.value = c(this.suggestions, v) : this.value = this.fallback.value, this.fire();
    }
    complete(v) {
      var S = this;
      return t(function* () {
        const b = S.completing = S.suggest(S.input, S.choices), f = yield b;
        if (S.completing !== b)
          return;
        S.suggestions = f.map((O, T, $) => ({
          title: m($, T),
          value: c($, T),
          description: O.description
        })), S.completing = !1;
        const w = Math.max(f.length - 1, 0);
        S.moveSelect(Math.min(w, S.select)), v && v();
      })();
    }
    reset() {
      this.input = "", this.complete(() => {
        this.moveSelect(this.initial !== void 0 ? this.initial : 0), this.render();
      }), this.render();
    }
    exit() {
      this.clearFirst && this.input.length > 0 ? this.reset() : (this.done = this.exited = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    abort() {
      this.done = this.aborted = !0, this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(v, S) {
      let b = this.input.slice(0, this.cursor), f = this.input.slice(this.cursor);
      this.input = `${b}${v}${f}`, this.cursor = b.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0)
        return this.bell();
      let v = this.input.slice(0, this.cursor - 1), S = this.input.slice(this.cursor);
      this.input = `${v}${S}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      let v = this.input.slice(0, this.cursor), S = this.input.slice(this.cursor + 1);
      this.input = `${v}${S}`, this.complete(this.render), this.render();
    }
    first() {
      this.moveSelect(0), this.render();
    }
    last() {
      this.moveSelect(this.suggestions.length - 1), this.render();
    }
    up() {
      this.select === 0 ? this.moveSelect(this.suggestions.length - 1) : this.moveSelect(this.select - 1), this.render();
    }
    down() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    next() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    nextPage() {
      this.moveSelect(Math.min(this.select + this.limit, this.suggestions.length - 1)), this.render();
    }
    prevPage() {
      this.moveSelect(Math.max(this.select - this.limit, 0)), this.render();
    }
    left() {
      if (this.cursor <= 0)
        return this.bell();
      this.cursor = this.cursor - 1, this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      this.cursor = this.cursor + 1, this.render();
    }
    renderOption(v, S, b, f) {
      let w, O = b ? o.arrowUp : f ? o.arrowDown : " ", T = S ? i.cyan().underline(v.title) : v.title;
      return O = (S ? i.cyan(o.pointer) + " " : "  ") + O, v.description && (w = ` - ${v.description}`, (O.length + T.length + w.length >= this.out.columns || v.description.split(/\r?\n/).length > 1) && (w = `
` + p(v.description, {
        margin: 3,
        width: this.out.columns
      }))), O + " " + T + i.gray(w || "");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(s.hide) : this.out.write(u(this.outputText, this.out.columns)), super.render();
      let v = h(this.select, this.choices.length, this.limit), S = v.startIndex, b = v.endIndex;
      if (this.outputText = [l.symbol(this.done, this.aborted, this.exited), i.bold(this.msg), l.delimiter(this.completing), this.done && this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)].join(" "), !this.done) {
        const f = this.suggestions.slice(S, b).map((w, O) => this.renderOption(w, this.select === O + S, O === 0 && S > 0, O + S === b - 1 && b < this.choices.length)).join(`
`);
        this.outputText += `
` + (f || i.gray(this.fallback.title));
      }
      this.out.write(a.line + s.to(0) + this.outputText);
    }
  }
  return He = y, He;
}
var Be, br;
function Rs() {
  if (br)
    return Be;
  br = 1;
  const e = P(), t = E(), i = t.cursor, r = Ti(), n = H(), a = n.clear, s = n.style, d = n.figures;
  class l extends r {
    constructor(o = {}) {
      o.overrideRender = !0, super(o), this.inputValue = "", this.clear = a("", this.out.columns), this.filteredOptions = this.value, this.render();
    }
    last() {
      this.cursor = this.filteredOptions.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.filteredOptions.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.filteredOptions.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.filteredOptions.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.filteredOptions[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((o) => o.selected).length >= this.maxChoices)
        return this.bell();
      this.filteredOptions[this.cursor].selected = !0, this.render();
    }
    delete() {
      this.inputValue.length && (this.inputValue = this.inputValue.substr(0, this.inputValue.length - 1), this.updateFilteredOptions());
    }
    updateFilteredOptions() {
      const o = this.filteredOptions[this.cursor];
      this.filteredOptions = this.value.filter((h) => this.inputValue ? !!(typeof h.title == "string" && h.title.toLowerCase().includes(this.inputValue.toLowerCase()) || typeof h.value == "string" && h.value.toLowerCase().includes(this.inputValue.toLowerCase())) : !0);
      const p = this.filteredOptions.findIndex((h) => h === o);
      this.cursor = p < 0 ? 0 : p, this.render();
    }
    handleSpaceToggle() {
      const o = this.filteredOptions[this.cursor];
      if (o.selected)
        o.selected = !1, this.render();
      else {
        if (o.disabled || this.value.filter((p) => p.selected).length >= this.maxChoices)
          return this.bell();
        o.selected = !0, this.render();
      }
    }
    handleInputChange(o) {
      this.inputValue = this.inputValue + o, this.updateFilteredOptions();
    }
    _(o, p) {
      o === " " ? this.handleSpaceToggle() : this.handleInputChange(o);
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${d.arrowUp}/${d.arrowDown}: Highlight option
    ${d.arrowLeft}/${d.arrowRight}/[space]: Toggle selection
    [a,b,c]/delete: Filter choices
    enter/return: Complete answer
` : "";
    }
    renderCurrentInput() {
      return `
Filtered results for: ${this.inputValue ? this.inputValue : e.gray("Enter something to filter")}
`;
    }
    renderOption(o, p, h) {
      let c;
      return p.disabled ? c = o === h ? e.gray().underline(p.title) : e.strikethrough().gray(p.title) : c = o === h ? e.cyan().underline(p.title) : p.title, (p.selected ? e.green(d.radioOn) : d.radioOff) + "  " + c;
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((p) => p.selected).map((p) => p.title).join(", ");
      const o = [e.gray(this.hint), this.renderInstructions(), this.renderCurrentInput()];
      return this.filteredOptions.length && this.filteredOptions[this.cursor].disabled && o.push(e.yellow(this.warn)), o.join(" ");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender && this.out.write(i.hide), super.render();
      let o = [s.symbol(this.done, this.aborted), e.bold(this.msg), s.delimiter(!1), this.renderDoneOrInstructions()].join(" ");
      this.showMinError && (o += e.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), o += this.renderOptions(this.filteredOptions), this.out.write(this.clear + o), this.clear = a(o, this.out.columns);
    }
  }
  return Be = l, Be;
}
var Ve, wr;
function Is() {
  if (wr)
    return Ve;
  wr = 1;
  const e = P(), t = U(), i = H(), r = i.style, n = i.clear, a = E(), s = a.erase, d = a.cursor;
  class l extends t {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.value = o.initial, this.initialValue = !!o.initial, this.yesMsg = o.yes || "yes", this.yesOption = o.yesOption || "(Y/n)", this.noMsg = o.no || "no", this.noOption = o.noOption || "(y/N)", this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.value = this.value || !1, this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(o, p) {
      return o.toLowerCase() === "y" ? (this.value = !0, this.submit()) : o.toLowerCase() === "n" ? (this.value = !1, this.submit()) : this.bell();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(d.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render(), this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(this.done), this.done ? this.value ? this.yesMsg : this.noMsg : e.gray(this.initialValue ? this.yesOption : this.noOption)].join(" "), this.out.write(s.line + d.to(0) + this.outputText));
    }
  }
  return Ve = l, Ve;
}
var Ye, xr;
function qs() {
  return xr || (xr = 1, Ye = {
    TextPrompt: ys(),
    SelectPrompt: bs(),
    TogglePrompt: ws(),
    DatePrompt: Es(),
    NumberPrompt: As(),
    MultiselectPrompt: Ti(),
    AutocompletePrompt: Ds(),
    AutocompleteMultiselectPrompt: Rs(),
    ConfirmPrompt: Is()
  }), Ye;
}
var Sr;
function ks() {
  return Sr || (Sr = 1, function(e) {
    const t = e, i = qs(), r = (s) => s;
    function n(s, d, l = {}) {
      return new Promise((u, o) => {
        const p = new i[s](d), h = l.onAbort || r, c = l.onSubmit || r, m = l.onExit || r;
        p.on("state", d.onState || r), p.on("submit", (x) => u(c(x))), p.on("exit", (x) => u(m(x))), p.on("abort", (x) => o(h(x)));
      });
    }
    t.text = (s) => n("TextPrompt", s), t.password = (s) => (s.style = "password", t.text(s)), t.invisible = (s) => (s.style = "invisible", t.text(s)), t.number = (s) => n("NumberPrompt", s), t.date = (s) => n("DatePrompt", s), t.confirm = (s) => n("ConfirmPrompt", s), t.list = (s) => {
      const d = s.separator || ",";
      return n("TextPrompt", s, {
        onSubmit: (l) => l.split(d).map((u) => u.trim())
      });
    }, t.toggle = (s) => n("TogglePrompt", s), t.select = (s) => n("SelectPrompt", s), t.multiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const d = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("MultiselectPrompt", s, {
        onAbort: d,
        onSubmit: d
      });
    }, t.autocompleteMultiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const d = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("AutocompleteMultiselectPrompt", s, {
        onAbort: d,
        onSubmit: d
      });
    };
    const a = (s, d) => Promise.resolve(d.filter((l) => l.title.slice(0, s.length).toLowerCase() === s.toLowerCase()));
    t.autocomplete = (s) => (s.suggest = s.suggest || a, s.choices = [].concat(s.choices || []), n("AutocompletePrompt", s));
  }(de)), de;
}
var Ue, Or;
function js() {
  if (Or)
    return Ue;
  Or = 1;
  function e(y, g) {
    var v = Object.keys(y);
    if (Object.getOwnPropertySymbols) {
      var S = Object.getOwnPropertySymbols(y);
      g && (S = S.filter(function(b) {
        return Object.getOwnPropertyDescriptor(y, b).enumerable;
      })), v.push.apply(v, S);
    }
    return v;
  }
  function t(y) {
    for (var g = 1; g < arguments.length; g++) {
      var v = arguments[g] != null ? arguments[g] : {};
      g % 2 ? e(Object(v), !0).forEach(function(S) {
        i(y, S, v[S]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(y, Object.getOwnPropertyDescriptors(v)) : e(Object(v)).forEach(function(S) {
        Object.defineProperty(y, S, Object.getOwnPropertyDescriptor(v, S));
      });
    }
    return y;
  }
  function i(y, g, v) {
    return g in y ? Object.defineProperty(y, g, { value: v, enumerable: !0, configurable: !0, writable: !0 }) : y[g] = v, y;
  }
  function r(y, g) {
    var v = typeof Symbol < "u" && y[Symbol.iterator] || y["@@iterator"];
    if (!v) {
      if (Array.isArray(y) || (v = n(y)) || g && y && typeof y.length == "number") {
        v && (y = v);
        var S = 0, b = function() {
        };
        return { s: b, n: function() {
          return S >= y.length ? { done: !0 } : { done: !1, value: y[S++] };
        }, e: function($) {
          throw $;
        }, f: b };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var f = !0, w = !1, O;
    return { s: function() {
      v = v.call(y);
    }, n: function() {
      var $ = v.next();
      return f = $.done, $;
    }, e: function($) {
      w = !0, O = $;
    }, f: function() {
      try {
        !f && v.return != null && v.return();
      } finally {
        if (w)
          throw O;
      }
    } };
  }
  function n(y, g) {
    if (!!y) {
      if (typeof y == "string")
        return a(y, g);
      var v = Object.prototype.toString.call(y).slice(8, -1);
      if (v === "Object" && y.constructor && (v = y.constructor.name), v === "Map" || v === "Set")
        return Array.from(y);
      if (v === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(v))
        return a(y, g);
    }
  }
  function a(y, g) {
    (g == null || g > y.length) && (g = y.length);
    for (var v = 0, S = new Array(g); v < g; v++)
      S[v] = y[v];
    return S;
  }
  function s(y, g, v, S, b, f, w) {
    try {
      var O = y[f](w), T = O.value;
    } catch ($) {
      v($);
      return;
    }
    O.done ? g(T) : Promise.resolve(T).then(S, b);
  }
  function d(y) {
    return function() {
      var g = this, v = arguments;
      return new Promise(function(S, b) {
        var f = y.apply(g, v);
        function w(T) {
          s(f, S, b, w, O, "next", T);
        }
        function O(T) {
          s(f, S, b, w, O, "throw", T);
        }
        w(void 0);
      });
    };
  }
  const l = ks(), u = ["suggest", "format", "onState", "validate", "onRender", "type"], o = () => {
  };
  function p() {
    return h.apply(this, arguments);
  }
  function h() {
    return h = d(function* (y = [], {
      onSubmit: g = o,
      onCancel: v = o
    } = {}) {
      const S = {}, b = p._override || {};
      y = [].concat(y);
      let f, w, O, T, $, _;
      const C = /* @__PURE__ */ function() {
        var q = d(function* (k, z, Ft = !1) {
          if (!(!Ft && k.validate && k.validate(z) !== !0))
            return k.format ? yield k.format(z, S) : z;
        });
        return function(z, Ft) {
          return q.apply(this, arguments);
        };
      }();
      var R = r(y), A;
      try {
        for (R.s(); !(A = R.n()).done; ) {
          w = A.value;
          var D = w;
          if (T = D.name, $ = D.type, typeof $ == "function" && ($ = yield $(f, t({}, S), w), w.type = $), !!$) {
            for (let q in w) {
              if (u.includes(q))
                continue;
              let k = w[q];
              w[q] = typeof k == "function" ? yield k(f, t({}, S), _) : k;
            }
            if (_ = w, typeof w.message != "string")
              throw new Error("prompt message is required");
            var j = w;
            if (T = j.name, $ = j.type, l[$] === void 0)
              throw new Error(`prompt type (${$}) is not defined`);
            if (b[w.name] !== void 0 && (f = yield C(w, b[w.name]), f !== void 0)) {
              S[T] = f;
              continue;
            }
            try {
              f = p._injected ? c(p._injected, w.initial) : yield l[$](w), S[T] = f = yield C(w, f, !0), O = yield g(w, f, S);
            } catch {
              O = !(yield v(w, S));
            }
            if (O)
              return S;
          }
        }
      } catch (q) {
        R.e(q);
      } finally {
        R.f();
      }
      return S;
    }), h.apply(this, arguments);
  }
  function c(y, g) {
    const v = y.shift();
    if (v instanceof Error)
      throw v;
    return v === void 0 ? g : v;
  }
  function m(y) {
    p._injected = (p._injected || []).concat(y);
  }
  function x(y) {
    p._override = Object.assign({}, y);
  }
  return Ue = Object.assign(p, {
    prompt: p,
    prompts: l,
    inject: m,
    override: x
  }), Ue;
}
var We = {}, Ge, $r;
function Ls() {
  return $r || ($r = 1, Ge = (e, t) => {
    if (!(e.meta && e.name !== "escape")) {
      if (e.ctrl) {
        if (e.name === "a")
          return "first";
        if (e.name === "c" || e.name === "d")
          return "abort";
        if (e.name === "e")
          return "last";
        if (e.name === "g")
          return "reset";
      }
      if (t) {
        if (e.name === "j")
          return "down";
        if (e.name === "k")
          return "up";
      }
      return e.name === "return" || e.name === "enter" ? "submit" : e.name === "backspace" ? "delete" : e.name === "delete" ? "deleteForward" : e.name === "abort" ? "abort" : e.name === "escape" ? "exit" : e.name === "tab" ? "next" : e.name === "pagedown" ? "nextPage" : e.name === "pageup" ? "prevPage" : e.name === "home" ? "home" : e.name === "end" ? "end" : e.name === "up" ? "up" : e.name === "down" ? "down" : e.name === "right" ? "right" : e.name === "left" ? "left" : !1;
    }
  }), Ge;
}
var ze, _r;
function At() {
  return _r || (_r = 1, ze = (e) => {
    const t = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"
    ].join("|"), i = new RegExp(t, "g");
    return typeof e == "string" ? e.replace(i, "") : e;
  }), ze;
}
var Ke, Tr;
function Fs() {
  if (Tr)
    return Ke;
  Tr = 1;
  const e = At(), { erase: t, cursor: i } = E(), r = (n) => [...e(n)].length;
  return Ke = function(n, a) {
    if (!a)
      return t.line + i.to(0);
    let s = 0;
    const d = n.split(/\r?\n/);
    for (let l of d)
      s += 1 + Math.floor(Math.max(r(l) - 1, 0) / a);
    return t.lines(s);
  }, Ke;
}
var Je, Cr;
function Ci() {
  if (Cr)
    return Je;
  Cr = 1;
  const e = {
    arrowUp: "\u2191",
    arrowDown: "\u2193",
    arrowLeft: "\u2190",
    arrowRight: "\u2192",
    radioOn: "\u25C9",
    radioOff: "\u25EF",
    tick: "\u2714",
    cross: "\u2716",
    ellipsis: "\u2026",
    pointerSmall: "\u203A",
    line: "\u2500",
    pointer: "\u276F"
  }, t = {
    arrowUp: e.arrowUp,
    arrowDown: e.arrowDown,
    arrowLeft: e.arrowLeft,
    arrowRight: e.arrowRight,
    radioOn: "(*)",
    radioOff: "( )",
    tick: "\u221A",
    cross: "\xD7",
    ellipsis: "...",
    pointerSmall: "\xBB",
    line: "\u2500",
    pointer: ">"
  };
  return Je = process.platform === "win32" ? t : e, Je;
}
var Ze, Mr;
function Ns() {
  if (Mr)
    return Ze;
  Mr = 1;
  const e = P(), t = Ci(), i = Object.freeze({
    password: { scale: 1, render: (l) => "*".repeat(l.length) },
    emoji: { scale: 2, render: (l) => "\u{1F603}".repeat(l.length) },
    invisible: { scale: 0, render: (l) => "" },
    default: { scale: 1, render: (l) => `${l}` }
  }), r = (l) => i[l] || i.default, n = Object.freeze({
    aborted: e.red(t.cross),
    done: e.green(t.tick),
    exited: e.yellow(t.cross),
    default: e.cyan("?")
  });
  return Ze = {
    styles: i,
    render: r,
    symbols: n,
    symbol: (l, u, o) => u ? n.aborted : o ? n.exited : l ? n.done : n.default,
    delimiter: (l) => e.gray(l ? t.ellipsis : t.pointerSmall),
    item: (l, u) => e.gray(l ? u ? t.pointerSmall : "+" : t.line)
  }, Ze;
}
var Xe, Pr;
function Hs() {
  if (Pr)
    return Xe;
  Pr = 1;
  const e = At();
  return Xe = function(t, i) {
    let r = String(e(t) || "").split(/\r?\n/);
    return i ? r.map((n) => Math.ceil(n.length / i)).reduce((n, a) => n + a) : r.length;
  }, Xe;
}
var Qe, Er;
function Bs() {
  return Er || (Er = 1, Qe = (e, t = {}) => {
    const i = Number.isSafeInteger(parseInt(t.margin)) ? new Array(parseInt(t.margin)).fill(" ").join("") : t.margin || "", r = t.width;
    return (e || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((a, s) => (s.length + i.length >= r || a[a.length - 1].length + s.length + 1 < r ? a[a.length - 1] += ` ${s}` : a.push(`${i}${s}`), a), [i]).join(`
`)).join(`
`);
  }), Qe;
}
var et, Ar;
function Vs() {
  return Ar || (Ar = 1, et = (e, t, i) => {
    i = i || t;
    let r = Math.min(t - i, e - Math.floor(i / 2));
    r < 0 && (r = 0);
    let n = Math.min(r + i, t);
    return { startIndex: r, endIndex: n };
  }), et;
}
var tt, Dr;
function B() {
  return Dr || (Dr = 1, tt = {
    action: Ls(),
    clear: Fs(),
    style: Ns(),
    strip: At(),
    figures: Ci(),
    lines: Hs(),
    wrap: Bs(),
    entriesToDisplay: Vs()
  }), tt;
}
var rt, Rr;
function W() {
  if (Rr)
    return rt;
  Rr = 1;
  const e = X, { action: t } = B(), i = re.exports, { beep: r, cursor: n } = E(), a = P();
  class s extends i {
    constructor(l = {}) {
      super(), this.firstRender = !0, this.in = l.stdin || process.stdin, this.out = l.stdout || process.stdout, this.onRender = (l.onRender || (() => {
      })).bind(this);
      const u = e.createInterface({ input: this.in, escapeCodeTimeout: 50 });
      e.emitKeypressEvents(this.in, u), this.in.isTTY && this.in.setRawMode(!0);
      const o = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, p = (h, c) => {
        let m = t(c, o);
        m === !1 ? this._ && this._(h, c) : typeof this[m] == "function" ? this[m](c) : this.bell();
      };
      this.close = () => {
        this.out.write(n.show), this.in.removeListener("keypress", p), this.in.isTTY && this.in.setRawMode(!1), u.close(), this.emit(this.aborted ? "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", p);
    }
    fire() {
      this.emit("state", {
        value: this.value,
        aborted: !!this.aborted,
        exited: !!this.exited
      });
    }
    bell() {
      this.out.write(r);
    }
    render() {
      this.onRender(a), this.firstRender && (this.firstRender = !1);
    }
  }
  return rt = s, rt;
}
var it, Ir;
function Ys() {
  if (Ir)
    return it;
  Ir = 1;
  const e = P(), t = W(), { erase: i, cursor: r } = E(), { style: n, clear: a, lines: s, figures: d } = B();
  class l extends t {
    constructor(o = {}) {
      super(o), this.transform = n.render(o.style), this.scale = this.transform.scale, this.msg = o.message, this.initial = o.initial || "", this.validator = o.validate || (() => !0), this.value = "", this.errorMsg = o.error || "Please Enter A Valid Value", this.cursor = Number(!!this.initial), this.cursorOffset = 0, this.clear = a("", this.out.columns), this.render();
    }
    set value(o) {
      !o && this.initial ? (this.placeholder = !0, this.rendered = e.gray(this.transform.render(this.initial))) : (this.placeholder = !1, this.rendered = this.transform.render(o)), this._value = o, this.fire();
    }
    get value() {
      return this._value;
    }
    reset() {
      this.value = "", this.cursor = Number(!!this.initial), this.cursorOffset = 0, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.value = this.value || this.initial, this.done = this.aborted = !0, this.error = !1, this.red = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let o = await this.validator(this.value);
      typeof o == "string" && (this.errorMsg = o, o = !1), this.error = !o;
    }
    async submit() {
      if (this.value = this.value || this.initial, this.cursorOffset = 0, this.cursor = this.rendered.length, await this.validate(), this.error) {
        this.red = !0, this.fire(), this.render();
        return;
      }
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    next() {
      if (!this.placeholder)
        return this.bell();
      this.value = this.initial, this.cursor = this.rendered.length, this.fire(), this.render();
    }
    moveCursor(o) {
      this.placeholder || (this.cursor = this.cursor + o, this.cursorOffset += o);
    }
    _(o, p) {
      let h = this.value.slice(0, this.cursor), c = this.value.slice(this.cursor);
      this.value = `${h}${o}${c}`, this.red = !1, this.cursor = this.placeholder ? 0 : h.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart())
        return this.bell();
      let o = this.value.slice(0, this.cursor - 1), p = this.value.slice(this.cursor);
      this.value = `${o}${p}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      let o = this.value.slice(0, this.cursor), p = this.value.slice(this.cursor + 1);
      this.value = `${o}${p}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length, this.render();
    }
    left() {
      if (this.cursor <= 0 || this.placeholder)
        return this.bell();
      this.moveCursor(-1), this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      this.moveCursor(1), this.render();
    }
    isCursorAtStart() {
      return this.cursor === 0 || this.placeholder && this.cursor === 1;
    }
    isCursorAtEnd() {
      return this.cursor === this.rendered.length || this.placeholder && this.cursor === this.rendered.length + 1;
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(r.down(s(this.outputError, this.out.columns) - 1) + a(this.outputError, this.out.columns)), this.out.write(a(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [
        n.symbol(this.done, this.aborted),
        e.bold(this.msg),
        n.delimiter(this.done),
        this.red ? e.red(this.rendered) : this.rendered
      ].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((o, p, h) => o + `
${h ? " " : d.pointerSmall} ${e.red().italic(p)}`, "")), this.out.write(i.line + r.to(0) + this.outputText + r.save + this.outputError + r.restore + r.move(this.cursorOffset, 0)));
    }
  }
  return it = l, it;
}
var st, qr;
function Us() {
  if (qr)
    return st;
  qr = 1;
  const e = P(), t = W(), { style: i, clear: r, figures: n, wrap: a, entriesToDisplay: s } = B(), { cursor: d } = E();
  class l extends t {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.hint = o.hint || "- Use arrow-keys. Return to submit.", this.warn = o.warn || "- This option is disabled", this.cursor = o.initial || 0, this.choices = o.choices.map((p, h) => (typeof p == "string" && (p = { title: p, value: h }), {
        title: p && (p.title || p.value || p),
        value: p && (p.value === void 0 ? h : p.value),
        description: p && p.description,
        selected: p && p.selected,
        disabled: p && p.disabled
      })), this.optionsPerPage = o.optionsPerPage || 10, this.value = (this.choices[this.cursor] || {}).value, this.clear = r("", this.out.columns), this.render();
    }
    moveCursor(o) {
      this.cursor = o, this.value = this.choices[o].value, this.fire();
    }
    reset() {
      this.moveCursor(0), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.selection.disabled ? this.bell() : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.moveCursor(0), this.render();
    }
    last() {
      this.moveCursor(this.choices.length - 1), this.render();
    }
    up() {
      this.cursor === 0 ? this.moveCursor(this.choices.length - 1) : this.moveCursor(this.cursor - 1), this.render();
    }
    down() {
      this.cursor === this.choices.length - 1 ? this.moveCursor(0) : this.moveCursor(this.cursor + 1), this.render();
    }
    next() {
      this.moveCursor((this.cursor + 1) % this.choices.length), this.render();
    }
    _(o, p) {
      if (o === " ")
        return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(d.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render();
      let { startIndex: o, endIndex: p } = s(this.cursor, this.choices.length, this.optionsPerPage);
      if (this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(!1),
        this.done ? this.selection.title : this.selection.disabled ? e.yellow(this.warn) : e.gray(this.hint)
      ].join(" "), !this.done) {
        this.outputText += `
`;
        for (let h = o; h < p; h++) {
          let c, m, x = "", y = this.choices[h];
          h === o && o > 0 ? m = n.arrowUp : h === p - 1 && p < this.choices.length ? m = n.arrowDown : m = " ", y.disabled ? (c = this.cursor === h ? e.gray().underline(y.title) : e.strikethrough().gray(y.title), m = (this.cursor === h ? e.bold().gray(n.pointer) + " " : "  ") + m) : (c = this.cursor === h ? e.cyan().underline(y.title) : y.title, m = (this.cursor === h ? e.cyan(n.pointer) + " " : "  ") + m, y.description && this.cursor === h && (x = ` - ${y.description}`, (m.length + c.length + x.length >= this.out.columns || y.description.split(/\r?\n/).length > 1) && (x = `
` + a(y.description, { margin: 3, width: this.out.columns })))), this.outputText += `${m} ${c}${e.gray(x)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  }
  return st = l, st;
}
var nt, kr;
function Ws() {
  if (kr)
    return nt;
  kr = 1;
  const e = P(), t = W(), { style: i, clear: r } = B(), { cursor: n, erase: a } = E();
  class s extends t {
    constructor(l = {}) {
      super(l), this.msg = l.message, this.value = !!l.initial, this.active = l.active || "on", this.inactive = l.inactive || "off", this.initialValue = this.value, this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    deactivate() {
      if (this.value === !1)
        return this.bell();
      this.value = !1, this.render();
    }
    activate() {
      if (this.value === !0)
        return this.bell();
      this.value = !0, this.render();
    }
    delete() {
      this.deactivate();
    }
    left() {
      this.deactivate();
    }
    right() {
      this.activate();
    }
    down() {
      this.deactivate();
    }
    up() {
      this.activate();
    }
    next() {
      this.value = !this.value, this.fire(), this.render();
    }
    _(l, u) {
      if (l === " ")
        this.value = !this.value;
      else if (l === "1")
        this.value = !0;
      else if (l === "0")
        this.value = !1;
      else
        return this.bell();
      this.render();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(n.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render(), this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(this.done),
        this.value ? this.inactive : e.cyan().underline(this.inactive),
        e.gray("/"),
        this.value ? e.cyan().underline(this.active) : this.active
      ].join(" "), this.out.write(a.line + n.to(0) + this.outputText));
    }
  }
  return nt = s, nt;
}
var ot, jr;
function Y() {
  if (jr)
    return ot;
  jr = 1;
  class e {
    constructor({ token: i, date: r, parts: n, locales: a }) {
      this.token = i, this.date = r || new Date(), this.parts = n || [this], this.locales = a || {};
    }
    up() {
    }
    down() {
    }
    next() {
      const i = this.parts.indexOf(this);
      return this.parts.find((r, n) => n > i && r instanceof e);
    }
    setTo(i) {
    }
    prev() {
      let i = [].concat(this.parts).reverse();
      const r = i.indexOf(this);
      return i.find((n, a) => a > r && n instanceof e);
    }
    toString() {
      return String(this.date);
    }
  }
  return ot = e, ot;
}
var at, Lr;
function Gs() {
  if (Lr)
    return at;
  Lr = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setHours((this.date.getHours() + 12) % 24);
    }
    down() {
      this.up();
    }
    toString() {
      let r = this.date.getHours() > 12 ? "pm" : "am";
      return /\A/.test(this.token) ? r.toUpperCase() : r;
    }
  }
  return at = t, at;
}
var lt, Fr;
function zs() {
  if (Fr)
    return lt;
  Fr = 1;
  const e = Y(), t = (r) => (r = r % 10, r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th");
  class i extends e {
    constructor(n = {}) {
      super(n);
    }
    up() {
      this.date.setDate(this.date.getDate() + 1);
    }
    down() {
      this.date.setDate(this.date.getDate() - 1);
    }
    setTo(n) {
      this.date.setDate(parseInt(n.substr(-2)));
    }
    toString() {
      let n = this.date.getDate(), a = this.date.getDay();
      return this.token === "DD" ? String(n).padStart(2, "0") : this.token === "Do" ? n + t(n) : this.token === "d" ? a + 1 : this.token === "ddd" ? this.locales.weekdaysShort[a] : this.token === "dddd" ? this.locales.weekdays[a] : n;
    }
  }
  return lt = i, lt;
}
var ut, Nr;
function Ks() {
  if (Nr)
    return ut;
  Nr = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setHours(this.date.getHours() + 1);
    }
    down() {
      this.date.setHours(this.date.getHours() - 1);
    }
    setTo(r) {
      this.date.setHours(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getHours();
      return /h/.test(this.token) && (r = r % 12 || 12), this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return ut = t, ut;
}
var ht, Hr;
function Js() {
  if (Hr)
    return ht;
  Hr = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMilliseconds(this.date.getMilliseconds() + 1);
    }
    down() {
      this.date.setMilliseconds(this.date.getMilliseconds() - 1);
    }
    setTo(r) {
      this.date.setMilliseconds(parseInt(r.substr(-this.token.length)));
    }
    toString() {
      return String(this.date.getMilliseconds()).padStart(4, "0").substr(0, this.token.length);
    }
  }
  return ht = t, ht;
}
var ct, Br;
function Zs() {
  if (Br)
    return ct;
  Br = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMinutes(this.date.getMinutes() + 1);
    }
    down() {
      this.date.setMinutes(this.date.getMinutes() - 1);
    }
    setTo(r) {
      this.date.setMinutes(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getMinutes();
      return this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return ct = t, ct;
}
var dt, Vr;
function Xs() {
  if (Vr)
    return dt;
  Vr = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setMonth(this.date.getMonth() + 1);
    }
    down() {
      this.date.setMonth(this.date.getMonth() - 1);
    }
    setTo(r) {
      r = parseInt(r.substr(-2)) - 1, this.date.setMonth(r < 0 ? 0 : r);
    }
    toString() {
      let r = this.date.getMonth(), n = this.token.length;
      return n === 2 ? String(r + 1).padStart(2, "0") : n === 3 ? this.locales.monthsShort[r] : n === 4 ? this.locales.months[r] : String(r + 1);
    }
  }
  return dt = t, dt;
}
var ft, Yr;
function Qs() {
  if (Yr)
    return ft;
  Yr = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setSeconds(this.date.getSeconds() + 1);
    }
    down() {
      this.date.setSeconds(this.date.getSeconds() - 1);
    }
    setTo(r) {
      this.date.setSeconds(parseInt(r.substr(-2)));
    }
    toString() {
      let r = this.date.getSeconds();
      return this.token.length > 1 ? String(r).padStart(2, "0") : r;
    }
  }
  return ft = t, ft;
}
var pt, Ur;
function en() {
  if (Ur)
    return pt;
  Ur = 1;
  const e = Y();
  class t extends e {
    constructor(r = {}) {
      super(r);
    }
    up() {
      this.date.setFullYear(this.date.getFullYear() + 1);
    }
    down() {
      this.date.setFullYear(this.date.getFullYear() - 1);
    }
    setTo(r) {
      this.date.setFullYear(r.substr(-4));
    }
    toString() {
      let r = String(this.date.getFullYear()).padStart(4, "0");
      return this.token.length === 2 ? r.substr(-2) : r;
    }
  }
  return pt = t, pt;
}
var mt, Wr;
function tn() {
  return Wr || (Wr = 1, mt = {
    DatePart: Y(),
    Meridiem: Gs(),
    Day: zs(),
    Hours: Ks(),
    Milliseconds: Js(),
    Minutes: Zs(),
    Month: Xs(),
    Seconds: Qs(),
    Year: en()
  }), mt;
}
var gt, Gr;
function rn() {
  if (Gr)
    return gt;
  Gr = 1;
  const e = P(), t = W(), { style: i, clear: r, figures: n } = B(), { erase: a, cursor: s } = E(), { DatePart: d, Meridiem: l, Day: u, Hours: o, Milliseconds: p, Minutes: h, Month: c, Seconds: m, Year: x } = tn(), y = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g, g = {
    1: ({ token: b }) => b.replace(/\\(.)/g, "$1"),
    2: (b) => new u(b),
    3: (b) => new c(b),
    4: (b) => new x(b),
    5: (b) => new l(b),
    6: (b) => new o(b),
    7: (b) => new h(b),
    8: (b) => new m(b),
    9: (b) => new p(b)
  }, v = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  };
  class S extends t {
    constructor(f = {}) {
      super(f), this.msg = f.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(v, f.locales), this._date = f.initial || new Date(), this.errorMsg = f.error || "Please Enter A Valid Value", this.validator = f.validate || (() => !0), this.mask = f.mask || "YYYY-MM-DD HH:mm:ss", this.clear = r("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(f) {
      f && this._date.setTime(f.getTime());
    }
    set mask(f) {
      let w;
      for (this.parts = []; w = y.exec(f); ) {
        let T = w.shift(), $ = w.findIndex((_) => _ != null);
        this.parts.push($ in g ? g[$]({ token: w[$] || T, date: this.date, parts: this.parts, locales: this.locales }) : w[$] || T);
      }
      let O = this.parts.reduce((T, $) => (typeof $ == "string" && typeof T[T.length - 1] == "string" ? T[T.length - 1] += $ : T.push($), T), []);
      this.parts.splice(0), this.parts.push(...O), this.reset();
    }
    moveCursor(f) {
      this.typed = "", this.cursor = f, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((f) => f instanceof d)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let f = await this.validator(this.value);
      typeof f == "string" && (this.errorMsg = f, f = !1), this.error = !f;
    }
    async submit() {
      if (await this.validate(), this.error) {
        this.color = "red", this.fire(), this.render();
        return;
      }
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    up() {
      this.typed = "", this.parts[this.cursor].up(), this.render();
    }
    down() {
      this.typed = "", this.parts[this.cursor].down(), this.render();
    }
    left() {
      let f = this.parts[this.cursor].prev();
      if (f == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(f)), this.render();
    }
    right() {
      let f = this.parts[this.cursor].next();
      if (f == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(f)), this.render();
    }
    next() {
      let f = this.parts[this.cursor].next();
      this.moveCursor(f ? this.parts.indexOf(f) : this.parts.findIndex((w) => w instanceof d)), this.render();
    }
    _(f) {
      /\d/.test(f) && (this.typed += f, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(s.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render(), this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(!1),
        this.parts.reduce((f, w, O) => f.concat(O === this.cursor && !this.done ? e.cyan().underline(w.toString()) : w), []).join("")
      ].join(" "), this.error && (this.outputText += this.errorMsg.split(`
`).reduce(
        (f, w, O) => f + `
${O ? " " : n.pointerSmall} ${e.red().italic(w)}`,
        ""
      )), this.out.write(a.line + s.to(0) + this.outputText));
    }
  }
  return gt = S, gt;
}
var vt, zr;
function sn() {
  if (zr)
    return vt;
  zr = 1;
  const e = P(), t = W(), { cursor: i, erase: r } = E(), { style: n, figures: a, clear: s, lines: d } = B(), l = /[0-9]/, u = (h) => h !== void 0, o = (h, c) => {
    let m = Math.pow(10, c);
    return Math.round(h * m) / m;
  };
  class p extends t {
    constructor(c = {}) {
      super(c), this.transform = n.render(c.style), this.msg = c.message, this.initial = u(c.initial) ? c.initial : "", this.float = !!c.float, this.round = c.round || 2, this.inc = c.increment || 1, this.min = u(c.min) ? c.min : -1 / 0, this.max = u(c.max) ? c.max : 1 / 0, this.errorMsg = c.error || "Please Enter A Valid Value", this.validator = c.validate || (() => !0), this.color = "cyan", this.value = "", this.typed = "", this.lastHit = 0, this.render();
    }
    set value(c) {
      !c && c !== 0 ? (this.placeholder = !0, this.rendered = e.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder = !1, this.rendered = this.transform.render(`${o(c, this.round)}`), this._value = o(c, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(c) {
      return this.float ? parseFloat(c) : parseInt(c);
    }
    valid(c) {
      return c === "-" || c === "." && this.float || l.test(c);
    }
    reset() {
      this.typed = "", this.value = "", this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      let c = this.value;
      this.value = c !== "" ? c : this.initial, this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let c = await this.validator(this.value);
      typeof c == "string" && (this.errorMsg = c, c = !1), this.error = !c;
    }
    async submit() {
      if (await this.validate(), this.error) {
        this.color = "red", this.fire(), this.render();
        return;
      }
      let c = this.value;
      this.value = c !== "" ? c : this.initial, this.done = !0, this.aborted = !1, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    up() {
      if (this.typed = "", this.value === "" && (this.value = this.min - this.inc), this.value >= this.max)
        return this.bell();
      this.value += this.inc, this.color = "cyan", this.fire(), this.render();
    }
    down() {
      if (this.typed = "", this.value === "" && (this.value = this.min + this.inc), this.value <= this.min)
        return this.bell();
      this.value -= this.inc, this.color = "cyan", this.fire(), this.render();
    }
    delete() {
      let c = this.value.toString();
      if (c.length === 0)
        return this.bell();
      this.value = this.parse(c = c.slice(0, -1)) || "", this.value !== "" && this.value < this.min && (this.value = this.min), this.color = "cyan", this.fire(), this.render();
    }
    next() {
      this.value = this.initial, this.fire(), this.render();
    }
    _(c, m) {
      if (!this.valid(c))
        return this.bell();
      const x = Date.now();
      if (x - this.lastHit > 1e3 && (this.typed = ""), this.typed += c, this.lastHit = x, this.color = "cyan", c === ".")
        return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(i.down(d(this.outputError, this.out.columns) - 1) + s(this.outputError, this.out.columns)), this.out.write(s(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [
        n.symbol(this.done, this.aborted),
        e.bold(this.msg),
        n.delimiter(this.done),
        !this.done || !this.done && !this.placeholder ? e[this.color]().underline(this.rendered) : this.rendered
      ].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((c, m, x) => c + `
${x ? " " : a.pointerSmall} ${e.red().italic(m)}`, "")), this.out.write(r.line + i.to(0) + this.outputText + i.save + this.outputError + i.restore));
    }
  }
  return vt = p, vt;
}
var yt, Kr;
function Mi() {
  if (Kr)
    return yt;
  Kr = 1;
  const e = P(), { cursor: t } = E(), i = W(), { clear: r, figures: n, style: a, wrap: s, entriesToDisplay: d } = B();
  class l extends i {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.cursor = o.cursor || 0, this.scrollIndex = o.cursor || 0, this.hint = o.hint || "", this.warn = o.warn || "- This option is disabled -", this.minSelected = o.min, this.showMinError = !1, this.maxChoices = o.max, this.instructions = o.instructions, this.optionsPerPage = o.optionsPerPage || 10, this.value = o.choices.map((p, h) => (typeof p == "string" && (p = { title: p, value: h }), {
        title: p && (p.title || p.value || p),
        description: p && p.description,
        value: p && (p.value === void 0 ? h : p.value),
        selected: p && p.selected,
        disabled: p && p.disabled
      })), this.clear = r("", this.out.columns), o.overrideRender || this.render();
    }
    reset() {
      this.value.map((o) => !o.selected), this.cursor = 0, this.fire(), this.render();
    }
    selected() {
      return this.value.filter((o) => o.selected);
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      const o = this.value.filter((p) => p.selected);
      this.minSelected && o.length < this.minSelected ? (this.showMinError = !0, this.render()) : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.value.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.value.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.value.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.value[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((o) => o.selected).length >= this.maxChoices)
        return this.bell();
      this.value[this.cursor].selected = !0, this.render();
    }
    handleSpaceToggle() {
      const o = this.value[this.cursor];
      if (o.selected)
        o.selected = !1, this.render();
      else {
        if (o.disabled || this.value.filter((p) => p.selected).length >= this.maxChoices)
          return this.bell();
        o.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      const o = !this.value[this.cursor].selected;
      this.value.filter((p) => !p.disabled).forEach((p) => p.selected = o), this.render();
    }
    _(o, p) {
      if (o === " ")
        this.handleSpaceToggle();
      else if (o === "a")
        this.toggleAll();
      else
        return this.bell();
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${n.arrowUp}/${n.arrowDown}: Highlight option
    ${n.arrowLeft}/${n.arrowRight}/[space]: Toggle selection
` + (this.maxChoices === void 0 ? `    a: Toggle all
` : "") + "    enter/return: Complete answer" : "";
    }
    renderOption(o, p, h, c) {
      const m = (p.selected ? e.green(n.radioOn) : n.radioOff) + " " + c + " ";
      let x, y;
      return p.disabled ? x = o === h ? e.gray().underline(p.title) : e.strikethrough().gray(p.title) : (x = o === h ? e.cyan().underline(p.title) : p.title, o === h && p.description && (y = ` - ${p.description}`, (m.length + x.length + y.length >= this.out.columns || p.description.split(/\r?\n/).length > 1) && (y = `
` + s(p.description, { margin: m.length, width: this.out.columns })))), m + x + e.gray(y || "");
    }
    paginateOptions(o) {
      if (o.length === 0)
        return e.red("No matches for this query.");
      let { startIndex: p, endIndex: h } = d(this.cursor, o.length, this.optionsPerPage), c, m = [];
      for (let x = p; x < h; x++)
        x === p && p > 0 ? c = n.arrowUp : x === h - 1 && h < o.length ? c = n.arrowDown : c = " ", m.push(this.renderOption(this.cursor, o[x], x, c));
      return `
` + m.join(`
`);
    }
    renderOptions(o) {
      return this.done ? "" : this.paginateOptions(o);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((p) => p.selected).map((p) => p.title).join(", ");
      const o = [e.gray(this.hint), this.renderInstructions()];
      return this.value[this.cursor].disabled && o.push(e.yellow(this.warn)), o.join(" ");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender && this.out.write(t.hide), super.render();
      let o = [
        a.symbol(this.done, this.aborted),
        e.bold(this.msg),
        a.delimiter(!1),
        this.renderDoneOrInstructions()
      ].join(" ");
      this.showMinError && (o += e.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), o += this.renderOptions(this.value), this.out.write(this.clear + o), this.clear = r(o, this.out.columns);
    }
  }
  return yt = l, yt;
}
var bt, Jr;
function nn() {
  if (Jr)
    return bt;
  Jr = 1;
  const e = P(), t = W(), { erase: i, cursor: r } = E(), { style: n, clear: a, figures: s, wrap: d, entriesToDisplay: l } = B(), u = (c, m) => c[m] && (c[m].value || c[m].title || c[m]), o = (c, m) => c[m] && (c[m].title || c[m].value || c[m]), p = (c, m) => {
    const x = c.findIndex((y) => y.value === m || y.title === m);
    return x > -1 ? x : void 0;
  };
  class h extends t {
    constructor(m = {}) {
      super(m), this.msg = m.message, this.suggest = m.suggest, this.choices = m.choices, this.initial = typeof m.initial == "number" ? m.initial : p(m.choices, m.initial), this.select = this.initial || m.cursor || 0, this.i18n = { noMatches: m.noMatches || "no matches found" }, this.fallback = m.fallback || this.initial, this.clearFirst = m.clearFirst || !1, this.suggestions = [], this.input = "", this.limit = m.limit || 10, this.cursor = 0, this.transform = n.render(m.style), this.scale = this.transform.scale, this.render = this.render.bind(this), this.complete = this.complete.bind(this), this.clear = a("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(m) {
      this._fb = Number.isSafeInteger(parseInt(m)) ? parseInt(m) : m;
    }
    get fallback() {
      let m;
      return typeof this._fb == "number" ? m = this.choices[this._fb] : typeof this._fb == "string" && (m = { title: this._fb }), m || this._fb || { title: this.i18n.noMatches };
    }
    moveSelect(m) {
      this.select = m, this.suggestions.length > 0 ? this.value = u(this.suggestions, m) : this.value = this.fallback.value, this.fire();
    }
    async complete(m) {
      const x = this.completing = this.suggest(this.input, this.choices), y = await x;
      if (this.completing !== x)
        return;
      this.suggestions = y.map((v, S, b) => ({ title: o(b, S), value: u(b, S), description: v.description })), this.completing = !1;
      const g = Math.max(y.length - 1, 0);
      this.moveSelect(Math.min(g, this.select)), m && m();
    }
    reset() {
      this.input = "", this.complete(() => {
        this.moveSelect(this.initial !== void 0 ? this.initial : 0), this.render();
      }), this.render();
    }
    exit() {
      this.clearFirst && this.input.length > 0 ? this.reset() : (this.done = this.exited = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    abort() {
      this.done = this.aborted = !0, this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(m, x) {
      let y = this.input.slice(0, this.cursor), g = this.input.slice(this.cursor);
      this.input = `${y}${m}${g}`, this.cursor = y.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0)
        return this.bell();
      let m = this.input.slice(0, this.cursor - 1), x = this.input.slice(this.cursor);
      this.input = `${m}${x}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      let m = this.input.slice(0, this.cursor), x = this.input.slice(this.cursor + 1);
      this.input = `${m}${x}`, this.complete(this.render), this.render();
    }
    first() {
      this.moveSelect(0), this.render();
    }
    last() {
      this.moveSelect(this.suggestions.length - 1), this.render();
    }
    up() {
      this.select === 0 ? this.moveSelect(this.suggestions.length - 1) : this.moveSelect(this.select - 1), this.render();
    }
    down() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    next() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    nextPage() {
      this.moveSelect(Math.min(this.select + this.limit, this.suggestions.length - 1)), this.render();
    }
    prevPage() {
      this.moveSelect(Math.max(this.select - this.limit, 0)), this.render();
    }
    left() {
      if (this.cursor <= 0)
        return this.bell();
      this.cursor = this.cursor - 1, this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      this.cursor = this.cursor + 1, this.render();
    }
    renderOption(m, x, y, g) {
      let v, S = y ? s.arrowUp : g ? s.arrowDown : " ", b = x ? e.cyan().underline(m.title) : m.title;
      return S = (x ? e.cyan(s.pointer) + " " : "  ") + S, m.description && (v = ` - ${m.description}`, (S.length + b.length + v.length >= this.out.columns || m.description.split(/\r?\n/).length > 1) && (v = `
` + d(m.description, { margin: 3, width: this.out.columns }))), S + " " + b + e.gray(v || "");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(r.hide) : this.out.write(a(this.outputText, this.out.columns)), super.render();
      let { startIndex: m, endIndex: x } = l(this.select, this.choices.length, this.limit);
      if (this.outputText = [
        n.symbol(this.done, this.aborted, this.exited),
        e.bold(this.msg),
        n.delimiter(this.completing),
        this.done && this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)
      ].join(" "), !this.done) {
        const y = this.suggestions.slice(m, x).map((g, v) => this.renderOption(
          g,
          this.select === v + m,
          v === 0 && m > 0,
          v + m === x - 1 && x < this.choices.length
        )).join(`
`);
        this.outputText += `
` + (y || e.gray(this.fallback.title));
      }
      this.out.write(i.line + r.to(0) + this.outputText);
    }
  }
  return bt = h, bt;
}
var wt, Zr;
function on() {
  if (Zr)
    return wt;
  Zr = 1;
  const e = P(), { cursor: t } = E(), i = Mi(), { clear: r, style: n, figures: a } = B();
  class s extends i {
    constructor(l = {}) {
      l.overrideRender = !0, super(l), this.inputValue = "", this.clear = r("", this.out.columns), this.filteredOptions = this.value, this.render();
    }
    last() {
      this.cursor = this.filteredOptions.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.filteredOptions.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.filteredOptions.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.filteredOptions.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.filteredOptions[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((l) => l.selected).length >= this.maxChoices)
        return this.bell();
      this.filteredOptions[this.cursor].selected = !0, this.render();
    }
    delete() {
      this.inputValue.length && (this.inputValue = this.inputValue.substr(0, this.inputValue.length - 1), this.updateFilteredOptions());
    }
    updateFilteredOptions() {
      const l = this.filteredOptions[this.cursor];
      this.filteredOptions = this.value.filter((o) => this.inputValue ? !!(typeof o.title == "string" && o.title.toLowerCase().includes(this.inputValue.toLowerCase()) || typeof o.value == "string" && o.value.toLowerCase().includes(this.inputValue.toLowerCase())) : !0);
      const u = this.filteredOptions.findIndex((o) => o === l);
      this.cursor = u < 0 ? 0 : u, this.render();
    }
    handleSpaceToggle() {
      const l = this.filteredOptions[this.cursor];
      if (l.selected)
        l.selected = !1, this.render();
      else {
        if (l.disabled || this.value.filter((u) => u.selected).length >= this.maxChoices)
          return this.bell();
        l.selected = !0, this.render();
      }
    }
    handleInputChange(l) {
      this.inputValue = this.inputValue + l, this.updateFilteredOptions();
    }
    _(l, u) {
      l === " " ? this.handleSpaceToggle() : this.handleInputChange(l);
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${a.arrowUp}/${a.arrowDown}: Highlight option
    ${a.arrowLeft}/${a.arrowRight}/[space]: Toggle selection
    [a,b,c]/delete: Filter choices
    enter/return: Complete answer
` : "";
    }
    renderCurrentInput() {
      return `
Filtered results for: ${this.inputValue ? this.inputValue : e.gray("Enter something to filter")}
`;
    }
    renderOption(l, u, o) {
      let p;
      return u.disabled ? p = l === o ? e.gray().underline(u.title) : e.strikethrough().gray(u.title) : p = l === o ? e.cyan().underline(u.title) : u.title, (u.selected ? e.green(a.radioOn) : a.radioOff) + "  " + p;
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((u) => u.selected).map((u) => u.title).join(", ");
      const l = [e.gray(this.hint), this.renderInstructions(), this.renderCurrentInput()];
      return this.filteredOptions.length && this.filteredOptions[this.cursor].disabled && l.push(e.yellow(this.warn)), l.join(" ");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender && this.out.write(t.hide), super.render();
      let l = [
        n.symbol(this.done, this.aborted),
        e.bold(this.msg),
        n.delimiter(!1),
        this.renderDoneOrInstructions()
      ].join(" ");
      this.showMinError && (l += e.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), l += this.renderOptions(this.filteredOptions), this.out.write(this.clear + l), this.clear = r(l, this.out.columns);
    }
  }
  return wt = s, wt;
}
var xt, Xr;
function an() {
  if (Xr)
    return xt;
  Xr = 1;
  const e = P(), t = W(), { style: i, clear: r } = B(), { erase: n, cursor: a } = E();
  class s extends t {
    constructor(l = {}) {
      super(l), this.msg = l.message, this.value = l.initial, this.initialValue = !!l.initial, this.yesMsg = l.yes || "yes", this.yesOption = l.yesOption || "(Y/n)", this.noMsg = l.no || "no", this.noOption = l.noOption || "(y/N)", this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.value = this.value || !1, this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(l, u) {
      return l.toLowerCase() === "y" ? (this.value = !0, this.submit()) : l.toLowerCase() === "n" ? (this.value = !1, this.submit()) : this.bell();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(a.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render(), this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(this.done),
        this.done ? this.value ? this.yesMsg : this.noMsg : e.gray(this.initialValue ? this.yesOption : this.noOption)
      ].join(" "), this.out.write(n.line + a.to(0) + this.outputText));
    }
  }
  return xt = s, xt;
}
var St, Qr;
function ln() {
  return Qr || (Qr = 1, St = {
    TextPrompt: Ys(),
    SelectPrompt: Us(),
    TogglePrompt: Ws(),
    DatePrompt: rn(),
    NumberPrompt: sn(),
    MultiselectPrompt: Mi(),
    AutocompletePrompt: nn(),
    AutocompleteMultiselectPrompt: on(),
    ConfirmPrompt: an()
  }), St;
}
var ei;
function un() {
  return ei || (ei = 1, function(e) {
    const t = e, i = ln(), r = (s) => s;
    function n(s, d, l = {}) {
      return new Promise((u, o) => {
        const p = new i[s](d), h = l.onAbort || r, c = l.onSubmit || r, m = l.onExit || r;
        p.on("state", d.onState || r), p.on("submit", (x) => u(c(x))), p.on("exit", (x) => u(m(x))), p.on("abort", (x) => o(h(x)));
      });
    }
    t.text = (s) => n("TextPrompt", s), t.password = (s) => (s.style = "password", t.text(s)), t.invisible = (s) => (s.style = "invisible", t.text(s)), t.number = (s) => n("NumberPrompt", s), t.date = (s) => n("DatePrompt", s), t.confirm = (s) => n("ConfirmPrompt", s), t.list = (s) => {
      const d = s.separator || ",";
      return n("TextPrompt", s, {
        onSubmit: (l) => l.split(d).map((u) => u.trim())
      });
    }, t.toggle = (s) => n("TogglePrompt", s), t.select = (s) => n("SelectPrompt", s), t.multiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const d = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("MultiselectPrompt", s, {
        onAbort: d,
        onSubmit: d
      });
    }, t.autocompleteMultiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const d = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("AutocompleteMultiselectPrompt", s, {
        onAbort: d,
        onSubmit: d
      });
    };
    const a = (s, d) => Promise.resolve(
      d.filter((l) => l.title.slice(0, s.length).toLowerCase() === s.toLowerCase())
    );
    t.autocomplete = (s) => (s.suggest = s.suggest || a, s.choices = [].concat(s.choices || []), n("AutocompletePrompt", s));
  }(We)), We;
}
var Ot, ti;
function hn() {
  if (ti)
    return Ot;
  ti = 1;
  const e = un(), t = ["suggest", "format", "onState", "validate", "onRender", "type"], i = () => {
  };
  async function r(d = [], { onSubmit: l = i, onCancel: u = i } = {}) {
    const o = {}, p = r._override || {};
    d = [].concat(d);
    let h, c, m, x, y, g;
    const v = async (S, b, f = !1) => {
      if (!(!f && S.validate && S.validate(b) !== !0))
        return S.format ? await S.format(b, o) : b;
    };
    for (c of d)
      if ({ name: x, type: y } = c, typeof y == "function" && (y = await y(h, { ...o }, c), c.type = y), !!y) {
        for (let S in c) {
          if (t.includes(S))
            continue;
          let b = c[S];
          c[S] = typeof b == "function" ? await b(h, { ...o }, g) : b;
        }
        if (g = c, typeof c.message != "string")
          throw new Error("prompt message is required");
        if ({ name: x, type: y } = c, e[y] === void 0)
          throw new Error(`prompt type (${y}) is not defined`);
        if (p[c.name] !== void 0 && (h = await v(c, p[c.name]), h !== void 0)) {
          o[x] = h;
          continue;
        }
        try {
          h = r._injected ? n(r._injected, c.initial) : await e[y](c), o[x] = h = await v(c, h, !0), m = await l(c, h, o);
        } catch {
          m = !await u(c, o);
        }
        if (m)
          return o;
      }
    return o;
  }
  function n(d, l) {
    const u = d.shift();
    if (u instanceof Error)
      throw u;
    return u === void 0 ? l : u;
  }
  function a(d) {
    r._injected = (r._injected || []).concat(d);
  }
  function s(d) {
    r._override = Object.assign({}, d);
  }
  return Ot = Object.assign(r, { prompt: r, prompts: e, inject: a, override: s }), Ot;
}
function cn(e) {
  e = (Array.isArray(e) ? e : e.split(".")).map(Number);
  let t = 0, i = process.versions.node.split(".").map(Number);
  for (; t < e.length; t++) {
    if (i[t] > e[t])
      return !1;
    if (e[t] > i[t])
      return !0;
  }
  return !1;
}
var Pi = cn("8.6.0") ? js() : hn(), Ei = { exports: {} };
(function(e, t) {
  (function(i, r) {
    e.exports = r();
  })(Z, function() {
    function i(b, f) {
      if (!(b instanceof f))
        throw new TypeError("Cannot call a class as a function");
    }
    function r(b, f) {
      for (var w = 0; w < f.length; w++) {
        var O = f[w];
        O.enumerable = O.enumerable || !1, O.configurable = !0, "value" in O && (O.writable = !0), Object.defineProperty(b, O.key, O);
      }
    }
    function n(b, f, w) {
      return f && r(b.prototype, f), w && r(b, w), b;
    }
    function a(b, f, w) {
      return f in b ? Object.defineProperty(b, f, { value: w, enumerable: !0, configurable: !0, writable: !0 }) : b[f] = w, b;
    }
    function s(b, f) {
      var w = Object.keys(b);
      if (Object.getOwnPropertySymbols) {
        var O = Object.getOwnPropertySymbols(b);
        f && (O = O.filter(function(T) {
          return Object.getOwnPropertyDescriptor(b, T).enumerable;
        })), w.push.apply(w, O);
      }
      return w;
    }
    function d(b) {
      for (var f = 1; f < arguments.length; f++) {
        var w = arguments[f] != null ? arguments[f] : {};
        f % 2 ? s(Object(w), !0).forEach(function(O) {
          a(b, O, w[O]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(b, Object.getOwnPropertyDescriptors(w)) : s(Object(w)).forEach(function(O) {
          Object.defineProperty(b, O, Object.getOwnPropertyDescriptor(w, O));
        });
      }
      return b;
    }
    function l(b) {
      return function(f) {
        if (Array.isArray(f))
          return o(f);
      }(b) || function(f) {
        if (typeof Symbol < "u" && Symbol.iterator in Object(f))
          return Array.from(f);
      }(b) || u(b) || function() {
        throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
      }();
    }
    function u(b, f) {
      if (b) {
        if (typeof b == "string")
          return o(b, f);
        var w = Object.prototype.toString.call(b).slice(8, -1);
        return w === "Object" && b.constructor && (w = b.constructor.name), w === "Map" || w === "Set" ? Array.from(b) : w === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(w) ? o(b, f) : void 0;
      }
    }
    function o(b, f) {
      (f == null || f > b.length) && (f = b.length);
      for (var w = 0, O = new Array(f); w < f; w++)
        O[w] = b[w];
      return O;
    }
    function p(b) {
      if (typeof Symbol > "u" || b[Symbol.iterator] == null) {
        if (Array.isArray(b) || (b = u(b))) {
          var f = 0, w = function() {
          };
          return { s: w, n: function() {
            return f >= b.length ? { done: !0 } : { done: !1, value: b[f++] };
          }, e: function(C) {
            throw C;
          }, f: w };
        }
        throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
      }
      var O, T, $ = !0, _ = !1;
      return { s: function() {
        O = b[Symbol.iterator]();
      }, n: function() {
        var C = O.next();
        return $ = C.done, C;
      }, e: function(C) {
        _ = !0, T = C;
      }, f: function() {
        try {
          $ || O.return == null || O.return();
        } finally {
          if (_)
            throw T;
        }
      } };
    }
    var h = {};
    h[h.Fatal = 0] = "Fatal", h[h.Error = 0] = "Error", h[h.Warn = 1] = "Warn", h[h.Log = 2] = "Log", h[h.Info = 3] = "Info", h[h.Success = 3] = "Success", h[h.Debug = 4] = "Debug", h[h.Trace = 5] = "Trace", h[h.Silent = -1 / 0] = "Silent", h[h.Verbose = 1 / 0] = "Verbose";
    var c = { silent: { level: -1 }, fatal: { level: h.Fatal }, error: { level: h.Error }, warn: { level: h.Warn }, log: { level: h.Log }, info: { level: h.Info }, success: { level: h.Success }, debug: { level: h.Debug }, trace: { level: h.Trace }, verbose: { level: h.Trace }, ready: { level: h.Info }, start: { level: h.Info } };
    function m(b) {
      return f = b, Object.prototype.toString.call(f) === "[object Object]" && !(!b.message && !b.args) && !b.stack;
      var f;
    }
    var x = !1, y = [], g = function() {
      function b() {
        var f = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        for (var w in i(this, b), this._reporters = f.reporters || [], this._types = f.types || c, this.level = f.level !== void 0 ? f.level : 3, this._defaults = f.defaults || {}, this._async = f.async !== void 0 ? f.async : void 0, this._stdout = f.stdout, this._stderr = f.stderr, this._mockFn = f.mockFn, this._throttle = f.throttle || 1e3, this._throttleMin = f.throttleMin || 5, this._types) {
          var O = d(d({ type: w }, this._types[w]), this._defaults);
          this[w] = this._wrapLogFn(O), this[w].raw = this._wrapLogFn(O, !0);
        }
        this._mockFn && this.mockTypes(), this._lastLogSerialized = void 0, this._lastLog = void 0, this._lastLogTime = void 0, this._lastLogCount = 0, this._throttleTimeout = void 0;
      }
      return n(b, [{ key: "create", value: function(f) {
        return new b(Object.assign({ reporters: this._reporters, level: this.level, types: this._types, defaults: this._defaults, stdout: this._stdout, stderr: this._stderr, mockFn: this._mockFn }, f));
      } }, { key: "withDefaults", value: function(f) {
        return this.create({ defaults: Object.assign({}, this._defaults, f) });
      } }, { key: "withTag", value: function(f) {
        return this.withDefaults({ tag: this._defaults.tag ? this._defaults.tag + ":" + f : f });
      } }, { key: "addReporter", value: function(f) {
        return this._reporters.push(f), this;
      } }, { key: "removeReporter", value: function(f) {
        if (f) {
          var w = this._reporters.indexOf(f);
          if (w >= 0)
            return this._reporters.splice(w, 1);
        } else
          this._reporters.splice(0);
        return this;
      } }, { key: "setReporters", value: function(f) {
        return this._reporters = Array.isArray(f) ? f : [f], this;
      } }, { key: "wrapAll", value: function() {
        this.wrapConsole(), this.wrapStd();
      } }, { key: "restoreAll", value: function() {
        this.restoreConsole(), this.restoreStd();
      } }, { key: "wrapConsole", value: function() {
        for (var f in this._types)
          console["__" + f] || (console["__" + f] = console[f]), console[f] = this[f].raw;
      } }, { key: "restoreConsole", value: function() {
        for (var f in this._types)
          console["__" + f] && (console[f] = console["__" + f], delete console["__" + f]);
      } }, { key: "wrapStd", value: function() {
        this._wrapStream(this.stdout, "log"), this._wrapStream(this.stderr, "log");
      } }, { key: "_wrapStream", value: function(f, w) {
        var O = this;
        f && (f.__write || (f.__write = f.write), f.write = function(T) {
          O[w].raw(String(T).trim());
        });
      } }, { key: "restoreStd", value: function() {
        this._restoreStream(this.stdout), this._restoreStream(this.stderr);
      } }, { key: "_restoreStream", value: function(f) {
        f && f.__write && (f.write = f.__write, delete f.__write);
      } }, { key: "pauseLogs", value: function() {
        x = !0;
      } }, { key: "resumeLogs", value: function() {
        x = !1;
        var f, w = p(y.splice(0));
        try {
          for (w.s(); !(f = w.n()).done; ) {
            var O = f.value;
            O[0]._logFn(O[1], O[2]);
          }
        } catch (T) {
          w.e(T);
        } finally {
          w.f();
        }
      } }, { key: "mockTypes", value: function(f) {
        if (this._mockFn = f || this._mockFn, typeof this._mockFn == "function")
          for (var w in this._types)
            this[w] = this._mockFn(w, this._types[w]) || this[w], this[w].raw = this[w];
      } }, { key: "_wrapLogFn", value: function(f, w) {
        var O = this;
        return function() {
          for (var T = arguments.length, $ = new Array(T), _ = 0; _ < T; _++)
            $[_] = arguments[_];
          if (!x)
            return O._logFn(f, $, w);
          y.push([O, f, $, w]);
        };
      } }, { key: "_logFn", value: function(f, w, O) {
        var T = this;
        if (f.level > this.level)
          return !!this._async && Promise.resolve(!1);
        var $ = Object.assign({ date: new Date(), args: [] }, f);
        !O && w.length === 1 && m(w[0]) ? Object.assign($, w[0]) : $.args = Array.from(w), $.message && ($.args.unshift($.message), delete $.message), $.additional && (Array.isArray($.additional) || ($.additional = $.additional.split(`
`)), $.args.push(`
` + $.additional.join(`
`)), delete $.additional), $.type = typeof $.type == "string" ? $.type.toLowerCase() : "", $.tag = typeof $.tag == "string" ? $.tag.toLowerCase() : "";
        var _ = function() {
          var D = arguments.length > 0 && arguments[0] !== void 0 && arguments[0], j = T._lastLogCount - T._throttleMin;
          if (T._lastLog && j > 0) {
            var q = l(T._lastLog.args);
            j > 1 && q.push("(repeated ".concat(j, " times)")), T._log(d(d({}, T._lastLog), {}, { args: q })), T._lastLogCount = 1;
          }
          if (D) {
            if (T._lastLog = $, T._async)
              return T._logAsync($);
            T._log($);
          }
        };
        clearTimeout(this._throttleTimeout);
        var C = this._lastLogTime ? $.date - this._lastLogTime : 0;
        if (this._lastLogTime = $.date, C < this._throttle)
          try {
            var R = JSON.stringify([$.type, $.tag, $.args]), A = this._lastLogSerialized === R;
            if (this._lastLogSerialized = R, A && (this._lastLogCount++, this._lastLogCount > this._throttleMin))
              return void (this._throttleTimeout = setTimeout(_, this._throttle));
          } catch {
          }
        _(!0);
      } }, { key: "_log", value: function(f) {
        var w, O = p(this._reporters);
        try {
          for (O.s(); !(w = O.n()).done; )
            w.value.log(f, { async: !1, stdout: this.stdout, stderr: this.stderr });
        } catch (T) {
          O.e(T);
        } finally {
          O.f();
        }
      } }, { key: "_logAsync", value: function(f) {
        var w = this;
        return Promise.all(this._reporters.map(function(O) {
          return O.log(f, { async: !0, stdout: w.stdout, stderr: w.stderr });
        }));
      } }, { key: "stdout", get: function() {
        return this._stdout || console._stdout;
      } }, { key: "stderr", get: function() {
        return this._stderr || console._stderr;
      } }]), b;
    }();
    g.prototype.add = g.prototype.addReporter, g.prototype.remove = g.prototype.removeReporter, g.prototype.clear = g.prototype.removeReporter, g.prototype.withScope = g.prototype.withTag, g.prototype.mock = g.prototype.mockTypes, g.prototype.pause = g.prototype.pauseLogs, g.prototype.resume = g.prototype.resumeLogs;
    var v, S = function() {
      function b(f) {
        i(this, b), this.options = Object.assign({}, f), this.defaultColor = "#7f8c8d", this.levelColorMap = { 0: "#c0392b", 1: "#f39c12", 3: "#00BCD4" }, this.typeColorMap = { success: "#2ecc71" };
      }
      return n(b, [{ key: "log", value: function(f) {
        var w = f.level < 1 ? console.__error || console.error : f.level === 1 && console.warn ? console.__warn || console.warn : console.__log || console.log, O = f.type !== "log" ? f.type : "", T = f.tag ? f.tag : "", $ = this.typeColorMap[f.type] || this.levelColorMap[f.level] || this.defaultColor, _ = `
      background: `.concat($, `;
      border-radius: 0.5em;
      color: white;
      font-weight: bold;
      padding: 2px 0.5em;
    `), C = "%c".concat([T, O].filter(Boolean).join(":"));
        typeof f.args[0] == "string" ? w.apply(void 0, ["".concat(C, "%c ").concat(f.args[0]), _, ""].concat(l(f.args.slice(1)))) : w.apply(void 0, [C, _].concat(l(f.args)));
      } }]), b;
    }();
    return typeof window < "u" && window.consola || ((v = new g({ reporters: [new S()] })).Consola = g, v.LogLevel = h, v.BrowserReporter = S, v);
  });
})(Ei);
const I = Ei.exports;
var ue = /* @__PURE__ */ ((e) => (e[e.Success = 0] = "Success", e[e.FatalError = 1] = "FatalError", e[e.InvalidArgument = 9] = "InvalidArgument", e))(ue || {}), L = /* @__PURE__ */ ((e) => (e.Build = "build", e.BuildComponents = "build:components", e.BuildElements = "build:elements", e.BuildFunctions = "build:functions", e.BuildPages = "build:pages", e.BuildDocs = "build:docs", e.BuildArtisanCli = "build:artisan-cli", e.Dev = "dev", e.DevComponents = "dev:components", e.DevFunctions = "dev:functions", e.DevPages = "dev:pages", e.DevDocs = "dev:docs", e.Fresh = "fresh", e.Update = "update", e))(L || {}), Ai = {};
(function(e) {
  e.__esModule = !0;
  function t(r, n, a) {
    var s = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi, d = r, l = [];
    n && l.push(n), a && l.push(a);
    var u;
    do
      u = s.exec(d), u !== null && l.push(i(u[1], u[6], u[0]));
    while (u !== null);
    return l;
  }
  e.default = t, e.parseArgsStringToArgv = t;
  function i() {
    for (var r = [], n = 0; n < arguments.length; n++)
      r[n] = arguments[n];
    for (var a = 0; a < r.length; a++) {
      var s = r[a];
      if (typeof s == "string")
        return s;
    }
  }
})(Ai);
var Di = { exports: {} };
(function(e, t) {
  (function(i, r) {
    e.exports = r();
  })(Z, function() {
    var i = typeof Promise == "function", r = typeof self == "object" ? self : Z, n = typeof Symbol < "u", a = typeof Map < "u", s = typeof Set < "u", d = typeof WeakMap < "u", l = typeof WeakSet < "u", u = typeof DataView < "u", o = n && typeof Symbol.iterator < "u", p = n && typeof Symbol.toStringTag < "u", h = s && typeof Set.prototype.entries == "function", c = a && typeof Map.prototype.entries == "function", m = h && Object.getPrototypeOf((/* @__PURE__ */ new Set()).entries()), x = c && Object.getPrototypeOf((/* @__PURE__ */ new Map()).entries()), y = o && typeof Array.prototype[Symbol.iterator] == "function", g = y && Object.getPrototypeOf([][Symbol.iterator]()), v = o && typeof String.prototype[Symbol.iterator] == "function", S = v && Object.getPrototypeOf(""[Symbol.iterator]()), b = 8, f = -1;
    function w(O) {
      var T = typeof O;
      if (T !== "object")
        return T;
      if (O === null)
        return "null";
      if (O === r)
        return "global";
      if (Array.isArray(O) && (p === !1 || !(Symbol.toStringTag in O)))
        return "Array";
      if (typeof window == "object" && window !== null) {
        if (typeof window.location == "object" && O === window.location)
          return "Location";
        if (typeof window.document == "object" && O === window.document)
          return "Document";
        if (typeof window.navigator == "object") {
          if (typeof window.navigator.mimeTypes == "object" && O === window.navigator.mimeTypes)
            return "MimeTypeArray";
          if (typeof window.navigator.plugins == "object" && O === window.navigator.plugins)
            return "PluginArray";
        }
        if ((typeof window.HTMLElement == "function" || typeof window.HTMLElement == "object") && O instanceof window.HTMLElement) {
          if (O.tagName === "BLOCKQUOTE")
            return "HTMLQuoteElement";
          if (O.tagName === "TD")
            return "HTMLTableDataCellElement";
          if (O.tagName === "TH")
            return "HTMLTableHeaderCellElement";
        }
      }
      var $ = p && O[Symbol.toStringTag];
      if (typeof $ == "string")
        return $;
      var _ = Object.getPrototypeOf(O);
      return _ === RegExp.prototype ? "RegExp" : _ === Date.prototype ? "Date" : i && _ === Promise.prototype ? "Promise" : s && _ === Set.prototype ? "Set" : a && _ === Map.prototype ? "Map" : l && _ === WeakSet.prototype ? "WeakSet" : d && _ === WeakMap.prototype ? "WeakMap" : u && _ === DataView.prototype ? "DataView" : a && _ === x ? "Map Iterator" : s && _ === m ? "Set Iterator" : y && _ === g ? "Array Iterator" : v && _ === S ? "String Iterator" : _ === null ? "Object" : Object.prototype.toString.call(O).slice(b, f);
    }
    return w;
  });
})(Di);
const { parseArgsStringToArgv: dn } = Ai, fn = Di.exports;
var pn = mn;
function mn(e) {
  let t, i, r, n, a;
  try {
    ({ command: t, args: i, options: r, callback: n } = gn(e));
    let s = [];
    typeof t == "string" && i === void 0 && (t = ri(t)), Array.isArray(t) && (s = t.slice(1), t = t[0]), typeof i == "string" && (i = ri(i)), Array.isArray(i) && (i = s.concat(i)), i == null && (i = s), r == null && (r = {}), r.encoding = r.encoding || "utf8", vn(t, i, r, n);
  } catch (s) {
    a = s, t = String(t || ""), i = (Array.isArray(i) ? i : []).map((d) => String(d || ""));
  }
  return { command: t, args: i, options: r, callback: n, error: a };
}
function gn(e) {
  e = Array.prototype.slice.call(e);
  let t, i, r, n, a = e[e.length - 1];
  return typeof a == "function" && (n = a, e.pop()), a = e[e.length - 1], (a == null || typeof a == "object" && !Array.isArray(a)) && (r = a, e.pop()), t = e.shift(), e.length === 0 ? i = void 0 : e.length === 1 && Array.isArray(e[0]) ? i = e[0] : e.length === 1 && e[0] === "" ? i = [] : i = e, { command: t, args: i, options: r, callback: n };
}
function vn(e, t, i, r) {
  if (e == null)
    throw new Error("The command to execute is missing.");
  if (typeof e != "string")
    throw new Error("The command to execute should be a string, not " + Q(e));
  if (!Array.isArray(t))
    throw new Error(
      "The command arguments should be a string or an array, not " + Q(t)
    );
  for (let n = 0; n < t.length; n++) {
    let a = t[n];
    if (typeof a != "string")
      throw new Error(
        `The command arguments should be strings, but argument #${n + 1} is ` + Q(a)
      );
  }
  if (typeof i != "object")
    throw new Error(
      "The options should be an object, not " + Q(i)
    );
  if (r != null && typeof r != "function")
    throw new Error("The callback should be a function, not " + Q(r));
}
function ri(e) {
  try {
    return dn(e);
  } catch (t) {
    throw new Error(`Could not parse the string: ${e}
${t.message}`);
  }
}
function Q(e) {
  let t = fn(e), i = String(t)[0].toLowerCase();
  return ["a", "e", "i", "o", "u"].indexOf(i) === -1 ? `a ${t}.` : `an ${t}.`;
}
var yn = class {
  constructor({ command: t, args: i, pid: r, stdout: n, stderr: a, output: s, status: d, signal: l, options: u }) {
    u = u || {}, n = n || (u.encoding === "buffer" ? Buffer.from([]) : ""), a = a || (u.encoding === "buffer" ? Buffer.from([]) : ""), s = s || [u.input || null, n, a], this.command = t || "", this.args = i || [], this.pid = r || 0, this.stdout = s[1], this.stderr = s[2], this.output = s, this.status = d, this.signal = l || null;
  }
  toString() {
    let t = this.command;
    for (let i of this.args)
      i = i.replace(/"/g, '\\"'), i.indexOf(" ") >= 0 ? t += ` "${i}"` : t += ` ${i}`;
    return t;
  }
}, bn = class Ri extends Error {
  constructor(t) {
    let i = `${t.toString()} exited with a status of ${t.status}.`;
    t.stderr.length > 0 && (i += `

` + t.stderr.toString().trim()), super(i), Object.assign(this, t), this.name = Ri.name;
  }
};
const wn = yn, xn = bn;
var Sn = On;
function On({ command: e, args: t, pid: i, stdout: r, stderr: n, output: a, status: s, signal: d, options: l, error: u }) {
  let o = new wn({ command: e, args: t, pid: i, stdout: r, stderr: n, output: a, status: s, signal: d, options: l });
  if (u)
    throw o.status === void 0 && (o.status = null), Object.assign(u, o);
  if (o.status)
    throw new xn(o);
  return o;
}
var G = { exports: {} }, $t, ii;
function $n() {
  if (ii)
    return $t;
  ii = 1, $t = r, r.sync = n;
  var e = X;
  function t(a, s) {
    var d = s.pathExt !== void 0 ? s.pathExt : process.env.PATHEXT;
    if (!d || (d = d.split(";"), d.indexOf("") !== -1))
      return !0;
    for (var l = 0; l < d.length; l++) {
      var u = d[l].toLowerCase();
      if (u && a.substr(-u.length).toLowerCase() === u)
        return !0;
    }
    return !1;
  }
  function i(a, s, d) {
    return !a.isSymbolicLink() && !a.isFile() ? !1 : t(s, d);
  }
  function r(a, s, d) {
    e.stat(a, function(l, u) {
      d(l, l ? !1 : i(u, a, s));
    });
  }
  function n(a, s) {
    return i(e.statSync(a), a, s);
  }
  return $t;
}
var _t, si;
function _n() {
  if (si)
    return _t;
  si = 1, _t = t, t.sync = i;
  var e = X;
  function t(a, s, d) {
    e.stat(a, function(l, u) {
      d(l, l ? !1 : r(u, s));
    });
  }
  function i(a, s) {
    return r(e.statSync(a), s);
  }
  function r(a, s) {
    return a.isFile() && n(a, s);
  }
  function n(a, s) {
    var d = a.mode, l = a.uid, u = a.gid, o = s.uid !== void 0 ? s.uid : process.getuid && process.getuid(), p = s.gid !== void 0 ? s.gid : process.getgid && process.getgid(), h = parseInt("100", 8), c = parseInt("010", 8), m = parseInt("001", 8), x = h | c, y = d & m || d & c && u === p || d & h && l === o || d & x && o === 0;
    return y;
  }
  return _t;
}
var oe;
process.platform === "win32" || Z.TESTING_WINDOWS ? oe = $n() : oe = _n();
var Tn = Dt;
Dt.sync = Cn;
function Dt(e, t, i) {
  if (typeof t == "function" && (i = t, t = {}), !i) {
    if (typeof Promise != "function")
      throw new TypeError("callback not provided");
    return new Promise(function(r, n) {
      Dt(e, t || {}, function(a, s) {
        a ? n(a) : r(s);
      });
    });
  }
  oe(e, t || {}, function(r, n) {
    r && (r.code === "EACCES" || t && t.ignoreErrors) && (r = null, n = !1), i(r, n);
  });
}
function Cn(e, t) {
  try {
    return oe.sync(e, t || {});
  } catch (i) {
    if (t && t.ignoreErrors || i.code === "EACCES")
      return !1;
    throw i;
  }
}
const K = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", Ii = ae, Mn = K ? ";" : ":", qi = Tn, ki = (e) => Object.assign(new Error(`not found: ${e}`), { code: "ENOENT" }), ji = (e, t) => {
  const i = t.colon || Mn, r = e.match(/\//) || K && e.match(/\\/) ? [""] : [
    ...K ? [process.cwd()] : [],
    ...(t.path || process.env.PATH || "").split(i)
  ], n = K ? t.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", a = K ? n.split(i) : [""];
  return K && e.indexOf(".") !== -1 && a[0] !== "" && a.unshift(""), {
    pathEnv: r,
    pathExt: a,
    pathExtExe: n
  };
}, Li = (e, t, i) => {
  typeof t == "function" && (i = t, t = {}), t || (t = {});
  const { pathEnv: r, pathExt: n, pathExtExe: a } = ji(e, t), s = [], d = (u) => new Promise((o, p) => {
    if (u === r.length)
      return t.all && s.length ? o(s) : p(ki(e));
    const h = r[u], c = /^".*"$/.test(h) ? h.slice(1, -1) : h, m = Ii.join(c, e), x = !c && /^\.[\\\/]/.test(e) ? e.slice(0, 2) + m : m;
    o(l(x, u, 0));
  }), l = (u, o, p) => new Promise((h, c) => {
    if (p === n.length)
      return h(d(o + 1));
    const m = n[p];
    qi(u + m, { pathExt: a }, (x, y) => {
      if (!x && y)
        if (t.all)
          s.push(u + m);
        else
          return h(u + m);
      return h(l(u, o, p + 1));
    });
  });
  return i ? d(0).then((u) => i(null, u), i) : d(0);
}, Pn = (e, t) => {
  t = t || {};
  const { pathEnv: i, pathExt: r, pathExtExe: n } = ji(e, t), a = [];
  for (let s = 0; s < i.length; s++) {
    const d = i[s], l = /^".*"$/.test(d) ? d.slice(1, -1) : d, u = Ii.join(l, e), o = !l && /^\.[\\\/]/.test(e) ? e.slice(0, 2) + u : u;
    for (let p = 0; p < r.length; p++) {
      const h = o + r[p];
      try {
        if (qi.sync(h, { pathExt: n }))
          if (t.all)
            a.push(h);
          else
            return h;
      } catch {
      }
    }
  }
  if (t.all && a.length)
    return a;
  if (t.nothrow)
    return null;
  throw ki(e);
};
var En = Li;
Li.sync = Pn;
var Rt = { exports: {} };
const Fi = (e = {}) => {
  const t = e.env || process.env;
  return (e.platform || process.platform) !== "win32" ? "PATH" : Object.keys(t).reverse().find((r) => r.toUpperCase() === "PATH") || "Path";
};
Rt.exports = Fi;
Rt.exports.default = Fi;
const ni = ae, An = En, Dn = Rt.exports;
function oi(e, t) {
  const i = e.options.env || process.env, r = process.cwd(), n = e.options.cwd != null, a = n && process.chdir !== void 0 && !process.chdir.disabled;
  if (a)
    try {
      process.chdir(e.options.cwd);
    } catch {
    }
  let s;
  try {
    s = An.sync(e.command, {
      path: i[Dn({ env: i })],
      pathExt: t ? ni.delimiter : void 0
    });
  } catch {
  } finally {
    a && process.chdir(r);
  }
  return s && (s = ni.resolve(n ? e.options.cwd : "", s)), s;
}
function Rn(e) {
  return oi(e) || oi(e, !0);
}
var In = Rn, It = {};
const Pt = /([()\][%!^"`<>&|;, *?])/g;
function qn(e) {
  return e = e.replace(Pt, "^$1"), e;
}
function kn(e, t) {
  return e = `${e}`, e = e.replace(/(\\*)"/g, '$1$1\\"'), e = e.replace(/(\\*)$/, "$1$1"), e = `"${e}"`, e = e.replace(Pt, "^$1"), t && (e = e.replace(Pt, "^$1")), e;
}
It.command = qn;
It.argument = kn;
var jn = /^#!(.*)/;
const Ln = jn;
var Fn = (e = "") => {
  const t = e.match(Ln);
  if (!t)
    return null;
  const [i, r] = t[0].replace(/#! ?/, "").split(" "), n = i.split("/").pop();
  return n === "env" ? r : r ? `${n} ${r}` : n;
};
const Tt = X, Nn = Fn;
function Hn(e) {
  const i = Buffer.alloc(150);
  let r;
  try {
    r = Tt.openSync(e, "r"), Tt.readSync(r, i, 0, 150, 0), Tt.closeSync(r);
  } catch {
  }
  return Nn(i.toString());
}
var Bn = Hn;
const Vn = ae, ai = In, li = It, Yn = Bn, Un = process.platform === "win32", Wn = /\.(?:com|exe)$/i, Gn = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
function zn(e) {
  e.file = ai(e);
  const t = e.file && Yn(e.file);
  return t ? (e.args.unshift(e.file), e.command = t, ai(e)) : e.file;
}
function Kn(e) {
  if (!Un)
    return e;
  const t = zn(e), i = !Wn.test(t);
  if (e.options.forceShell || i) {
    const r = Gn.test(t);
    e.command = Vn.normalize(e.command), e.command = li.command(e.command), e.args = e.args.map((a) => li.argument(a, r));
    const n = [e.command].concat(e.args).join(" ");
    e.args = ["/d", "/s", "/c", `"${n}"`], e.command = process.env.comspec || "cmd.exe", e.options.windowsVerbatimArguments = !0;
  }
  return e;
}
function Jn(e, t, i) {
  t && !Array.isArray(t) && (i = t, t = null), t = t ? t.slice(0) : [], i = Object.assign({}, i);
  const r = {
    command: e,
    args: t,
    options: i,
    file: void 0,
    original: {
      command: e,
      args: t
    }
  };
  return i.shell ? r : Kn(r);
}
var Zn = Jn;
const qt = process.platform === "win32";
function kt(e, t) {
  return Object.assign(new Error(`${t} ${e.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${t} ${e.command}`,
    path: e.command,
    spawnargs: e.args
  });
}
function Xn(e, t) {
  if (!qt)
    return;
  const i = e.emit;
  e.emit = function(r, n) {
    if (r === "exit") {
      const a = Ni(n, t);
      if (a)
        return i.call(e, "error", a);
    }
    return i.apply(e, arguments);
  };
}
function Ni(e, t) {
  return qt && e === 1 && !t.file ? kt(t.original, "spawn") : null;
}
function Qn(e, t) {
  return qt && e === 1 && !t.file ? kt(t.original, "spawnSync") : null;
}
var eo = {
  hookChildProcess: Xn,
  verifyENOENT: Ni,
  verifyENOENTSync: Qn,
  notFoundError: kt
};
const Hi = X, jt = Zn, Lt = eo;
function Bi(e, t, i) {
  const r = jt(e, t, i), n = Hi.spawn(r.command, r.args, r.options);
  return Lt.hookChildProcess(n, r), n;
}
function to(e, t, i) {
  const r = jt(e, t, i), n = Hi.spawnSync(r.command, r.args, r.options);
  return n.error = n.error || Lt.verifyENOENTSync(n.status, r), n;
}
G.exports = Bi;
G.exports.spawn = Bi;
G.exports.sync = to;
G.exports._parse = jt;
G.exports._enoent = Lt;
G.exports.sync;
var ui = Z.process && process.nextTick || Z.setImmediate || function(e) {
  setTimeout(e, 0);
}, ro = function(t, i) {
  if (t) {
    i.then(function(r) {
      ui(function() {
        t(null, r);
      });
    }, function(r) {
      ui(function() {
        t(r);
      });
    });
    return;
  } else
    return i;
};
const io = pn, se = Sn, so = ro, no = G.exports;
var oo = ao;
function ao() {
  let { command: e, args: t, options: i, callback: r, error: n } = io(arguments);
  return so(r, new Promise((a, s) => {
    if (n)
      se({ command: e, args: t, options: i, error: n });
    else {
      let d;
      try {
        d = no(e, t, i);
      } catch (p) {
        se({ error: p, command: e, args: t, options: i });
      }
      let l = d.pid, u = i.encoding === "buffer" ? Buffer.from([]) : "", o = i.encoding === "buffer" ? Buffer.from([]) : "";
      d.stdout && d.stdout.on("data", (p) => {
        typeof u == "string" ? u += p.toString() : u = Buffer.concat([u, p]);
      }), d.stderr && d.stderr.on("data", (p) => {
        typeof o == "string" ? o += p.toString() : o = Buffer.concat([o, p]);
      }), d.on("error", (p) => {
        try {
          se({ error: p, command: e, args: t, options: i, pid: l, stdout: u, stderr: o });
        } catch (h) {
          s(h);
        }
      }), d.on("exit", (p, h) => {
        try {
          a(se({ command: e, args: t, options: i, pid: l, stdout: u, stderr: o, status: p, signal: h }));
        } catch (c) {
          s(c);
        }
      });
    }
  }));
}
var lo = oo;
const uo = /^(?:( )+|\t+)/, te = "space", Vi = "tab";
function hi(e, t) {
  const i = /* @__PURE__ */ new Map();
  let r = 0, n, a;
  for (const s of e.split(/\n/g)) {
    if (!s)
      continue;
    let d, l, u, o;
    const p = s.match(uo);
    if (p === null)
      r = 0, n = "";
    else {
      if (d = p[0].length, l = p[1] ? te : Vi, t && l === te && d === 1)
        continue;
      l !== n && (r = 0), n = l, u = 0;
      const h = d - r;
      if (r = d, h === 0)
        u++;
      else {
        const c = h > 0 ? h : -h;
        a = ho(l, c);
      }
      o = i.get(a), o = o === void 0 ? [1, 0] : [++o[0], o[1] + u], i.set(a, o);
    }
  }
  return i;
}
function ho(e, t) {
  return (e === te ? "s" : "t") + String(t);
}
function co(e) {
  const i = e[0] === "s" ? te : Vi, r = Number(e.slice(1));
  return { type: i, amount: r };
}
function fo(e) {
  let t, i = 0, r = 0;
  for (const [n, [a, s]] of e)
    (a > i || a === i && s > r) && (i = a, r = s, t = n);
  return t;
}
function po(e, t) {
  return (e === te ? " " : "	").repeat(t);
}
function mo(e) {
  if (typeof e != "string")
    throw new TypeError("Expected a string");
  let t = hi(e, !0);
  t.size === 0 && (t = hi(e, !1));
  const i = fo(t);
  let r, n = 0, a = "";
  return i !== void 0 && ({ type: r, amount: n } = co(i), a = po(r, n)), {
    amount: n,
    type: r,
    indent: a
  };
}
function go(e) {
  if (typeof e != "string")
    throw new TypeError("Expected a string");
  const t = e.match(/(?:\r?\n)/g) || [];
  if (t.length === 0)
    return;
  const i = t.filter((n) => n === `\r
`).length, r = t.length - i;
  return i > r ? `\r
` : `
`;
}
async function vo(e, t) {
  const i = await yo(e, t), r = JSON.parse(i.data), n = mo(i.data).indent, a = go(i.data);
  return { ...i, data: r, indent: n, newline: a };
}
function yo(e, t) {
  return new Promise((i, r) => {
    const n = ae.join(t, e);
    $i.readFile(n, "utf8", (a, s) => {
      a ? r(a) : i({
        path: n,
        data: s
      });
    });
  });
}
function bo(e) {
  return e && typeof e == "object" && Ct(e.name) && Ct(e.version) && Ct(e.description);
}
function Ct(e) {
  const t = typeof e;
  return e === null || t === "undefined" || t === "string";
}
async function F(e) {
  const t = Yi(process.cwd()), { data: i } = await vo("package.json", t);
  bo(i) && wo(i, e) && await lo("npm", ["run", e, "--silent"], { stdio: "inherit" });
}
function wo(e, t) {
  const i = e.scripts;
  return i && typeof i == "object" ? Boolean(i[t]) : !1;
}
const { prompts: xo } = Pi;
async function ci(e) {
  e.components || e === "components" ? (I.info("Starting development server for your components..."), await F(L.DevComponents)) : await xo.select({
    type: "select",
    name: "development",
    message: "Which development server are you trying to start?",
    choices: [
      { title: "Components", value: "components" },
      { title: "Functions", value: "functions" },
      { title: "Pages", value: "pages" },
      { title: "Docs", value: "docs" }
    ],
    initial: 0
  }) === "components" ? (I.info("Starting development server for your components..."), await F(L.DevComponents)) : process.exit(ue.InvalidArgument);
}
const { prompts: So } = Pi;
async function ee(e) {
  if (e.components || e === "components")
    I.info("Building your component library for production use & npm/CDN distribution..."), await F(L.BuildComponents), I.success("Your component library was built successfully."), I.info("Building your web component library for production use & npm/CDN distribution..."), await F(L.BuildElements), I.success("Your web components library was built successfully.");
  else if (e.webComponents || e.elements || e === "web-components" || e === "elements")
    I.info("Building your web component library for production use & npm/CDN distribution..."), await F(L.BuildElements), I.success("Your web components library was built successfully.");
  else if (e.functions || e === "functions")
    I.info("Building your functions library for production use & npm/CDN distribution..."), await F(L.BuildFunctions), I.success("Your functions library was built successfully.");
  else if (e.artisanCli || e === "artisan-cli")
    I.info("Building the Artisan CLI..."), await F(L.BuildArtisanCli), I.success("The Artisan CLI was built successfully.");
  else {
    const t = await So.select({
      type: "select",
      name: "build",
      message: "Which stack are you trying to build for production use?",
      choices: [
        { title: "Components", value: "components" },
        { title: "Functions", value: "functions" },
        { title: "Pages", value: "pages" },
        { title: "Docs", value: "docs" }
      ],
      initial: 0
    });
    t === "components" ? (I.info("Building your Stacks component library for production use..."), await F(L.BuildComponents)) : t === "functions" ? (I.info("Building your Stacks function library for production use..."), await F(L.DevFunctions)) : process.exit(ue.InvalidArgument);
  }
}
async function Oo() {
  I.info("Reinstalling your npm dependencies..."), await F(L.Fresh), I.success("Successfully reinstalled your npm dependencies.");
}
async function $o() {
  I.info("Updating your npm dependencies..."), await F(L.Update), I.success("Updated your npm dependencies.");
}
async function _o() {
  try {
    const e = hs("artisan");
    process.on("uncaughtException", Mt), process.on("unhandledRejection", Mt), e.version(N).command("dev", "Start the development server for any of the following packages").option("-c, --components", "Start the Components development server").option("-f, --functions", "Start the Functions development server").option("-p, --pages", "Start the Pages development server").option("-d, --docs", "Start the Documentation development server").action(async (t) => {
      await ci(t);
    }), e.version(N).command("dev:components", "Start the development server for your component library").action(async () => {
      await ci("components");
    }), e.version(N).command("build", "Automagically build any of your libraries/packages for production use. Select any of the following packages").option("-c, --components", "Build your component library").option("-w, --web-components", "Build your web component library").option("-e, --elements", "An alias to the -w flag").option("-f, --functions", "Build your function library").option("-p, --pages", "Build your pages").option("-d, --docs", "Build your documentation").action(async (t) => {
      await ee(t);
    }), e.version(N).command("build:components", "Automagically build your component libraries for production use & npm/CDN distribution.").action(async () => {
      await ee("components");
    }), e.version(N).command("build:functions", "Automagically build your function library for production use & npm/CDN distribution.").action(async () => {
      await ee("functions");
    }), e.version(N).command("build:elements", "Automagically build web component library for production use & npm/CDN distribution.").action(async () => {
      await ee("web-components");
    }), e.version(N).command("build:artisan-cli", "Automagically build the Artisan CLI.").action(async () => {
      await ee("artisan-cli");
    }), e.version(N).command("fresh", "Reinstalls your npm dependencies.").action(async () => {
      await Oo();
    }), e.version(N).command("update", "Updates your npm dependencies to their latest version based on the specified range.").action(async () => {
      await $o();
    }), e.version(N).command("version", "Review the current version").outputVersion(), e.parse();
  } catch (e) {
    Mt(e);
  }
}
function Mt(e) {
  let t = e.message || String(e);
  (process.env.DEBUG || process.env.NODE_ENV === "development") && (t = e.stack || t), console.error(t), process.exit(ue.FatalError);
}
_o();
