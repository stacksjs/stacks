import ne, { resolve as Vi } from "path";
var X = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Bi(e) {
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
var ee = { exports: {} }, K = typeof Reflect == "object" ? Reflect : null, Nt = K && typeof K.apply == "function" ? K.apply : function(t, i, r) {
  return Function.prototype.apply.call(t, i, r);
}, ie;
K && typeof K.ownKeys == "function" ? ie = K.ownKeys : Object.getOwnPropertySymbols ? ie = function(t) {
  return Object.getOwnPropertyNames(t).concat(Object.getOwnPropertySymbols(t));
} : ie = function(t) {
  return Object.getOwnPropertyNames(t);
};
function Yi(e) {
  console && console.warn && console.warn(e);
}
var ci = Number.isNaN || function(t) {
  return t !== t;
};
function P() {
  P.init.call(this);
}
ee.exports = P;
ee.exports.once = zi;
P.EventEmitter = P;
P.prototype._events = void 0;
P.prototype._eventsCount = 0;
P.prototype._maxListeners = void 0;
var Ft = 10;
function oe(e) {
  if (typeof e != "function")
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof e);
}
Object.defineProperty(P, "defaultMaxListeners", {
  enumerable: !0,
  get: function() {
    return Ft;
  },
  set: function(e) {
    if (typeof e != "number" || e < 0 || ci(e))
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + e + ".");
    Ft = e;
  }
});
P.init = function() {
  (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
};
P.prototype.setMaxListeners = function(t) {
  if (typeof t != "number" || t < 0 || ci(t))
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + t + ".");
  return this._maxListeners = t, this;
};
function di(e) {
  return e._maxListeners === void 0 ? P.defaultMaxListeners : e._maxListeners;
}
P.prototype.getMaxListeners = function() {
  return di(this);
};
P.prototype.emit = function(t) {
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
    var c = new Error("Unhandled error." + (s ? " (" + s.message + ")" : ""));
    throw c.context = s, c;
  }
  var l = a[t];
  if (l === void 0)
    return !1;
  if (typeof l == "function")
    Nt(l, this, i);
  else
    for (var u = l.length, o = vi(l, u), r = 0; r < u; ++r)
      Nt(o[r], this, i);
  return !0;
};
function fi(e, t, i, r) {
  var n, a, s;
  if (oe(i), a = e._events, a === void 0 ? (a = e._events = /* @__PURE__ */ Object.create(null), e._eventsCount = 0) : (a.newListener !== void 0 && (e.emit(
    "newListener",
    t,
    i.listener ? i.listener : i
  ), a = e._events), s = a[t]), s === void 0)
    s = a[t] = i, ++e._eventsCount;
  else if (typeof s == "function" ? s = a[t] = r ? [i, s] : [s, i] : r ? s.unshift(i) : s.push(i), n = di(e), n > 0 && s.length > n && !s.warned) {
    s.warned = !0;
    var c = new Error("Possible EventEmitter memory leak detected. " + s.length + " " + String(t) + " listeners added. Use emitter.setMaxListeners() to increase limit");
    c.name = "MaxListenersExceededWarning", c.emitter = e, c.type = t, c.count = s.length, Yi(c);
  }
  return e;
}
P.prototype.addListener = function(t, i) {
  return fi(this, t, i, !1);
};
P.prototype.on = P.prototype.addListener;
P.prototype.prependListener = function(t, i) {
  return fi(this, t, i, !0);
};
function Ui() {
  if (!this.fired)
    return this.target.removeListener(this.type, this.wrapFn), this.fired = !0, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
}
function pi(e, t, i) {
  var r = { fired: !1, wrapFn: void 0, target: e, type: t, listener: i }, n = Ui.bind(r);
  return n.listener = i, r.wrapFn = n, n;
}
P.prototype.once = function(t, i) {
  return oe(i), this.on(t, pi(this, t, i)), this;
};
P.prototype.prependOnceListener = function(t, i) {
  return oe(i), this.prependListener(t, pi(this, t, i)), this;
};
P.prototype.removeListener = function(t, i) {
  var r, n, a, s, c;
  if (oe(i), n = this._events, n === void 0)
    return this;
  if (r = n[t], r === void 0)
    return this;
  if (r === i || r.listener === i)
    --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete n[t], n.removeListener && this.emit("removeListener", t, r.listener || i));
  else if (typeof r != "function") {
    for (a = -1, s = r.length - 1; s >= 0; s--)
      if (r[s] === i || r[s].listener === i) {
        c = r[s].listener, a = s;
        break;
      }
    if (a < 0)
      return this;
    a === 0 ? r.shift() : Wi(r, a), r.length === 1 && (n[t] = r[0]), n.removeListener !== void 0 && this.emit("removeListener", t, c || i);
  }
  return this;
};
P.prototype.off = P.prototype.removeListener;
P.prototype.removeAllListeners = function(t) {
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
function mi(e, t, i) {
  var r = e._events;
  if (r === void 0)
    return [];
  var n = r[t];
  return n === void 0 ? [] : typeof n == "function" ? i ? [n.listener || n] : [n] : i ? Gi(n) : vi(n, n.length);
}
P.prototype.listeners = function(t) {
  return mi(this, t, !0);
};
P.prototype.rawListeners = function(t) {
  return mi(this, t, !1);
};
P.listenerCount = function(e, t) {
  return typeof e.listenerCount == "function" ? e.listenerCount(t) : gi.call(e, t);
};
P.prototype.listenerCount = gi;
function gi(e) {
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
P.prototype.eventNames = function() {
  return this._eventsCount > 0 ? ie(this._events) : [];
};
function vi(e, t) {
  for (var i = new Array(t), r = 0; r < t; ++r)
    i[r] = e[r];
  return i;
}
function Wi(e, t) {
  for (; t + 1 < e.length; t++)
    e[t] = e[t + 1];
  e.pop();
}
function Gi(e) {
  for (var t = new Array(e.length), i = 0; i < t.length; ++i)
    t[i] = e[i].listener || e[i];
  return t;
}
function zi(e, t) {
  return new Promise(function(i, r) {
    function n(s) {
      e.removeListener(t, a), r(s);
    }
    function a() {
      typeof e.removeListener == "function" && e.removeListener("error", n), i([].slice.call(arguments));
    }
    yi(e, t, a, { once: !0 }), t !== "error" && Ki(e, n, { once: !0 });
  });
}
function Ki(e, t, i) {
  typeof e.on == "function" && yi(e, "error", t, i);
}
function yi(e, t, i, r) {
  if (typeof e.on == "function")
    r.once ? e.once(t, i) : e.on(t, i);
  else if (typeof e.addEventListener == "function")
    e.addEventListener(t, function n(a) {
      r.once && e.removeEventListener(t, n), i(a);
    });
  else
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof e);
}
function le(e) {
  return e == null ? [] : Array.isArray(e) ? e : [e];
}
function Ji(e, t, i, r) {
  var n, a = e[t], s = ~r.string.indexOf(t) ? i == null || i === !0 ? "" : String(i) : typeof i == "boolean" ? i : ~r.boolean.indexOf(t) ? i === "false" ? !1 : i === "true" || (e._.push((n = +i, n * 0 === 0 ? n : i)), !!i) : (n = +i, n * 0 === 0 ? n : i);
  e[t] = a == null ? s : Array.isArray(a) ? a.concat(s) : [a, s];
}
function Zi(e, t) {
  e = e || [], t = t || {};
  var i, r, n, a, s, c = { _: [] }, l = 0, u = 0, o = 0, f = e.length;
  const d = t.alias !== void 0, h = t.unknown !== void 0, p = t.default !== void 0;
  if (t.alias = t.alias || {}, t.string = le(t.string), t.boolean = le(t.boolean), d)
    for (i in t.alias)
      for (r = t.alias[i] = le(t.alias[i]), l = 0; l < r.length; l++)
        (t.alias[r[l]] = r.concat(i)).splice(l, 1);
  for (l = t.boolean.length; l-- > 0; )
    for (r = t.alias[t.boolean[l]] || [], u = r.length; u-- > 0; )
      t.boolean.push(r[u]);
  for (l = t.string.length; l-- > 0; )
    for (r = t.alias[t.string[l]] || [], u = r.length; u-- > 0; )
      t.string.push(r[u]);
  if (p) {
    for (i in t.default)
      if (a = typeof t.default[i], r = t.alias[i] = t.alias[i] || [], t[a] !== void 0)
        for (t[a].push(i), l = 0; l < r.length; l++)
          t[a].push(r[l]);
  }
  const y = h ? Object.keys(t.alias) : [];
  for (l = 0; l < f; l++) {
    if (n = e[l], n === "--") {
      c._ = c._.concat(e.slice(++l));
      break;
    }
    for (u = 0; u < n.length && n.charCodeAt(u) === 45; u++)
      ;
    if (u === 0)
      c._.push(n);
    else if (n.substring(u, u + 3) === "no-") {
      if (a = n.substring(u + 3), h && !~y.indexOf(a))
        return t.unknown(n);
      c[a] = !1;
    } else {
      for (o = u + 1; o < n.length && n.charCodeAt(o) !== 61; o++)
        ;
      for (a = n.substring(u, o), s = n.substring(++o) || l + 1 === f || ("" + e[l + 1]).charCodeAt(0) === 45 || e[++l], r = u === 2 ? [a] : a, o = 0; o < r.length; o++) {
        if (a = r[o], h && !~y.indexOf(a))
          return t.unknown("-".repeat(u) + a);
        Ji(c, a, o + 1 < r.length || s, t);
      }
    }
  }
  if (p)
    for (i in t.default)
      c[i] === void 0 && (c[i] = t.default[i]);
  if (d)
    for (i in c)
      for (r = t.alias[i] || []; r.length > 0; )
        c[r.shift()] = c[i];
  return c;
}
const bi = (e) => e.replace(/[<[].+/, "").trim(), Xi = (e) => {
  const t = /<([^>]+)>/g, i = /\[([^\]]+)\]/g, r = [], n = (c) => {
    let l = !1, u = c[1];
    return u.startsWith("...") && (u = u.slice(3), l = !0), {
      required: c[0].startsWith("<"),
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
}, Qi = (e) => {
  const t = { alias: {}, boolean: [] };
  for (const [i, r] of e.entries())
    r.names.length > 1 && (t.alias[r.names[0]] = r.names.slice(1)), r.isBoolean && (r.negated && e.some((a, s) => s !== i && a.names.some((c) => r.names.includes(c)) && typeof a.required == "boolean") || t.boolean.push(r.names[0]));
  return t;
}, Ht = (e) => e.sort((t, i) => t.length > i.length ? -1 : 1)[0], Vt = (e, t) => e.length >= t ? e : `${e}${" ".repeat(t - e.length)}`, es = (e) => e.replace(/([a-z])-([a-z])/g, (t, i, r) => i + r.toUpperCase()), ts = (e, t, i) => {
  let r = 0, n = t.length, a = e, s;
  for (; r < n; ++r)
    s = a[t[r]], a = a[t[r]] = r === n - 1 ? i : s != null ? s : !!~t[r + 1].indexOf(".") || !(+t[r + 1] > -1) ? {} : [];
}, rs = (e, t) => {
  for (const i of Object.keys(t)) {
    const r = t[i];
    r.shouldTransform && (e[i] = Array.prototype.concat.call([], e[i]), typeof r.transformFunction == "function" && (e[i] = e[i].map(r.transformFunction)));
  }
}, is = (e) => {
  const t = /([^\\\/]+)$/.exec(e);
  return t ? t[1] : "";
}, wi = (e) => e.split(".").map((t, i) => i === 0 ? es(t) : t).join(".");
class ue extends Error {
  constructor(t) {
    super(t), this.name = this.constructor.name, typeof Error.captureStackTrace == "function" ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error(t).stack;
  }
}
class ss {
  constructor(t, i, r) {
    this.rawName = t, this.description = i, this.config = Object.assign({}, r), t = t.replace(/\.\*/g, ""), this.negated = !1, this.names = bi(t).split(",").map((n) => {
      let a = n.trim().replace(/^-{1,2}/, "");
      return a.startsWith("no-") && (this.negated = !0, a = a.replace(/^no-/, "")), wi(a);
    }).sort((n, a) => n.length > a.length ? 1 : -1), this.name = this.names[this.names.length - 1], this.negated && this.config.default == null && (this.config.default = !0), t.includes("<") ? this.required = !0 : t.includes("[") ? this.required = !1 : this.isBoolean = !0;
  }
}
const ns = process.argv, os = `${process.platform}-${process.arch} node-${process.version}`;
class xi {
  constructor(t, i, r = {}, n) {
    this.rawName = t, this.description = i, this.config = r, this.cli = n, this.options = [], this.aliasNames = [], this.name = bi(t), this.args = Xi(t), this.examples = [];
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
    const n = new ss(t, i, r);
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
    return this instanceof Si;
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
      const u = Ht(i.map((o) => o.rawName));
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
      const u = Ht(l.map((o) => o.rawName));
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
    i && console.log(`${t}/${i} ${os}`);
  }
  checkRequiredArgs() {
    const t = this.args.filter((i) => i.required).length;
    if (this.cli.args.length < t)
      throw new ue(`missing required args for command \`${this.rawName}\``);
  }
  checkUnknownOptions() {
    const { options: t, globalCommand: i } = this.cli;
    if (!this.config.allowUnknownOptions) {
      for (const r of Object.keys(t))
        if (r !== "--" && !this.hasOption(r) && !i.hasOption(r))
          throw new ue(`Unknown option \`${r.length > 1 ? `--${r}` : `-${r}`}\``);
    }
  }
  checkOptionValue() {
    const { options: t, globalCommand: i } = this.cli, r = [...i.options, ...this.options];
    for (const n of r) {
      const a = t[n.name.split(".")[0]];
      if (n.required) {
        const s = r.some((c) => c.negated && c.names.includes(n.name));
        if (a === !0 || a === !1 && !s)
          throw new ue(`option \`${n.rawName}\` value is missing`);
      }
    }
  }
}
class Si extends xi {
  constructor(t) {
    super("@@global@@", "", {}, t);
  }
}
var te = Object.assign;
class as extends ee.exports.EventEmitter {
  constructor(t = "") {
    super(), this.name = t, this.commands = [], this.rawArgs = [], this.args = [], this.options = {}, this.globalCommand = new Si(this), this.globalCommand.usage("<command> [options]");
  }
  usage(t) {
    return this.globalCommand.usage(t), this;
  }
  command(t, i, r) {
    const n = new xi(t, i || "", r, this);
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
  parse(t = ns, {
    run: i = !0
  } = {}) {
    this.rawArgs = t, this.name || (this.name = t[1] ? is(t[1]) : "cli");
    let r = !0;
    for (const a of this.commands) {
      const s = this.mri(t.slice(2), a), c = s.args[0];
      if (a.isMatched(c)) {
        r = !1;
        const l = te(te({}, s), {
          args: s.args.slice(1)
        });
        this.setParsedInfo(l, a, c), this.emit(`command:${c}`, a);
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
    ], n = Qi(r);
    let a = [];
    const s = t.indexOf("--");
    s > -1 && (a = t.slice(s + 1), t = t.slice(0, s));
    let c = Zi(t, n);
    c = Object.keys(c).reduce((d, h) => te(te({}, d), {
      [wi(h)]: c[h]
    }), { _: [] });
    const l = c._, u = {
      "--": a
    }, o = i && i.config.ignoreOptionDefaultValue ? i.config.ignoreOptionDefaultValue : this.globalCommand.config.ignoreOptionDefaultValue;
    let f = /* @__PURE__ */ Object.create(null);
    for (const d of r) {
      if (!o && d.config.default !== void 0)
        for (const h of d.names)
          u[h] = d.config.default;
      Array.isArray(d.config.type) && f[d.name] === void 0 && (f[d.name] = /* @__PURE__ */ Object.create(null), f[d.name].shouldTransform = !0, f[d.name].transformFunction = d.config.type[0]);
    }
    for (const d of Object.keys(c))
      if (d !== "_") {
        const h = d.split(".");
        ts(u, h, c[d]), rs(u, f);
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
const ls = (e = "") => new as(e), G = "0.23.0";
var he = {}, ce, Bt;
function C() {
  if (Bt)
    return ce;
  Bt = 1;
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
  function n(c, l) {
    let u = 0, o, f = "", d = "";
    for (; u < c.length; u++)
      o = c[u], f += o.open, d += o.close, l.includes(o.close) && (l = l.replace(o.rgx, o.close + o.open));
    return f + l + d;
  }
  function a(c, l) {
    let u = { has: c, keys: l };
    return u.reset = r.reset.bind(u), u.bold = r.bold.bind(u), u.dim = r.dim.bind(u), u.italic = r.italic.bind(u), u.underline = r.underline.bind(u), u.inverse = r.inverse.bind(u), u.hidden = r.hidden.bind(u), u.strikethrough = r.strikethrough.bind(u), u.black = r.black.bind(u), u.red = r.red.bind(u), u.green = r.green.bind(u), u.yellow = r.yellow.bind(u), u.blue = r.blue.bind(u), u.magenta = r.magenta.bind(u), u.cyan = r.cyan.bind(u), u.white = r.white.bind(u), u.gray = r.gray.bind(u), u.grey = r.grey.bind(u), u.bgBlack = r.bgBlack.bind(u), u.bgRed = r.bgRed.bind(u), u.bgGreen = r.bgGreen.bind(u), u.bgYellow = r.bgYellow.bind(u), u.bgBlue = r.bgBlue.bind(u), u.bgMagenta = r.bgMagenta.bind(u), u.bgCyan = r.bgCyan.bind(u), u.bgWhite = r.bgWhite.bind(u), u;
  }
  function s(c, l) {
    let u = {
      open: `\x1B[${c}m`,
      close: `\x1B[${l}m`,
      rgx: new RegExp(`\\x1b\\[${l}m`, "g")
    };
    return function(o) {
      return this !== void 0 && this.has !== void 0 ? (this.has.includes(c) || (this.has.push(c), this.keys.push(u)), o === void 0 ? this : r.enabled ? n(this.keys, o + "") : o + "") : o === void 0 ? a([c], [u]) : r.enabled ? n([u], o + "") : o + "";
    };
  }
  return ce = r, ce;
}
const $i = {}, us = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: $i
}, Symbol.toStringTag, { value: "Module" })), J = /* @__PURE__ */ Bi(us);
var de, Yt;
function hs() {
  return Yt || (Yt = 1, de = (e, t) => {
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
  }), de;
}
var fe, Ut;
function Ct() {
  return Ut || (Ut = 1, fe = (e) => {
    const t = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"].join("|"), i = new RegExp(t, "g");
    return typeof e == "string" ? e.replace(i, "") : e;
  }), fe;
}
var pe, Wt;
function _() {
  if (Wt)
    return pe;
  Wt = 1;
  const e = "\x1B", t = `${e}[`, i = "\x07", r = {
    to(s, c) {
      return c ? `${t}${c + 1};${s + 1}H` : `${t}${s + 1}G`;
    },
    move(s, c) {
      let l = "";
      return s < 0 ? l += `${t}${-s}D` : s > 0 && (l += `${t}${s}C`), c < 0 ? l += `${t}${-c}A` : c > 0 && (l += `${t}${c}B`), l;
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
      let c = "";
      for (let l = 0; l < s; l++)
        c += this.line + (l < s - 1 ? r.up() : "");
      return s && (c += r.left), c;
    }
  };
  return pe = { cursor: r, scroll: n, erase: a, beep: i }, pe;
}
var me, Gt;
function cs() {
  if (Gt)
    return me;
  Gt = 1;
  function e(l, u) {
    var o = typeof Symbol < "u" && l[Symbol.iterator] || l["@@iterator"];
    if (!o) {
      if (Array.isArray(l) || (o = t(l)) || u && l && typeof l.length == "number") {
        o && (l = o);
        var f = 0, d = function() {
        };
        return { s: d, n: function() {
          return f >= l.length ? { done: !0 } : { done: !1, value: l[f++] };
        }, e: function(g) {
          throw g;
        }, f: d };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var h = !0, p = !1, y;
    return { s: function() {
      o = o.call(l);
    }, n: function() {
      var g = o.next();
      return h = g.done, g;
    }, e: function(g) {
      p = !0, y = g;
    }, f: function() {
      try {
        !h && o.return != null && o.return();
      } finally {
        if (p)
          throw y;
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
    for (var o = 0, f = new Array(u); o < u; o++)
      f[o] = l[o];
    return f;
  }
  const r = Ct(), n = _(), a = n.erase, s = n.cursor, c = (l) => [...r(l)].length;
  return me = function(l, u) {
    if (!u)
      return a.line + s.to(0);
    let o = 0;
    const f = l.split(/\r?\n/);
    var d = e(f), h;
    try {
      for (d.s(); !(h = d.n()).done; ) {
        let p = h.value;
        o += 1 + Math.floor(Math.max(c(p) - 1, 0) / u);
      }
    } catch (p) {
      d.e(p);
    } finally {
      d.f();
    }
    return a.lines(o);
  }, me;
}
var ge, zt;
function Oi() {
  if (zt)
    return ge;
  zt = 1;
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
  return ge = process.platform === "win32" ? t : e, ge;
}
var ve, Kt;
function ds() {
  if (Kt)
    return ve;
  Kt = 1;
  const e = C(), t = Oi(), i = Object.freeze({
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
  return ve = {
    styles: i,
    render: r,
    symbols: n,
    symbol: (l, u, o) => u ? n.aborted : o ? n.exited : l ? n.done : n.default,
    delimiter: (l) => e.gray(l ? t.ellipsis : t.pointerSmall),
    item: (l, u) => e.gray(l ? u ? t.pointerSmall : "+" : t.line)
  }, ve;
}
var ye, Jt;
function fs() {
  if (Jt)
    return ye;
  Jt = 1;
  const e = Ct();
  return ye = function(t, i) {
    let r = String(e(t) || "").split(/\r?\n/);
    return i ? r.map((n) => Math.ceil(n.length / i)).reduce((n, a) => n + a) : r.length;
  }, ye;
}
var be, Zt;
function ps() {
  return Zt || (Zt = 1, be = (e, t = {}) => {
    const i = Number.isSafeInteger(parseInt(t.margin)) ? new Array(parseInt(t.margin)).fill(" ").join("") : t.margin || "", r = t.width;
    return (e || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((a, s) => (s.length + i.length >= r || a[a.length - 1].length + s.length + 1 < r ? a[a.length - 1] += ` ${s}` : a.push(`${i}${s}`), a), [i]).join(`
`)).join(`
`);
  }), be;
}
var we, Xt;
function ms() {
  return Xt || (Xt = 1, we = (e, t, i) => {
    i = i || t;
    let r = Math.min(t - i, e - Math.floor(i / 2));
    r < 0 && (r = 0);
    let n = Math.min(r + i, t);
    return {
      startIndex: r,
      endIndex: n
    };
  }), we;
}
var xe, Qt;
function k() {
  return Qt || (Qt = 1, xe = {
    action: hs(),
    clear: cs(),
    style: ds(),
    strip: Ct(),
    figures: Oi(),
    lines: fs(),
    wrap: ps(),
    entriesToDisplay: ms()
  }), xe;
}
var Se, er;
function V() {
  if (er)
    return Se;
  er = 1;
  const e = J, t = k(), i = t.action, r = ee.exports, n = _(), a = n.beep, s = n.cursor, c = C();
  class l extends r {
    constructor(o = {}) {
      super(), this.firstRender = !0, this.in = o.stdin || process.stdin, this.out = o.stdout || process.stdout, this.onRender = (o.onRender || (() => {
      })).bind(this);
      const f = e.createInterface({
        input: this.in,
        escapeCodeTimeout: 50
      });
      e.emitKeypressEvents(this.in, f), this.in.isTTY && this.in.setRawMode(!0);
      const d = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, h = (p, y) => {
        let v = i(y, d);
        v === !1 ? this._ && this._(p, y) : typeof this[v] == "function" ? this[v](y) : this.bell();
      };
      this.close = () => {
        this.out.write(s.show), this.in.removeListener("keypress", h), this.in.isTTY && this.in.setRawMode(!1), f.close(), this.emit(this.aborted ? "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", h);
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
      this.onRender(c), this.firstRender && (this.firstRender = !1);
    }
  }
  return Se = l, Se;
}
var $e, tr;
function gs() {
  if (tr)
    return $e;
  tr = 1;
  function e(h, p, y, v, g, m, b) {
    try {
      var x = h[m](b), w = x.value;
    } catch ($) {
      y($);
      return;
    }
    x.done ? p(w) : Promise.resolve(w).then(v, g);
  }
  function t(h) {
    return function() {
      var p = this, y = arguments;
      return new Promise(function(v, g) {
        var m = h.apply(p, y);
        function b(w) {
          e(m, v, g, b, x, "next", w);
        }
        function x(w) {
          e(m, v, g, b, x, "throw", w);
        }
        b(void 0);
      });
    };
  }
  const i = C(), r = V(), n = _(), a = n.erase, s = n.cursor, c = k(), l = c.style, u = c.clear, o = c.lines, f = c.figures;
  class d extends r {
    constructor(p = {}) {
      super(p), this.transform = l.render(p.style), this.scale = this.transform.scale, this.msg = p.message, this.initial = p.initial || "", this.validator = p.validate || (() => !0), this.value = "", this.errorMsg = p.error || "Please Enter A Valid Value", this.cursor = Number(!!this.initial), this.cursorOffset = 0, this.clear = u("", this.out.columns), this.render();
    }
    set value(p) {
      !p && this.initial ? (this.placeholder = !0, this.rendered = i.gray(this.transform.render(this.initial))) : (this.placeholder = !1, this.rendered = this.transform.render(p)), this._value = p, this.fire();
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
      var p = this;
      return t(function* () {
        let y = yield p.validator(p.value);
        typeof y == "string" && (p.errorMsg = y, y = !1), p.error = !y;
      })();
    }
    submit() {
      var p = this;
      return t(function* () {
        if (p.value = p.value || p.initial, p.cursorOffset = 0, p.cursor = p.rendered.length, yield p.validate(), p.error) {
          p.red = !0, p.fire(), p.render();
          return;
        }
        p.done = !0, p.aborted = !1, p.fire(), p.render(), p.out.write(`
`), p.close();
      })();
    }
    next() {
      if (!this.placeholder)
        return this.bell();
      this.value = this.initial, this.cursor = this.rendered.length, this.fire(), this.render();
    }
    moveCursor(p) {
      this.placeholder || (this.cursor = this.cursor + p, this.cursorOffset += p);
    }
    _(p, y) {
      let v = this.value.slice(0, this.cursor), g = this.value.slice(this.cursor);
      this.value = `${v}${p}${g}`, this.red = !1, this.cursor = this.placeholder ? 0 : v.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart())
        return this.bell();
      let p = this.value.slice(0, this.cursor - 1), y = this.value.slice(this.cursor);
      this.value = `${p}${y}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      let p = this.value.slice(0, this.cursor), y = this.value.slice(this.cursor + 1);
      this.value = `${p}${y}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
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
`).reduce((p, y, v) => p + `
${v ? " " : f.pointerSmall} ${i.red().italic(y)}`, "")), this.out.write(a.line + s.to(0) + this.outputText + s.save + this.outputError + s.restore + s.move(this.cursorOffset, 0)));
    }
  }
  return $e = d, $e;
}
var Oe, rr;
function vs() {
  if (rr)
    return Oe;
  rr = 1;
  const e = C(), t = V(), i = k(), r = i.style, n = i.clear, a = i.figures, s = i.wrap, c = i.entriesToDisplay, l = _(), u = l.cursor;
  class o extends t {
    constructor(d = {}) {
      super(d), this.msg = d.message, this.hint = d.hint || "- Use arrow-keys. Return to submit.", this.warn = d.warn || "- This option is disabled", this.cursor = d.initial || 0, this.choices = d.choices.map((h, p) => (typeof h == "string" && (h = {
        title: h,
        value: p
      }), {
        title: h && (h.title || h.value || h),
        value: h && (h.value === void 0 ? p : h.value),
        description: h && h.description,
        selected: h && h.selected,
        disabled: h && h.disabled
      })), this.optionsPerPage = d.optionsPerPage || 10, this.value = (this.choices[this.cursor] || {}).value, this.clear = n("", this.out.columns), this.render();
    }
    moveCursor(d) {
      this.cursor = d, this.value = this.choices[d].value, this.fire();
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
    _(d, h) {
      if (d === " ")
        return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(u.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render();
      let d = c(this.cursor, this.choices.length, this.optionsPerPage), h = d.startIndex, p = d.endIndex;
      if (this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(!1), this.done ? this.selection.title : this.selection.disabled ? e.yellow(this.warn) : e.gray(this.hint)].join(" "), !this.done) {
        this.outputText += `
`;
        for (let y = h; y < p; y++) {
          let v, g, m = "", b = this.choices[y];
          y === h && h > 0 ? g = a.arrowUp : y === p - 1 && p < this.choices.length ? g = a.arrowDown : g = " ", b.disabled ? (v = this.cursor === y ? e.gray().underline(b.title) : e.strikethrough().gray(b.title), g = (this.cursor === y ? e.bold().gray(a.pointer) + " " : "  ") + g) : (v = this.cursor === y ? e.cyan().underline(b.title) : b.title, g = (this.cursor === y ? e.cyan(a.pointer) + " " : "  ") + g, b.description && this.cursor === y && (m = ` - ${b.description}`, (g.length + v.length + m.length >= this.out.columns || b.description.split(/\r?\n/).length > 1) && (m = `
` + s(b.description, {
            margin: 3,
            width: this.out.columns
          })))), this.outputText += `${g} ${v}${e.gray(m)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  }
  return Oe = o, Oe;
}
var Me, ir;
function ys() {
  if (ir)
    return Me;
  ir = 1;
  const e = C(), t = V(), i = k(), r = i.style, n = i.clear, a = _(), s = a.cursor, c = a.erase;
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
    _(o, f) {
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
      this.closed || (this.firstRender ? this.out.write(s.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render(), this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(this.done), this.value ? this.inactive : e.cyan().underline(this.inactive), e.gray("/"), this.value ? e.cyan().underline(this.active) : this.active].join(" "), this.out.write(c.line + s.to(0) + this.outputText));
    }
  }
  return Me = l, Me;
}
var Te, sr;
function N() {
  if (sr)
    return Te;
  sr = 1;
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
  return Te = e, Te;
}
var Pe, nr;
function bs() {
  if (nr)
    return Pe;
  nr = 1;
  const e = N();
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
var Ee, or;
function ws() {
  if (or)
    return Ee;
  or = 1;
  const e = N(), t = (r) => (r = r % 10, r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th");
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
var Ce, ar;
function xs() {
  if (ar)
    return Ce;
  ar = 1;
  const e = N();
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
  return Ce = t, Ce;
}
var _e, lr;
function Ss() {
  if (lr)
    return _e;
  lr = 1;
  const e = N();
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
  return _e = t, _e;
}
var Ae, ur;
function $s() {
  if (ur)
    return Ae;
  ur = 1;
  const e = N();
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
  return Ae = t, Ae;
}
var De, hr;
function Os() {
  if (hr)
    return De;
  hr = 1;
  const e = N();
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
  return De = t, De;
}
var Re, cr;
function Ms() {
  if (cr)
    return Re;
  cr = 1;
  const e = N();
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
  return Re = t, Re;
}
var qe, dr;
function Ts() {
  if (dr)
    return qe;
  dr = 1;
  const e = N();
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
  return qe = t, qe;
}
var Ie, fr;
function Ps() {
  return fr || (fr = 1, Ie = {
    DatePart: N(),
    Meridiem: bs(),
    Day: ws(),
    Hours: xs(),
    Milliseconds: Ss(),
    Minutes: $s(),
    Month: Os(),
    Seconds: Ms(),
    Year: Ts()
  }), Ie;
}
var je, pr;
function Es() {
  if (pr)
    return je;
  pr = 1;
  function e(O, S, E, q, A, D, j) {
    try {
      var I = O[D](j), R = I.value;
    } catch (W) {
      E(W);
      return;
    }
    I.done ? S(R) : Promise.resolve(R).then(q, A);
  }
  function t(O) {
    return function() {
      var S = this, E = arguments;
      return new Promise(function(q, A) {
        var D = O.apply(S, E);
        function j(R) {
          e(D, q, A, j, I, "next", R);
        }
        function I(R) {
          e(D, q, A, j, I, "throw", R);
        }
        j(void 0);
      });
    };
  }
  const i = C(), r = V(), n = k(), a = n.style, s = n.clear, c = n.figures, l = _(), u = l.erase, o = l.cursor, f = Ps(), d = f.DatePart, h = f.Meridiem, p = f.Day, y = f.Hours, v = f.Milliseconds, g = f.Minutes, m = f.Month, b = f.Seconds, x = f.Year, w = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g, $ = {
    1: ({
      token: O
    }) => O.replace(/\\(.)/g, "$1"),
    2: (O) => new p(O),
    3: (O) => new m(O),
    4: (O) => new x(O),
    5: (O) => new h(O),
    6: (O) => new y(O),
    7: (O) => new g(O),
    8: (O) => new b(O),
    9: (O) => new v(O)
  }, M = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  };
  class T extends r {
    constructor(S = {}) {
      super(S), this.msg = S.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(M, S.locales), this._date = S.initial || new Date(), this.errorMsg = S.error || "Please Enter A Valid Value", this.validator = S.validate || (() => !0), this.mask = S.mask || "YYYY-MM-DD HH:mm:ss", this.clear = s("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(S) {
      S && this._date.setTime(S.getTime());
    }
    set mask(S) {
      let E;
      for (this.parts = []; E = w.exec(S); ) {
        let A = E.shift(), D = E.findIndex((j) => j != null);
        this.parts.push(D in $ ? $[D]({
          token: E[D] || A,
          date: this.date,
          parts: this.parts,
          locales: this.locales
        }) : E[D] || A);
      }
      let q = this.parts.reduce((A, D) => (typeof D == "string" && typeof A[A.length - 1] == "string" ? A[A.length - 1] += D : A.push(D), A), []);
      this.parts.splice(0), this.parts.push(...q), this.reset();
    }
    moveCursor(S) {
      this.typed = "", this.cursor = S, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((S) => S instanceof d)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    validate() {
      var S = this;
      return t(function* () {
        let E = yield S.validator(S.value);
        typeof E == "string" && (S.errorMsg = E, E = !1), S.error = !E;
      })();
    }
    submit() {
      var S = this;
      return t(function* () {
        if (yield S.validate(), S.error) {
          S.color = "red", S.fire(), S.render();
          return;
        }
        S.done = !0, S.aborted = !1, S.fire(), S.render(), S.out.write(`
`), S.close();
      })();
    }
    up() {
      this.typed = "", this.parts[this.cursor].up(), this.render();
    }
    down() {
      this.typed = "", this.parts[this.cursor].down(), this.render();
    }
    left() {
      let S = this.parts[this.cursor].prev();
      if (S == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(S)), this.render();
    }
    right() {
      let S = this.parts[this.cursor].next();
      if (S == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(S)), this.render();
    }
    next() {
      let S = this.parts[this.cursor].next();
      this.moveCursor(S ? this.parts.indexOf(S) : this.parts.findIndex((E) => E instanceof d)), this.render();
    }
    _(S) {
      /\d/.test(S) && (this.typed += S, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(o.hide) : this.out.write(s(this.outputText, this.out.columns)), super.render(), this.outputText = [a.symbol(this.done, this.aborted), i.bold(this.msg), a.delimiter(!1), this.parts.reduce((S, E, q) => S.concat(q === this.cursor && !this.done ? i.cyan().underline(E.toString()) : E), []).join("")].join(" "), this.error && (this.outputText += this.errorMsg.split(`
`).reduce((S, E, q) => S + `
${q ? " " : c.pointerSmall} ${i.red().italic(E)}`, "")), this.out.write(u.line + o.to(0) + this.outputText));
    }
  }
  return je = T, je;
}
var ke, mr;
function Cs() {
  if (mr)
    return ke;
  mr = 1;
  function e(v, g, m, b, x, w, $) {
    try {
      var M = v[w]($), T = M.value;
    } catch (O) {
      m(O);
      return;
    }
    M.done ? g(T) : Promise.resolve(T).then(b, x);
  }
  function t(v) {
    return function() {
      var g = this, m = arguments;
      return new Promise(function(b, x) {
        var w = v.apply(g, m);
        function $(T) {
          e(w, b, x, $, M, "next", T);
        }
        function M(T) {
          e(w, b, x, $, M, "throw", T);
        }
        $(void 0);
      });
    };
  }
  const i = C(), r = V(), n = _(), a = n.cursor, s = n.erase, c = k(), l = c.style, u = c.figures, o = c.clear, f = c.lines, d = /[0-9]/, h = (v) => v !== void 0, p = (v, g) => {
    let m = Math.pow(10, g);
    return Math.round(v * m) / m;
  };
  class y extends r {
    constructor(g = {}) {
      super(g), this.transform = l.render(g.style), this.msg = g.message, this.initial = h(g.initial) ? g.initial : "", this.float = !!g.float, this.round = g.round || 2, this.inc = g.increment || 1, this.min = h(g.min) ? g.min : -1 / 0, this.max = h(g.max) ? g.max : 1 / 0, this.errorMsg = g.error || "Please Enter A Valid Value", this.validator = g.validate || (() => !0), this.color = "cyan", this.value = "", this.typed = "", this.lastHit = 0, this.render();
    }
    set value(g) {
      !g && g !== 0 ? (this.placeholder = !0, this.rendered = i.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder = !1, this.rendered = this.transform.render(`${p(g, this.round)}`), this._value = p(g, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(g) {
      return this.float ? parseFloat(g) : parseInt(g);
    }
    valid(g) {
      return g === "-" || g === "." && this.float || d.test(g);
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
        let m = yield g.validator(g.value);
        typeof m == "string" && (g.errorMsg = m, m = !1), g.error = !m;
      })();
    }
    submit() {
      var g = this;
      return t(function* () {
        if (yield g.validate(), g.error) {
          g.color = "red", g.fire(), g.render();
          return;
        }
        let m = g.value;
        g.value = m !== "" ? m : g.initial, g.done = !0, g.aborted = !1, g.error = !1, g.fire(), g.render(), g.out.write(`
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
    _(g, m) {
      if (!this.valid(g))
        return this.bell();
      const b = Date.now();
      if (b - this.lastHit > 1e3 && (this.typed = ""), this.typed += g, this.lastHit = b, this.color = "cyan", g === ".")
        return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(a.down(f(this.outputError, this.out.columns) - 1) + o(this.outputError, this.out.columns)), this.out.write(o(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [l.symbol(this.done, this.aborted), i.bold(this.msg), l.delimiter(this.done), !this.done || !this.done && !this.placeholder ? i[this.color]().underline(this.rendered) : this.rendered].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((g, m, b) => g + `
${b ? " " : u.pointerSmall} ${i.red().italic(m)}`, "")), this.out.write(s.line + a.to(0) + this.outputText + a.save + this.outputError + a.restore));
    }
  }
  return ke = y, ke;
}
var Le, gr;
function Mi() {
  if (gr)
    return Le;
  gr = 1;
  const e = C(), t = _(), i = t.cursor, r = V(), n = k(), a = n.clear, s = n.figures, c = n.style, l = n.wrap, u = n.entriesToDisplay;
  class o extends r {
    constructor(d = {}) {
      super(d), this.msg = d.message, this.cursor = d.cursor || 0, this.scrollIndex = d.cursor || 0, this.hint = d.hint || "", this.warn = d.warn || "- This option is disabled -", this.minSelected = d.min, this.showMinError = !1, this.maxChoices = d.max, this.instructions = d.instructions, this.optionsPerPage = d.optionsPerPage || 10, this.value = d.choices.map((h, p) => (typeof h == "string" && (h = {
        title: h,
        value: p
      }), {
        title: h && (h.title || h.value || h),
        description: h && h.description,
        value: h && (h.value === void 0 ? p : h.value),
        selected: h && h.selected,
        disabled: h && h.disabled
      })), this.clear = a("", this.out.columns), d.overrideRender || this.render();
    }
    reset() {
      this.value.map((d) => !d.selected), this.cursor = 0, this.fire(), this.render();
    }
    selected() {
      return this.value.filter((d) => d.selected);
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      const d = this.value.filter((h) => h.selected);
      this.minSelected && d.length < this.minSelected ? (this.showMinError = !0, this.render()) : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
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
      if (this.value.filter((d) => d.selected).length >= this.maxChoices)
        return this.bell();
      this.value[this.cursor].selected = !0, this.render();
    }
    handleSpaceToggle() {
      const d = this.value[this.cursor];
      if (d.selected)
        d.selected = !1, this.render();
      else {
        if (d.disabled || this.value.filter((h) => h.selected).length >= this.maxChoices)
          return this.bell();
        d.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      const d = !this.value[this.cursor].selected;
      this.value.filter((h) => !h.disabled).forEach((h) => h.selected = d), this.render();
    }
    _(d, h) {
      if (d === " ")
        this.handleSpaceToggle();
      else if (d === "a")
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
    renderOption(d, h, p, y) {
      const v = (h.selected ? e.green(s.radioOn) : s.radioOff) + " " + y + " ";
      let g, m;
      return h.disabled ? g = d === p ? e.gray().underline(h.title) : e.strikethrough().gray(h.title) : (g = d === p ? e.cyan().underline(h.title) : h.title, d === p && h.description && (m = ` - ${h.description}`, (v.length + g.length + m.length >= this.out.columns || h.description.split(/\r?\n/).length > 1) && (m = `
` + l(h.description, {
        margin: v.length,
        width: this.out.columns
      })))), v + g + e.gray(m || "");
    }
    paginateOptions(d) {
      if (d.length === 0)
        return e.red("No matches for this query.");
      let h = u(this.cursor, d.length, this.optionsPerPage), p = h.startIndex, y = h.endIndex, v, g = [];
      for (let m = p; m < y; m++)
        m === p && p > 0 ? v = s.arrowUp : m === y - 1 && y < d.length ? v = s.arrowDown : v = " ", g.push(this.renderOption(this.cursor, d[m], m, v));
      return `
` + g.join(`
`);
    }
    renderOptions(d) {
      return this.done ? "" : this.paginateOptions(d);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((h) => h.selected).map((h) => h.title).join(", ");
      const d = [e.gray(this.hint), this.renderInstructions()];
      return this.value[this.cursor].disabled && d.push(e.yellow(this.warn)), d.join(" ");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender && this.out.write(i.hide), super.render();
      let d = [c.symbol(this.done, this.aborted), e.bold(this.msg), c.delimiter(!1), this.renderDoneOrInstructions()].join(" ");
      this.showMinError && (d += e.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), d += this.renderOptions(this.value), this.out.write(this.clear + d), this.clear = a(d, this.out.columns);
    }
  }
  return Le = o, Le;
}
var Ne, vr;
function _s() {
  if (vr)
    return Ne;
  vr = 1;
  function e(g, m, b, x, w, $, M) {
    try {
      var T = g[$](M), O = T.value;
    } catch (S) {
      b(S);
      return;
    }
    T.done ? m(O) : Promise.resolve(O).then(x, w);
  }
  function t(g) {
    return function() {
      var m = this, b = arguments;
      return new Promise(function(x, w) {
        var $ = g.apply(m, b);
        function M(O) {
          e($, x, w, M, T, "next", O);
        }
        function T(O) {
          e($, x, w, M, T, "throw", O);
        }
        M(void 0);
      });
    };
  }
  const i = C(), r = V(), n = _(), a = n.erase, s = n.cursor, c = k(), l = c.style, u = c.clear, o = c.figures, f = c.wrap, d = c.entriesToDisplay, h = (g, m) => g[m] && (g[m].value || g[m].title || g[m]), p = (g, m) => g[m] && (g[m].title || g[m].value || g[m]), y = (g, m) => {
    const b = g.findIndex((x) => x.value === m || x.title === m);
    return b > -1 ? b : void 0;
  };
  class v extends r {
    constructor(m = {}) {
      super(m), this.msg = m.message, this.suggest = m.suggest, this.choices = m.choices, this.initial = typeof m.initial == "number" ? m.initial : y(m.choices, m.initial), this.select = this.initial || m.cursor || 0, this.i18n = {
        noMatches: m.noMatches || "no matches found"
      }, this.fallback = m.fallback || this.initial, this.clearFirst = m.clearFirst || !1, this.suggestions = [], this.input = "", this.limit = m.limit || 10, this.cursor = 0, this.transform = l.render(m.style), this.scale = this.transform.scale, this.render = this.render.bind(this), this.complete = this.complete.bind(this), this.clear = u("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(m) {
      this._fb = Number.isSafeInteger(parseInt(m)) ? parseInt(m) : m;
    }
    get fallback() {
      let m;
      return typeof this._fb == "number" ? m = this.choices[this._fb] : typeof this._fb == "string" && (m = {
        title: this._fb
      }), m || this._fb || {
        title: this.i18n.noMatches
      };
    }
    moveSelect(m) {
      this.select = m, this.suggestions.length > 0 ? this.value = h(this.suggestions, m) : this.value = this.fallback.value, this.fire();
    }
    complete(m) {
      var b = this;
      return t(function* () {
        const x = b.completing = b.suggest(b.input, b.choices), w = yield x;
        if (b.completing !== x)
          return;
        b.suggestions = w.map((M, T, O) => ({
          title: p(O, T),
          value: h(O, T),
          description: M.description
        })), b.completing = !1;
        const $ = Math.max(w.length - 1, 0);
        b.moveSelect(Math.min($, b.select)), m && m();
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
    _(m, b) {
      let x = this.input.slice(0, this.cursor), w = this.input.slice(this.cursor);
      this.input = `${x}${m}${w}`, this.cursor = x.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0)
        return this.bell();
      let m = this.input.slice(0, this.cursor - 1), b = this.input.slice(this.cursor);
      this.input = `${m}${b}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      let m = this.input.slice(0, this.cursor), b = this.input.slice(this.cursor + 1);
      this.input = `${m}${b}`, this.complete(this.render), this.render();
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
    renderOption(m, b, x, w) {
      let $, M = x ? o.arrowUp : w ? o.arrowDown : " ", T = b ? i.cyan().underline(m.title) : m.title;
      return M = (b ? i.cyan(o.pointer) + " " : "  ") + M, m.description && ($ = ` - ${m.description}`, (M.length + T.length + $.length >= this.out.columns || m.description.split(/\r?\n/).length > 1) && ($ = `
` + f(m.description, {
        margin: 3,
        width: this.out.columns
      }))), M + " " + T + i.gray($ || "");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(s.hide) : this.out.write(u(this.outputText, this.out.columns)), super.render();
      let m = d(this.select, this.choices.length, this.limit), b = m.startIndex, x = m.endIndex;
      if (this.outputText = [l.symbol(this.done, this.aborted, this.exited), i.bold(this.msg), l.delimiter(this.completing), this.done && this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)].join(" "), !this.done) {
        const w = this.suggestions.slice(b, x).map(($, M) => this.renderOption($, this.select === M + b, M === 0 && b > 0, M + b === x - 1 && x < this.choices.length)).join(`
`);
        this.outputText += `
` + (w || i.gray(this.fallback.title));
      }
      this.out.write(a.line + s.to(0) + this.outputText);
    }
  }
  return Ne = v, Ne;
}
var Fe, yr;
function As() {
  if (yr)
    return Fe;
  yr = 1;
  const e = C(), t = _(), i = t.cursor, r = Mi(), n = k(), a = n.clear, s = n.style, c = n.figures;
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
      this.filteredOptions = this.value.filter((d) => this.inputValue ? !!(typeof d.title == "string" && d.title.toLowerCase().includes(this.inputValue.toLowerCase()) || typeof d.value == "string" && d.value.toLowerCase().includes(this.inputValue.toLowerCase())) : !0);
      const f = this.filteredOptions.findIndex((d) => d === o);
      this.cursor = f < 0 ? 0 : f, this.render();
    }
    handleSpaceToggle() {
      const o = this.filteredOptions[this.cursor];
      if (o.selected)
        o.selected = !1, this.render();
      else {
        if (o.disabled || this.value.filter((f) => f.selected).length >= this.maxChoices)
          return this.bell();
        o.selected = !0, this.render();
      }
    }
    handleInputChange(o) {
      this.inputValue = this.inputValue + o, this.updateFilteredOptions();
    }
    _(o, f) {
      o === " " ? this.handleSpaceToggle() : this.handleInputChange(o);
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${c.arrowUp}/${c.arrowDown}: Highlight option
    ${c.arrowLeft}/${c.arrowRight}/[space]: Toggle selection
    [a,b,c]/delete: Filter choices
    enter/return: Complete answer
` : "";
    }
    renderCurrentInput() {
      return `
Filtered results for: ${this.inputValue ? this.inputValue : e.gray("Enter something to filter")}
`;
    }
    renderOption(o, f, d) {
      let h;
      return f.disabled ? h = o === d ? e.gray().underline(f.title) : e.strikethrough().gray(f.title) : h = o === d ? e.cyan().underline(f.title) : f.title, (f.selected ? e.green(c.radioOn) : c.radioOff) + "  " + h;
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((f) => f.selected).map((f) => f.title).join(", ");
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
  return Fe = l, Fe;
}
var He, br;
function Ds() {
  if (br)
    return He;
  br = 1;
  const e = C(), t = V(), i = k(), r = i.style, n = i.clear, a = _(), s = a.erase, c = a.cursor;
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
    _(o, f) {
      return o.toLowerCase() === "y" ? (this.value = !0, this.submit()) : o.toLowerCase() === "n" ? (this.value = !1, this.submit()) : this.bell();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(c.hide) : this.out.write(n(this.outputText, this.out.columns)), super.render(), this.outputText = [r.symbol(this.done, this.aborted), e.bold(this.msg), r.delimiter(this.done), this.done ? this.value ? this.yesMsg : this.noMsg : e.gray(this.initialValue ? this.yesOption : this.noOption)].join(" "), this.out.write(s.line + c.to(0) + this.outputText));
    }
  }
  return He = l, He;
}
var Ve, wr;
function Rs() {
  return wr || (wr = 1, Ve = {
    TextPrompt: gs(),
    SelectPrompt: vs(),
    TogglePrompt: ys(),
    DatePrompt: Es(),
    NumberPrompt: Cs(),
    MultiselectPrompt: Mi(),
    AutocompletePrompt: _s(),
    AutocompleteMultiselectPrompt: As(),
    ConfirmPrompt: Ds()
  }), Ve;
}
var xr;
function qs() {
  return xr || (xr = 1, function(e) {
    const t = e, i = Rs(), r = (s) => s;
    function n(s, c, l = {}) {
      return new Promise((u, o) => {
        const f = new i[s](c), d = l.onAbort || r, h = l.onSubmit || r, p = l.onExit || r;
        f.on("state", c.onState || r), f.on("submit", (y) => u(h(y))), f.on("exit", (y) => u(p(y))), f.on("abort", (y) => o(d(y)));
      });
    }
    t.text = (s) => n("TextPrompt", s), t.password = (s) => (s.style = "password", t.text(s)), t.invisible = (s) => (s.style = "invisible", t.text(s)), t.number = (s) => n("NumberPrompt", s), t.date = (s) => n("DatePrompt", s), t.confirm = (s) => n("ConfirmPrompt", s), t.list = (s) => {
      const c = s.separator || ",";
      return n("TextPrompt", s, {
        onSubmit: (l) => l.split(c).map((u) => u.trim())
      });
    }, t.toggle = (s) => n("TogglePrompt", s), t.select = (s) => n("SelectPrompt", s), t.multiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const c = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("MultiselectPrompt", s, {
        onAbort: c,
        onSubmit: c
      });
    }, t.autocompleteMultiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const c = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("AutocompleteMultiselectPrompt", s, {
        onAbort: c,
        onSubmit: c
      });
    };
    const a = (s, c) => Promise.resolve(c.filter((l) => l.title.slice(0, s.length).toLowerCase() === s.toLowerCase()));
    t.autocomplete = (s) => (s.suggest = s.suggest || a, s.choices = [].concat(s.choices || []), n("AutocompletePrompt", s));
  }(he)), he;
}
var Be, Sr;
function Is() {
  if (Sr)
    return Be;
  Sr = 1;
  function e(v, g) {
    var m = Object.keys(v);
    if (Object.getOwnPropertySymbols) {
      var b = Object.getOwnPropertySymbols(v);
      g && (b = b.filter(function(x) {
        return Object.getOwnPropertyDescriptor(v, x).enumerable;
      })), m.push.apply(m, b);
    }
    return m;
  }
  function t(v) {
    for (var g = 1; g < arguments.length; g++) {
      var m = arguments[g] != null ? arguments[g] : {};
      g % 2 ? e(Object(m), !0).forEach(function(b) {
        i(v, b, m[b]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(v, Object.getOwnPropertyDescriptors(m)) : e(Object(m)).forEach(function(b) {
        Object.defineProperty(v, b, Object.getOwnPropertyDescriptor(m, b));
      });
    }
    return v;
  }
  function i(v, g, m) {
    return g in v ? Object.defineProperty(v, g, { value: m, enumerable: !0, configurable: !0, writable: !0 }) : v[g] = m, v;
  }
  function r(v, g) {
    var m = typeof Symbol < "u" && v[Symbol.iterator] || v["@@iterator"];
    if (!m) {
      if (Array.isArray(v) || (m = n(v)) || g && v && typeof v.length == "number") {
        m && (v = m);
        var b = 0, x = function() {
        };
        return { s: x, n: function() {
          return b >= v.length ? { done: !0 } : { done: !1, value: v[b++] };
        }, e: function(O) {
          throw O;
        }, f: x };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var w = !0, $ = !1, M;
    return { s: function() {
      m = m.call(v);
    }, n: function() {
      var O = m.next();
      return w = O.done, O;
    }, e: function(O) {
      $ = !0, M = O;
    }, f: function() {
      try {
        !w && m.return != null && m.return();
      } finally {
        if ($)
          throw M;
      }
    } };
  }
  function n(v, g) {
    if (!!v) {
      if (typeof v == "string")
        return a(v, g);
      var m = Object.prototype.toString.call(v).slice(8, -1);
      if (m === "Object" && v.constructor && (m = v.constructor.name), m === "Map" || m === "Set")
        return Array.from(v);
      if (m === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(m))
        return a(v, g);
    }
  }
  function a(v, g) {
    (g == null || g > v.length) && (g = v.length);
    for (var m = 0, b = new Array(g); m < g; m++)
      b[m] = v[m];
    return b;
  }
  function s(v, g, m, b, x, w, $) {
    try {
      var M = v[w]($), T = M.value;
    } catch (O) {
      m(O);
      return;
    }
    M.done ? g(T) : Promise.resolve(T).then(b, x);
  }
  function c(v) {
    return function() {
      var g = this, m = arguments;
      return new Promise(function(b, x) {
        var w = v.apply(g, m);
        function $(T) {
          s(w, b, x, $, M, "next", T);
        }
        function M(T) {
          s(w, b, x, $, M, "throw", T);
        }
        $(void 0);
      });
    };
  }
  const l = qs(), u = ["suggest", "format", "onState", "validate", "onRender", "type"], o = () => {
  };
  function f() {
    return d.apply(this, arguments);
  }
  function d() {
    return d = c(function* (v = [], {
      onSubmit: g = o,
      onCancel: m = o
    } = {}) {
      const b = {}, x = f._override || {};
      v = [].concat(v);
      let w, $, M, T, O, S;
      const E = /* @__PURE__ */ function() {
        var I = c(function* (R, W, Lt = !1) {
          if (!(!Lt && R.validate && R.validate(W) !== !0))
            return R.format ? yield R.format(W, b) : W;
        });
        return function(W, Lt) {
          return I.apply(this, arguments);
        };
      }();
      var q = r(v), A;
      try {
        for (q.s(); !(A = q.n()).done; ) {
          $ = A.value;
          var D = $;
          if (T = D.name, O = D.type, typeof O == "function" && (O = yield O(w, t({}, b), $), $.type = O), !!O) {
            for (let I in $) {
              if (u.includes(I))
                continue;
              let R = $[I];
              $[I] = typeof R == "function" ? yield R(w, t({}, b), S) : R;
            }
            if (S = $, typeof $.message != "string")
              throw new Error("prompt message is required");
            var j = $;
            if (T = j.name, O = j.type, l[O] === void 0)
              throw new Error(`prompt type (${O}) is not defined`);
            if (x[$.name] !== void 0 && (w = yield E($, x[$.name]), w !== void 0)) {
              b[T] = w;
              continue;
            }
            try {
              w = f._injected ? h(f._injected, $.initial) : yield l[O]($), b[T] = w = yield E($, w, !0), M = yield g($, w, b);
            } catch {
              M = !(yield m($, b));
            }
            if (M)
              return b;
          }
        }
      } catch (I) {
        q.e(I);
      } finally {
        q.f();
      }
      return b;
    }), d.apply(this, arguments);
  }
  function h(v, g) {
    const m = v.shift();
    if (m instanceof Error)
      throw m;
    return m === void 0 ? g : m;
  }
  function p(v) {
    f._injected = (f._injected || []).concat(v);
  }
  function y(v) {
    f._override = Object.assign({}, v);
  }
  return Be = Object.assign(f, {
    prompt: f,
    prompts: l,
    inject: p,
    override: y
  }), Be;
}
var Ye = {}, Ue, $r;
function js() {
  return $r || ($r = 1, Ue = (e, t) => {
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
  }), Ue;
}
var We, Or;
function _t() {
  return Or || (Or = 1, We = (e) => {
    const t = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"
    ].join("|"), i = new RegExp(t, "g");
    return typeof e == "string" ? e.replace(i, "") : e;
  }), We;
}
var Ge, Mr;
function ks() {
  if (Mr)
    return Ge;
  Mr = 1;
  const e = _t(), { erase: t, cursor: i } = _(), r = (n) => [...e(n)].length;
  return Ge = function(n, a) {
    if (!a)
      return t.line + i.to(0);
    let s = 0;
    const c = n.split(/\r?\n/);
    for (let l of c)
      s += 1 + Math.floor(Math.max(r(l) - 1, 0) / a);
    return t.lines(s);
  }, Ge;
}
var ze, Tr;
function Ti() {
  if (Tr)
    return ze;
  Tr = 1;
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
  return ze = process.platform === "win32" ? t : e, ze;
}
var Ke, Pr;
function Ls() {
  if (Pr)
    return Ke;
  Pr = 1;
  const e = C(), t = Ti(), i = Object.freeze({
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
  return Ke = {
    styles: i,
    render: r,
    symbols: n,
    symbol: (l, u, o) => u ? n.aborted : o ? n.exited : l ? n.done : n.default,
    delimiter: (l) => e.gray(l ? t.ellipsis : t.pointerSmall),
    item: (l, u) => e.gray(l ? u ? t.pointerSmall : "+" : t.line)
  }, Ke;
}
var Je, Er;
function Ns() {
  if (Er)
    return Je;
  Er = 1;
  const e = _t();
  return Je = function(t, i) {
    let r = String(e(t) || "").split(/\r?\n/);
    return i ? r.map((n) => Math.ceil(n.length / i)).reduce((n, a) => n + a) : r.length;
  }, Je;
}
var Ze, Cr;
function Fs() {
  return Cr || (Cr = 1, Ze = (e, t = {}) => {
    const i = Number.isSafeInteger(parseInt(t.margin)) ? new Array(parseInt(t.margin)).fill(" ").join("") : t.margin || "", r = t.width;
    return (e || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((a, s) => (s.length + i.length >= r || a[a.length - 1].length + s.length + 1 < r ? a[a.length - 1] += ` ${s}` : a.push(`${i}${s}`), a), [i]).join(`
`)).join(`
`);
  }), Ze;
}
var Xe, _r;
function Hs() {
  return _r || (_r = 1, Xe = (e, t, i) => {
    i = i || t;
    let r = Math.min(t - i, e - Math.floor(i / 2));
    r < 0 && (r = 0);
    let n = Math.min(r + i, t);
    return { startIndex: r, endIndex: n };
  }), Xe;
}
var Qe, Ar;
function L() {
  return Ar || (Ar = 1, Qe = {
    action: js(),
    clear: ks(),
    style: Ls(),
    strip: _t(),
    figures: Ti(),
    lines: Ns(),
    wrap: Fs(),
    entriesToDisplay: Hs()
  }), Qe;
}
var et, Dr;
function B() {
  if (Dr)
    return et;
  Dr = 1;
  const e = J, { action: t } = L(), i = ee.exports, { beep: r, cursor: n } = _(), a = C();
  class s extends i {
    constructor(l = {}) {
      super(), this.firstRender = !0, this.in = l.stdin || process.stdin, this.out = l.stdout || process.stdout, this.onRender = (l.onRender || (() => {
      })).bind(this);
      const u = e.createInterface({ input: this.in, escapeCodeTimeout: 50 });
      e.emitKeypressEvents(this.in, u), this.in.isTTY && this.in.setRawMode(!0);
      const o = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, f = (d, h) => {
        let p = t(h, o);
        p === !1 ? this._ && this._(d, h) : typeof this[p] == "function" ? this[p](h) : this.bell();
      };
      this.close = () => {
        this.out.write(n.show), this.in.removeListener("keypress", f), this.in.isTTY && this.in.setRawMode(!1), u.close(), this.emit(this.aborted ? "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", f);
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
  return et = s, et;
}
var tt, Rr;
function Vs() {
  if (Rr)
    return tt;
  Rr = 1;
  const e = C(), t = B(), { erase: i, cursor: r } = _(), { style: n, clear: a, lines: s, figures: c } = L();
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
    _(o, f) {
      let d = this.value.slice(0, this.cursor), h = this.value.slice(this.cursor);
      this.value = `${d}${o}${h}`, this.red = !1, this.cursor = this.placeholder ? 0 : d.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart())
        return this.bell();
      let o = this.value.slice(0, this.cursor - 1), f = this.value.slice(this.cursor);
      this.value = `${o}${f}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder)
        return this.bell();
      let o = this.value.slice(0, this.cursor), f = this.value.slice(this.cursor + 1);
      this.value = `${o}${f}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
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
`).reduce((o, f, d) => o + `
${d ? " " : c.pointerSmall} ${e.red().italic(f)}`, "")), this.out.write(i.line + r.to(0) + this.outputText + r.save + this.outputError + r.restore + r.move(this.cursorOffset, 0)));
    }
  }
  return tt = l, tt;
}
var rt, qr;
function Bs() {
  if (qr)
    return rt;
  qr = 1;
  const e = C(), t = B(), { style: i, clear: r, figures: n, wrap: a, entriesToDisplay: s } = L(), { cursor: c } = _();
  class l extends t {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.hint = o.hint || "- Use arrow-keys. Return to submit.", this.warn = o.warn || "- This option is disabled", this.cursor = o.initial || 0, this.choices = o.choices.map((f, d) => (typeof f == "string" && (f = { title: f, value: d }), {
        title: f && (f.title || f.value || f),
        value: f && (f.value === void 0 ? d : f.value),
        description: f && f.description,
        selected: f && f.selected,
        disabled: f && f.disabled
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
    _(o, f) {
      if (o === " ")
        return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(c.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render();
      let { startIndex: o, endIndex: f } = s(this.cursor, this.choices.length, this.optionsPerPage);
      if (this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(!1),
        this.done ? this.selection.title : this.selection.disabled ? e.yellow(this.warn) : e.gray(this.hint)
      ].join(" "), !this.done) {
        this.outputText += `
`;
        for (let d = o; d < f; d++) {
          let h, p, y = "", v = this.choices[d];
          d === o && o > 0 ? p = n.arrowUp : d === f - 1 && f < this.choices.length ? p = n.arrowDown : p = " ", v.disabled ? (h = this.cursor === d ? e.gray().underline(v.title) : e.strikethrough().gray(v.title), p = (this.cursor === d ? e.bold().gray(n.pointer) + " " : "  ") + p) : (h = this.cursor === d ? e.cyan().underline(v.title) : v.title, p = (this.cursor === d ? e.cyan(n.pointer) + " " : "  ") + p, v.description && this.cursor === d && (y = ` - ${v.description}`, (p.length + h.length + y.length >= this.out.columns || v.description.split(/\r?\n/).length > 1) && (y = `
` + a(v.description, { margin: 3, width: this.out.columns })))), this.outputText += `${p} ${h}${e.gray(y)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  }
  return rt = l, rt;
}
var it, Ir;
function Ys() {
  if (Ir)
    return it;
  Ir = 1;
  const e = C(), t = B(), { style: i, clear: r } = L(), { cursor: n, erase: a } = _();
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
  return it = s, it;
}
var st, jr;
function F() {
  if (jr)
    return st;
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
  return st = e, st;
}
var nt, kr;
function Us() {
  if (kr)
    return nt;
  kr = 1;
  const e = F();
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
  return nt = t, nt;
}
var ot, Lr;
function Ws() {
  if (Lr)
    return ot;
  Lr = 1;
  const e = F(), t = (r) => (r = r % 10, r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th");
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
  return ot = i, ot;
}
var at, Nr;
function Gs() {
  if (Nr)
    return at;
  Nr = 1;
  const e = F();
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
  return at = t, at;
}
var lt, Fr;
function zs() {
  if (Fr)
    return lt;
  Fr = 1;
  const e = F();
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
  return lt = t, lt;
}
var ut, Hr;
function Ks() {
  if (Hr)
    return ut;
  Hr = 1;
  const e = F();
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
  return ut = t, ut;
}
var ht, Vr;
function Js() {
  if (Vr)
    return ht;
  Vr = 1;
  const e = F();
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
  return ht = t, ht;
}
var ct, Br;
function Zs() {
  if (Br)
    return ct;
  Br = 1;
  const e = F();
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
  return ct = t, ct;
}
var dt, Yr;
function Xs() {
  if (Yr)
    return dt;
  Yr = 1;
  const e = F();
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
  return dt = t, dt;
}
var ft, Ur;
function Qs() {
  return Ur || (Ur = 1, ft = {
    DatePart: F(),
    Meridiem: Us(),
    Day: Ws(),
    Hours: Gs(),
    Milliseconds: zs(),
    Minutes: Ks(),
    Month: Js(),
    Seconds: Zs(),
    Year: Xs()
  }), ft;
}
var pt, Wr;
function en() {
  if (Wr)
    return pt;
  Wr = 1;
  const e = C(), t = B(), { style: i, clear: r, figures: n } = L(), { erase: a, cursor: s } = _(), { DatePart: c, Meridiem: l, Day: u, Hours: o, Milliseconds: f, Minutes: d, Month: h, Seconds: p, Year: y } = Qs(), v = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g, g = {
    1: ({ token: x }) => x.replace(/\\(.)/g, "$1"),
    2: (x) => new u(x),
    3: (x) => new h(x),
    4: (x) => new y(x),
    5: (x) => new l(x),
    6: (x) => new o(x),
    7: (x) => new d(x),
    8: (x) => new p(x),
    9: (x) => new f(x)
  }, m = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  };
  class b extends t {
    constructor(w = {}) {
      super(w), this.msg = w.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(m, w.locales), this._date = w.initial || new Date(), this.errorMsg = w.error || "Please Enter A Valid Value", this.validator = w.validate || (() => !0), this.mask = w.mask || "YYYY-MM-DD HH:mm:ss", this.clear = r("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(w) {
      w && this._date.setTime(w.getTime());
    }
    set mask(w) {
      let $;
      for (this.parts = []; $ = v.exec(w); ) {
        let T = $.shift(), O = $.findIndex((S) => S != null);
        this.parts.push(O in g ? g[O]({ token: $[O] || T, date: this.date, parts: this.parts, locales: this.locales }) : $[O] || T);
      }
      let M = this.parts.reduce((T, O) => (typeof O == "string" && typeof T[T.length - 1] == "string" ? T[T.length - 1] += O : T.push(O), T), []);
      this.parts.splice(0), this.parts.push(...M), this.reset();
    }
    moveCursor(w) {
      this.typed = "", this.cursor = w, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((w) => w instanceof c)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let w = await this.validator(this.value);
      typeof w == "string" && (this.errorMsg = w, w = !1), this.error = !w;
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
      let w = this.parts[this.cursor].prev();
      if (w == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(w)), this.render();
    }
    right() {
      let w = this.parts[this.cursor].next();
      if (w == null)
        return this.bell();
      this.moveCursor(this.parts.indexOf(w)), this.render();
    }
    next() {
      let w = this.parts[this.cursor].next();
      this.moveCursor(w ? this.parts.indexOf(w) : this.parts.findIndex(($) => $ instanceof c)), this.render();
    }
    _(w) {
      /\d/.test(w) && (this.typed += w, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(s.hide) : this.out.write(r(this.outputText, this.out.columns)), super.render(), this.outputText = [
        i.symbol(this.done, this.aborted),
        e.bold(this.msg),
        i.delimiter(!1),
        this.parts.reduce((w, $, M) => w.concat(M === this.cursor && !this.done ? e.cyan().underline($.toString()) : $), []).join("")
      ].join(" "), this.error && (this.outputText += this.errorMsg.split(`
`).reduce(
        (w, $, M) => w + `
${M ? " " : n.pointerSmall} ${e.red().italic($)}`,
        ""
      )), this.out.write(a.line + s.to(0) + this.outputText));
    }
  }
  return pt = b, pt;
}
var mt, Gr;
function tn() {
  if (Gr)
    return mt;
  Gr = 1;
  const e = C(), t = B(), { cursor: i, erase: r } = _(), { style: n, figures: a, clear: s, lines: c } = L(), l = /[0-9]/, u = (d) => d !== void 0, o = (d, h) => {
    let p = Math.pow(10, h);
    return Math.round(d * p) / p;
  };
  class f extends t {
    constructor(h = {}) {
      super(h), this.transform = n.render(h.style), this.msg = h.message, this.initial = u(h.initial) ? h.initial : "", this.float = !!h.float, this.round = h.round || 2, this.inc = h.increment || 1, this.min = u(h.min) ? h.min : -1 / 0, this.max = u(h.max) ? h.max : 1 / 0, this.errorMsg = h.error || "Please Enter A Valid Value", this.validator = h.validate || (() => !0), this.color = "cyan", this.value = "", this.typed = "", this.lastHit = 0, this.render();
    }
    set value(h) {
      !h && h !== 0 ? (this.placeholder = !0, this.rendered = e.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder = !1, this.rendered = this.transform.render(`${o(h, this.round)}`), this._value = o(h, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(h) {
      return this.float ? parseFloat(h) : parseInt(h);
    }
    valid(h) {
      return h === "-" || h === "." && this.float || l.test(h);
    }
    reset() {
      this.typed = "", this.value = "", this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      let h = this.value;
      this.value = h !== "" ? h : this.initial, this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let h = await this.validator(this.value);
      typeof h == "string" && (this.errorMsg = h, h = !1), this.error = !h;
    }
    async submit() {
      if (await this.validate(), this.error) {
        this.color = "red", this.fire(), this.render();
        return;
      }
      let h = this.value;
      this.value = h !== "" ? h : this.initial, this.done = !0, this.aborted = !1, this.error = !1, this.fire(), this.render(), this.out.write(`
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
      let h = this.value.toString();
      if (h.length === 0)
        return this.bell();
      this.value = this.parse(h = h.slice(0, -1)) || "", this.value !== "" && this.value < this.min && (this.value = this.min), this.color = "cyan", this.fire(), this.render();
    }
    next() {
      this.value = this.initial, this.fire(), this.render();
    }
    _(h, p) {
      if (!this.valid(h))
        return this.bell();
      const y = Date.now();
      if (y - this.lastHit > 1e3 && (this.typed = ""), this.typed += h, this.lastHit = y, this.color = "cyan", h === ".")
        return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(i.down(c(this.outputError, this.out.columns) - 1) + s(this.outputError, this.out.columns)), this.out.write(s(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText = [
        n.symbol(this.done, this.aborted),
        e.bold(this.msg),
        n.delimiter(this.done),
        !this.done || !this.done && !this.placeholder ? e[this.color]().underline(this.rendered) : this.rendered
      ].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((h, p, y) => h + `
${y ? " " : a.pointerSmall} ${e.red().italic(p)}`, "")), this.out.write(r.line + i.to(0) + this.outputText + i.save + this.outputError + i.restore));
    }
  }
  return mt = f, mt;
}
var gt, zr;
function Pi() {
  if (zr)
    return gt;
  zr = 1;
  const e = C(), { cursor: t } = _(), i = B(), { clear: r, figures: n, style: a, wrap: s, entriesToDisplay: c } = L();
  class l extends i {
    constructor(o = {}) {
      super(o), this.msg = o.message, this.cursor = o.cursor || 0, this.scrollIndex = o.cursor || 0, this.hint = o.hint || "", this.warn = o.warn || "- This option is disabled -", this.minSelected = o.min, this.showMinError = !1, this.maxChoices = o.max, this.instructions = o.instructions, this.optionsPerPage = o.optionsPerPage || 10, this.value = o.choices.map((f, d) => (typeof f == "string" && (f = { title: f, value: d }), {
        title: f && (f.title || f.value || f),
        description: f && f.description,
        value: f && (f.value === void 0 ? d : f.value),
        selected: f && f.selected,
        disabled: f && f.disabled
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
      const o = this.value.filter((f) => f.selected);
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
        if (o.disabled || this.value.filter((f) => f.selected).length >= this.maxChoices)
          return this.bell();
        o.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      const o = !this.value[this.cursor].selected;
      this.value.filter((f) => !f.disabled).forEach((f) => f.selected = o), this.render();
    }
    _(o, f) {
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
    renderOption(o, f, d, h) {
      const p = (f.selected ? e.green(n.radioOn) : n.radioOff) + " " + h + " ";
      let y, v;
      return f.disabled ? y = o === d ? e.gray().underline(f.title) : e.strikethrough().gray(f.title) : (y = o === d ? e.cyan().underline(f.title) : f.title, o === d && f.description && (v = ` - ${f.description}`, (p.length + y.length + v.length >= this.out.columns || f.description.split(/\r?\n/).length > 1) && (v = `
` + s(f.description, { margin: p.length, width: this.out.columns })))), p + y + e.gray(v || "");
    }
    paginateOptions(o) {
      if (o.length === 0)
        return e.red("No matches for this query.");
      let { startIndex: f, endIndex: d } = c(this.cursor, o.length, this.optionsPerPage), h, p = [];
      for (let y = f; y < d; y++)
        y === f && f > 0 ? h = n.arrowUp : y === d - 1 && d < o.length ? h = n.arrowDown : h = " ", p.push(this.renderOption(this.cursor, o[y], y, h));
      return `
` + p.join(`
`);
    }
    renderOptions(o) {
      return this.done ? "" : this.paginateOptions(o);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((f) => f.selected).map((f) => f.title).join(", ");
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
  return gt = l, gt;
}
var vt, Kr;
function rn() {
  if (Kr)
    return vt;
  Kr = 1;
  const e = C(), t = B(), { erase: i, cursor: r } = _(), { style: n, clear: a, figures: s, wrap: c, entriesToDisplay: l } = L(), u = (h, p) => h[p] && (h[p].value || h[p].title || h[p]), o = (h, p) => h[p] && (h[p].title || h[p].value || h[p]), f = (h, p) => {
    const y = h.findIndex((v) => v.value === p || v.title === p);
    return y > -1 ? y : void 0;
  };
  class d extends t {
    constructor(p = {}) {
      super(p), this.msg = p.message, this.suggest = p.suggest, this.choices = p.choices, this.initial = typeof p.initial == "number" ? p.initial : f(p.choices, p.initial), this.select = this.initial || p.cursor || 0, this.i18n = { noMatches: p.noMatches || "no matches found" }, this.fallback = p.fallback || this.initial, this.clearFirst = p.clearFirst || !1, this.suggestions = [], this.input = "", this.limit = p.limit || 10, this.cursor = 0, this.transform = n.render(p.style), this.scale = this.transform.scale, this.render = this.render.bind(this), this.complete = this.complete.bind(this), this.clear = a("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(p) {
      this._fb = Number.isSafeInteger(parseInt(p)) ? parseInt(p) : p;
    }
    get fallback() {
      let p;
      return typeof this._fb == "number" ? p = this.choices[this._fb] : typeof this._fb == "string" && (p = { title: this._fb }), p || this._fb || { title: this.i18n.noMatches };
    }
    moveSelect(p) {
      this.select = p, this.suggestions.length > 0 ? this.value = u(this.suggestions, p) : this.value = this.fallback.value, this.fire();
    }
    async complete(p) {
      const y = this.completing = this.suggest(this.input, this.choices), v = await y;
      if (this.completing !== y)
        return;
      this.suggestions = v.map((m, b, x) => ({ title: o(x, b), value: u(x, b), description: m.description })), this.completing = !1;
      const g = Math.max(v.length - 1, 0);
      this.moveSelect(Math.min(g, this.select)), p && p();
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
    _(p, y) {
      let v = this.input.slice(0, this.cursor), g = this.input.slice(this.cursor);
      this.input = `${v}${p}${g}`, this.cursor = v.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0)
        return this.bell();
      let p = this.input.slice(0, this.cursor - 1), y = this.input.slice(this.cursor);
      this.input = `${p}${y}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length)
        return this.bell();
      let p = this.input.slice(0, this.cursor), y = this.input.slice(this.cursor + 1);
      this.input = `${p}${y}`, this.complete(this.render), this.render();
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
    renderOption(p, y, v, g) {
      let m, b = v ? s.arrowUp : g ? s.arrowDown : " ", x = y ? e.cyan().underline(p.title) : p.title;
      return b = (y ? e.cyan(s.pointer) + " " : "  ") + b, p.description && (m = ` - ${p.description}`, (b.length + x.length + m.length >= this.out.columns || p.description.split(/\r?\n/).length > 1) && (m = `
` + c(p.description, { margin: 3, width: this.out.columns }))), b + " " + x + e.gray(m || "");
    }
    render() {
      if (this.closed)
        return;
      this.firstRender ? this.out.write(r.hide) : this.out.write(a(this.outputText, this.out.columns)), super.render();
      let { startIndex: p, endIndex: y } = l(this.select, this.choices.length, this.limit);
      if (this.outputText = [
        n.symbol(this.done, this.aborted, this.exited),
        e.bold(this.msg),
        n.delimiter(this.completing),
        this.done && this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)
      ].join(" "), !this.done) {
        const v = this.suggestions.slice(p, y).map((g, m) => this.renderOption(
          g,
          this.select === m + p,
          m === 0 && p > 0,
          m + p === y - 1 && y < this.choices.length
        )).join(`
`);
        this.outputText += `
` + (v || e.gray(this.fallback.title));
      }
      this.out.write(i.line + r.to(0) + this.outputText);
    }
  }
  return vt = d, vt;
}
var yt, Jr;
function sn() {
  if (Jr)
    return yt;
  Jr = 1;
  const e = C(), { cursor: t } = _(), i = Pi(), { clear: r, style: n, figures: a } = L();
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
      let f;
      return u.disabled ? f = l === o ? e.gray().underline(u.title) : e.strikethrough().gray(u.title) : f = l === o ? e.cyan().underline(u.title) : u.title, (u.selected ? e.green(a.radioOn) : a.radioOff) + "  " + f;
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
  return yt = s, yt;
}
var bt, Zr;
function nn() {
  if (Zr)
    return bt;
  Zr = 1;
  const e = C(), t = B(), { style: i, clear: r } = L(), { erase: n, cursor: a } = _();
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
  return bt = s, bt;
}
var wt, Xr;
function on() {
  return Xr || (Xr = 1, wt = {
    TextPrompt: Vs(),
    SelectPrompt: Bs(),
    TogglePrompt: Ys(),
    DatePrompt: en(),
    NumberPrompt: tn(),
    MultiselectPrompt: Pi(),
    AutocompletePrompt: rn(),
    AutocompleteMultiselectPrompt: sn(),
    ConfirmPrompt: nn()
  }), wt;
}
var Qr;
function an() {
  return Qr || (Qr = 1, function(e) {
    const t = e, i = on(), r = (s) => s;
    function n(s, c, l = {}) {
      return new Promise((u, o) => {
        const f = new i[s](c), d = l.onAbort || r, h = l.onSubmit || r, p = l.onExit || r;
        f.on("state", c.onState || r), f.on("submit", (y) => u(h(y))), f.on("exit", (y) => u(p(y))), f.on("abort", (y) => o(d(y)));
      });
    }
    t.text = (s) => n("TextPrompt", s), t.password = (s) => (s.style = "password", t.text(s)), t.invisible = (s) => (s.style = "invisible", t.text(s)), t.number = (s) => n("NumberPrompt", s), t.date = (s) => n("DatePrompt", s), t.confirm = (s) => n("ConfirmPrompt", s), t.list = (s) => {
      const c = s.separator || ",";
      return n("TextPrompt", s, {
        onSubmit: (l) => l.split(c).map((u) => u.trim())
      });
    }, t.toggle = (s) => n("TogglePrompt", s), t.select = (s) => n("SelectPrompt", s), t.multiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const c = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("MultiselectPrompt", s, {
        onAbort: c,
        onSubmit: c
      });
    }, t.autocompleteMultiselect = (s) => {
      s.choices = [].concat(s.choices || []);
      const c = (l) => l.filter((u) => u.selected).map((u) => u.value);
      return n("AutocompleteMultiselectPrompt", s, {
        onAbort: c,
        onSubmit: c
      });
    };
    const a = (s, c) => Promise.resolve(
      c.filter((l) => l.title.slice(0, s.length).toLowerCase() === s.toLowerCase())
    );
    t.autocomplete = (s) => (s.suggest = s.suggest || a, s.choices = [].concat(s.choices || []), n("AutocompletePrompt", s));
  }(Ye)), Ye;
}
var xt, ei;
function ln() {
  if (ei)
    return xt;
  ei = 1;
  const e = an(), t = ["suggest", "format", "onState", "validate", "onRender", "type"], i = () => {
  };
  async function r(c = [], { onSubmit: l = i, onCancel: u = i } = {}) {
    const o = {}, f = r._override || {};
    c = [].concat(c);
    let d, h, p, y, v, g;
    const m = async (b, x, w = !1) => {
      if (!(!w && b.validate && b.validate(x) !== !0))
        return b.format ? await b.format(x, o) : x;
    };
    for (h of c)
      if ({ name: y, type: v } = h, typeof v == "function" && (v = await v(d, { ...o }, h), h.type = v), !!v) {
        for (let b in h) {
          if (t.includes(b))
            continue;
          let x = h[b];
          h[b] = typeof x == "function" ? await x(d, { ...o }, g) : x;
        }
        if (g = h, typeof h.message != "string")
          throw new Error("prompt message is required");
        if ({ name: y, type: v } = h, e[v] === void 0)
          throw new Error(`prompt type (${v}) is not defined`);
        if (f[h.name] !== void 0 && (d = await m(h, f[h.name]), d !== void 0)) {
          o[y] = d;
          continue;
        }
        try {
          d = r._injected ? n(r._injected, h.initial) : await e[v](h), o[y] = d = await m(h, d, !0), p = await l(h, d, o);
        } catch {
          p = !await u(h, o);
        }
        if (p)
          return o;
      }
    return o;
  }
  function n(c, l) {
    const u = c.shift();
    if (u instanceof Error)
      throw u;
    return u === void 0 ? l : u;
  }
  function a(c) {
    r._injected = (r._injected || []).concat(c);
  }
  function s(c) {
    r._override = Object.assign({}, c);
  }
  return xt = Object.assign(r, { prompt: r, prompts: e, inject: a, override: s }), xt;
}
function un(e) {
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
var Ei = un("8.6.0") ? Is() : ln(), ae = /* @__PURE__ */ ((e) => (e[e.Success = 0] = "Success", e[e.FatalError = 1] = "FatalError", e[e.InvalidArgument = 9] = "InvalidArgument", e))(ae || {}), Ci = {};
(function(e) {
  e.__esModule = !0;
  function t(r, n, a) {
    var s = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi, c = r, l = [];
    n && l.push(n), a && l.push(a);
    var u;
    do
      u = s.exec(c), u !== null && l.push(i(u[1], u[6], u[0]));
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
})(Ci);
var _i = { exports: {} };
(function(e, t) {
  (function(i, r) {
    e.exports = r();
  })(X, function() {
    var i = typeof Promise == "function", r = typeof self == "object" ? self : X, n = typeof Symbol < "u", a = typeof Map < "u", s = typeof Set < "u", c = typeof WeakMap < "u", l = typeof WeakSet < "u", u = typeof DataView < "u", o = n && typeof Symbol.iterator < "u", f = n && typeof Symbol.toStringTag < "u", d = s && typeof Set.prototype.entries == "function", h = a && typeof Map.prototype.entries == "function", p = d && Object.getPrototypeOf((/* @__PURE__ */ new Set()).entries()), y = h && Object.getPrototypeOf((/* @__PURE__ */ new Map()).entries()), v = o && typeof Array.prototype[Symbol.iterator] == "function", g = v && Object.getPrototypeOf([][Symbol.iterator]()), m = o && typeof String.prototype[Symbol.iterator] == "function", b = m && Object.getPrototypeOf(""[Symbol.iterator]()), x = 8, w = -1;
    function $(M) {
      var T = typeof M;
      if (T !== "object")
        return T;
      if (M === null)
        return "null";
      if (M === r)
        return "global";
      if (Array.isArray(M) && (f === !1 || !(Symbol.toStringTag in M)))
        return "Array";
      if (typeof window == "object" && window !== null) {
        if (typeof window.location == "object" && M === window.location)
          return "Location";
        if (typeof window.document == "object" && M === window.document)
          return "Document";
        if (typeof window.navigator == "object") {
          if (typeof window.navigator.mimeTypes == "object" && M === window.navigator.mimeTypes)
            return "MimeTypeArray";
          if (typeof window.navigator.plugins == "object" && M === window.navigator.plugins)
            return "PluginArray";
        }
        if ((typeof window.HTMLElement == "function" || typeof window.HTMLElement == "object") && M instanceof window.HTMLElement) {
          if (M.tagName === "BLOCKQUOTE")
            return "HTMLQuoteElement";
          if (M.tagName === "TD")
            return "HTMLTableDataCellElement";
          if (M.tagName === "TH")
            return "HTMLTableHeaderCellElement";
        }
      }
      var O = f && M[Symbol.toStringTag];
      if (typeof O == "string")
        return O;
      var S = Object.getPrototypeOf(M);
      return S === RegExp.prototype ? "RegExp" : S === Date.prototype ? "Date" : i && S === Promise.prototype ? "Promise" : s && S === Set.prototype ? "Set" : a && S === Map.prototype ? "Map" : l && S === WeakSet.prototype ? "WeakSet" : c && S === WeakMap.prototype ? "WeakMap" : u && S === DataView.prototype ? "DataView" : a && S === y ? "Map Iterator" : s && S === p ? "Set Iterator" : v && S === g ? "Array Iterator" : m && S === b ? "String Iterator" : S === null ? "Object" : Object.prototype.toString.call(M).slice(x, w);
    }
    return $;
  });
})(_i);
const { parseArgsStringToArgv: hn } = Ci, cn = _i.exports;
var dn = fn;
function fn(e) {
  let t, i, r, n, a;
  try {
    ({ command: t, args: i, options: r, callback: n } = pn(e));
    let s = [];
    typeof t == "string" && i === void 0 && (t = ti(t)), Array.isArray(t) && (s = t.slice(1), t = t[0]), typeof i == "string" && (i = ti(i)), Array.isArray(i) && (i = s.concat(i)), i == null && (i = s), r == null && (r = {}), r.encoding = r.encoding || "utf8", mn(t, i, r, n);
  } catch (s) {
    a = s, t = String(t || ""), i = (Array.isArray(i) ? i : []).map((c) => String(c || ""));
  }
  return { command: t, args: i, options: r, callback: n, error: a };
}
function pn(e) {
  e = Array.prototype.slice.call(e);
  let t, i, r, n, a = e[e.length - 1];
  return typeof a == "function" && (n = a, e.pop()), a = e[e.length - 1], (a == null || typeof a == "object" && !Array.isArray(a)) && (r = a, e.pop()), t = e.shift(), e.length === 0 ? i = void 0 : e.length === 1 && Array.isArray(e[0]) ? i = e[0] : e.length === 1 && e[0] === "" ? i = [] : i = e, { command: t, args: i, options: r, callback: n };
}
function mn(e, t, i, r) {
  if (e == null)
    throw new Error("The command to execute is missing.");
  if (typeof e != "string")
    throw new Error("The command to execute should be a string, not " + Z(e));
  if (!Array.isArray(t))
    throw new Error(
      "The command arguments should be a string or an array, not " + Z(t)
    );
  for (let n = 0; n < t.length; n++) {
    let a = t[n];
    if (typeof a != "string")
      throw new Error(
        `The command arguments should be strings, but argument #${n + 1} is ` + Z(a)
      );
  }
  if (typeof i != "object")
    throw new Error(
      "The options should be an object, not " + Z(i)
    );
  if (r != null && typeof r != "function")
    throw new Error("The callback should be a function, not " + Z(r));
}
function ti(e) {
  try {
    return hn(e);
  } catch (t) {
    throw new Error(`Could not parse the string: ${e}
${t.message}`);
  }
}
function Z(e) {
  let t = cn(e), i = String(t)[0].toLowerCase();
  return ["a", "e", "i", "o", "u"].indexOf(i) === -1 ? `a ${t}.` : `an ${t}.`;
}
var gn = class {
  constructor({ command: t, args: i, pid: r, stdout: n, stderr: a, output: s, status: c, signal: l, options: u }) {
    u = u || {}, n = n || (u.encoding === "buffer" ? Buffer.from([]) : ""), a = a || (u.encoding === "buffer" ? Buffer.from([]) : ""), s = s || [u.input || null, n, a], this.command = t || "", this.args = i || [], this.pid = r || 0, this.stdout = s[1], this.stderr = s[2], this.output = s, this.status = c, this.signal = l || null;
  }
  toString() {
    let t = this.command;
    for (let i of this.args)
      i = i.replace(/"/g, '\\"'), i.indexOf(" ") >= 0 ? t += ` "${i}"` : t += ` ${i}`;
    return t;
  }
}, vn = class Ai extends Error {
  constructor(t) {
    let i = `${t.toString()} exited with a status of ${t.status}.`;
    t.stderr.length > 0 && (i += `

` + t.stderr.toString().trim()), super(i), Object.assign(this, t), this.name = Ai.name;
  }
};
const yn = gn, bn = vn;
var wn = xn;
function xn({ command: e, args: t, pid: i, stdout: r, stderr: n, output: a, status: s, signal: c, options: l, error: u }) {
  let o = new yn({ command: e, args: t, pid: i, stdout: r, stderr: n, output: a, status: s, signal: c, options: l });
  if (u)
    throw o.status === void 0 && (o.status = null), Object.assign(u, o);
  if (o.status)
    throw new bn(o);
  return o;
}
var U = { exports: {} }, St, ri;
function Sn() {
  if (ri)
    return St;
  ri = 1, St = r, r.sync = n;
  var e = J;
  function t(a, s) {
    var c = s.pathExt !== void 0 ? s.pathExt : process.env.PATHEXT;
    if (!c || (c = c.split(";"), c.indexOf("") !== -1))
      return !0;
    for (var l = 0; l < c.length; l++) {
      var u = c[l].toLowerCase();
      if (u && a.substr(-u.length).toLowerCase() === u)
        return !0;
    }
    return !1;
  }
  function i(a, s, c) {
    return !a.isSymbolicLink() && !a.isFile() ? !1 : t(s, c);
  }
  function r(a, s, c) {
    e.stat(a, function(l, u) {
      c(l, l ? !1 : i(u, a, s));
    });
  }
  function n(a, s) {
    return i(e.statSync(a), a, s);
  }
  return St;
}
var $t, ii;
function $n() {
  if (ii)
    return $t;
  ii = 1, $t = t, t.sync = i;
  var e = J;
  function t(a, s, c) {
    e.stat(a, function(l, u) {
      c(l, l ? !1 : r(u, s));
    });
  }
  function i(a, s) {
    return r(e.statSync(a), s);
  }
  function r(a, s) {
    return a.isFile() && n(a, s);
  }
  function n(a, s) {
    var c = a.mode, l = a.uid, u = a.gid, o = s.uid !== void 0 ? s.uid : process.getuid && process.getuid(), f = s.gid !== void 0 ? s.gid : process.getgid && process.getgid(), d = parseInt("100", 8), h = parseInt("010", 8), p = parseInt("001", 8), y = d | h, v = c & p || c & h && u === f || c & d && l === o || c & y && o === 0;
    return v;
  }
  return $t;
}
var se;
process.platform === "win32" || X.TESTING_WINDOWS ? se = Sn() : se = $n();
var On = At;
At.sync = Mn;
function At(e, t, i) {
  if (typeof t == "function" && (i = t, t = {}), !i) {
    if (typeof Promise != "function")
      throw new TypeError("callback not provided");
    return new Promise(function(r, n) {
      At(e, t || {}, function(a, s) {
        a ? n(a) : r(s);
      });
    });
  }
  se(e, t || {}, function(r, n) {
    r && (r.code === "EACCES" || t && t.ignoreErrors) && (r = null, n = !1), i(r, n);
  });
}
function Mn(e, t) {
  try {
    return se.sync(e, t || {});
  } catch (i) {
    if (t && t.ignoreErrors || i.code === "EACCES")
      return !1;
    throw i;
  }
}
const z = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", Di = ne, Tn = z ? ";" : ":", Ri = On, qi = (e) => Object.assign(new Error(`not found: ${e}`), { code: "ENOENT" }), Ii = (e, t) => {
  const i = t.colon || Tn, r = e.match(/\//) || z && e.match(/\\/) ? [""] : [
    ...z ? [process.cwd()] : [],
    ...(t.path || process.env.PATH || "").split(i)
  ], n = z ? t.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", a = z ? n.split(i) : [""];
  return z && e.indexOf(".") !== -1 && a[0] !== "" && a.unshift(""), {
    pathEnv: r,
    pathExt: a,
    pathExtExe: n
  };
}, ji = (e, t, i) => {
  typeof t == "function" && (i = t, t = {}), t || (t = {});
  const { pathEnv: r, pathExt: n, pathExtExe: a } = Ii(e, t), s = [], c = (u) => new Promise((o, f) => {
    if (u === r.length)
      return t.all && s.length ? o(s) : f(qi(e));
    const d = r[u], h = /^".*"$/.test(d) ? d.slice(1, -1) : d, p = Di.join(h, e), y = !h && /^\.[\\\/]/.test(e) ? e.slice(0, 2) + p : p;
    o(l(y, u, 0));
  }), l = (u, o, f) => new Promise((d, h) => {
    if (f === n.length)
      return d(c(o + 1));
    const p = n[f];
    Ri(u + p, { pathExt: a }, (y, v) => {
      if (!y && v)
        if (t.all)
          s.push(u + p);
        else
          return d(u + p);
      return d(l(u, o, f + 1));
    });
  });
  return i ? c(0).then((u) => i(null, u), i) : c(0);
}, Pn = (e, t) => {
  t = t || {};
  const { pathEnv: i, pathExt: r, pathExtExe: n } = Ii(e, t), a = [];
  for (let s = 0; s < i.length; s++) {
    const c = i[s], l = /^".*"$/.test(c) ? c.slice(1, -1) : c, u = Di.join(l, e), o = !l && /^\.[\\\/]/.test(e) ? e.slice(0, 2) + u : u;
    for (let f = 0; f < r.length; f++) {
      const d = o + r[f];
      try {
        if (Ri.sync(d, { pathExt: n }))
          if (t.all)
            a.push(d);
          else
            return d;
      } catch {
      }
    }
  }
  if (t.all && a.length)
    return a;
  if (t.nothrow)
    return null;
  throw qi(e);
};
var En = ji;
ji.sync = Pn;
var Dt = { exports: {} };
const ki = (e = {}) => {
  const t = e.env || process.env;
  return (e.platform || process.platform) !== "win32" ? "PATH" : Object.keys(t).reverse().find((r) => r.toUpperCase() === "PATH") || "Path";
};
Dt.exports = ki;
Dt.exports.default = ki;
const si = ne, Cn = En, _n = Dt.exports;
function ni(e, t) {
  const i = e.options.env || process.env, r = process.cwd(), n = e.options.cwd != null, a = n && process.chdir !== void 0 && !process.chdir.disabled;
  if (a)
    try {
      process.chdir(e.options.cwd);
    } catch {
    }
  let s;
  try {
    s = Cn.sync(e.command, {
      path: i[_n({ env: i })],
      pathExt: t ? si.delimiter : void 0
    });
  } catch {
  } finally {
    a && process.chdir(r);
  }
  return s && (s = si.resolve(n ? e.options.cwd : "", s)), s;
}
function An(e) {
  return ni(e) || ni(e, !0);
}
var Dn = An, Rt = {};
const Et = /([()\][%!^"`<>&|;, *?])/g;
function Rn(e) {
  return e = e.replace(Et, "^$1"), e;
}
function qn(e, t) {
  return e = `${e}`, e = e.replace(/(\\*)"/g, '$1$1\\"'), e = e.replace(/(\\*)$/, "$1$1"), e = `"${e}"`, e = e.replace(Et, "^$1"), t && (e = e.replace(Et, "^$1")), e;
}
Rt.command = Rn;
Rt.argument = qn;
var In = /^#!(.*)/;
const jn = In;
var kn = (e = "") => {
  const t = e.match(jn);
  if (!t)
    return null;
  const [i, r] = t[0].replace(/#! ?/, "").split(" "), n = i.split("/").pop();
  return n === "env" ? r : r ? `${n} ${r}` : n;
};
const Ot = J, Ln = kn;
function Nn(e) {
  const i = Buffer.alloc(150);
  let r;
  try {
    r = Ot.openSync(e, "r"), Ot.readSync(r, i, 0, 150, 0), Ot.closeSync(r);
  } catch {
  }
  return Ln(i.toString());
}
var Fn = Nn;
const Hn = ne, oi = Dn, ai = Rt, Vn = Fn, Bn = process.platform === "win32", Yn = /\.(?:com|exe)$/i, Un = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
function Wn(e) {
  e.file = oi(e);
  const t = e.file && Vn(e.file);
  return t ? (e.args.unshift(e.file), e.command = t, oi(e)) : e.file;
}
function Gn(e) {
  if (!Bn)
    return e;
  const t = Wn(e), i = !Yn.test(t);
  if (e.options.forceShell || i) {
    const r = Un.test(t);
    e.command = Hn.normalize(e.command), e.command = ai.command(e.command), e.args = e.args.map((a) => ai.argument(a, r));
    const n = [e.command].concat(e.args).join(" ");
    e.args = ["/d", "/s", "/c", `"${n}"`], e.command = process.env.comspec || "cmd.exe", e.options.windowsVerbatimArguments = !0;
  }
  return e;
}
function zn(e, t, i) {
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
  return i.shell ? r : Gn(r);
}
var Kn = zn;
const qt = process.platform === "win32";
function It(e, t) {
  return Object.assign(new Error(`${t} ${e.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${t} ${e.command}`,
    path: e.command,
    spawnargs: e.args
  });
}
function Jn(e, t) {
  if (!qt)
    return;
  const i = e.emit;
  e.emit = function(r, n) {
    if (r === "exit") {
      const a = Li(n, t);
      if (a)
        return i.call(e, "error", a);
    }
    return i.apply(e, arguments);
  };
}
function Li(e, t) {
  return qt && e === 1 && !t.file ? It(t.original, "spawn") : null;
}
function Zn(e, t) {
  return qt && e === 1 && !t.file ? It(t.original, "spawnSync") : null;
}
var Xn = {
  hookChildProcess: Jn,
  verifyENOENT: Li,
  verifyENOENTSync: Zn,
  notFoundError: It
};
const Ni = J, jt = Kn, kt = Xn;
function Fi(e, t, i) {
  const r = jt(e, t, i), n = Ni.spawn(r.command, r.args, r.options);
  return kt.hookChildProcess(n, r), n;
}
function Qn(e, t, i) {
  const r = jt(e, t, i), n = Ni.spawnSync(r.command, r.args, r.options);
  return n.error = n.error || kt.verifyENOENTSync(n.status, r), n;
}
U.exports = Fi;
U.exports.spawn = Fi;
U.exports.sync = Qn;
U.exports._parse = jt;
U.exports._enoent = kt;
U.exports.sync;
var li = X.process && process.nextTick || X.setImmediate || function(e) {
  setTimeout(e, 0);
}, eo = function(t, i) {
  if (t) {
    i.then(function(r) {
      li(function() {
        t(null, r);
      });
    }, function(r) {
      li(function() {
        t(r);
      });
    });
    return;
  } else
    return i;
};
const to = dn, re = wn, ro = eo, io = U.exports;
var so = no;
function no() {
  let { command: e, args: t, options: i, callback: r, error: n } = to(arguments);
  return ro(r, new Promise((a, s) => {
    if (n)
      re({ command: e, args: t, options: i, error: n });
    else {
      let c;
      try {
        c = io(e, t, i);
      } catch (f) {
        re({ error: f, command: e, args: t, options: i });
      }
      let l = c.pid, u = i.encoding === "buffer" ? Buffer.from([]) : "", o = i.encoding === "buffer" ? Buffer.from([]) : "";
      c.stdout && c.stdout.on("data", (f) => {
        typeof u == "string" ? u += f.toString() : u = Buffer.concat([u, f]);
      }), c.stderr && c.stderr.on("data", (f) => {
        typeof o == "string" ? o += f.toString() : o = Buffer.concat([o, f]);
      }), c.on("error", (f) => {
        try {
          re({ error: f, command: e, args: t, options: i, pid: l, stdout: u, stderr: o });
        } catch (d) {
          s(d);
        }
      }), c.on("exit", (f, d) => {
        try {
          a(re({ command: e, args: t, options: i, pid: l, stdout: u, stderr: o, status: f, signal: d }));
        } catch (h) {
          s(h);
        }
      });
    }
  }));
}
var oo = so;
const ao = /^(?:( )+|\t+)/, Q = "space", Hi = "tab";
function ui(e, t) {
  const i = /* @__PURE__ */ new Map();
  let r = 0, n, a;
  for (const s of e.split(/\n/g)) {
    if (!s)
      continue;
    let c, l, u, o;
    const f = s.match(ao);
    if (f === null)
      r = 0, n = "";
    else {
      if (c = f[0].length, l = f[1] ? Q : Hi, t && l === Q && c === 1)
        continue;
      l !== n && (r = 0), n = l, u = 0;
      const d = c - r;
      if (r = c, d === 0)
        u++;
      else {
        const h = d > 0 ? d : -d;
        a = lo(l, h);
      }
      o = i.get(a), o = o === void 0 ? [1, 0] : [++o[0], o[1] + u], i.set(a, o);
    }
  }
  return i;
}
function lo(e, t) {
  return (e === Q ? "s" : "t") + String(t);
}
function uo(e) {
  const i = e[0] === "s" ? Q : Hi, r = Number(e.slice(1));
  return { type: i, amount: r };
}
function ho(e) {
  let t, i = 0, r = 0;
  for (const [n, [a, s]] of e)
    (a > i || a === i && s > r) && (i = a, r = s, t = n);
  return t;
}
function co(e, t) {
  return (e === Q ? " " : "	").repeat(t);
}
function fo(e) {
  if (typeof e != "string")
    throw new TypeError("Expected a string");
  let t = ui(e, !0);
  t.size === 0 && (t = ui(e, !1));
  const i = ho(t);
  let r, n = 0, a = "";
  return i !== void 0 && ({ type: r, amount: n } = uo(i), a = co(r, n)), {
    amount: n,
    type: r,
    indent: a
  };
}
function po(e) {
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
async function mo(e, t) {
  const i = await go(e, t), r = JSON.parse(i.data), n = fo(i.data).indent, a = po(i.data);
  return { ...i, data: r, indent: n, newline: a };
}
function go(e, t) {
  return new Promise((i, r) => {
    const n = ne.join(t, e);
    $i.readFile(n, "utf8", (a, s) => {
      a ? r(a) : i({
        path: n,
        data: s
      });
    });
  });
}
function vo(e) {
  return e && typeof e == "object" && Mt(e.name) && Mt(e.version) && Mt(e.description);
}
function Mt(e) {
  const t = typeof e;
  return e === null || t === "undefined" || t === "string";
}
async function Y(e) {
  const { data: t } = await mo("package.json", Vi(process.cwd(), ".."));
  vo(t) && yo(t, e) && await oo("npm", ["run", e, "--silent"], { stdio: "inherit" });
}
function yo(e, t) {
  const i = e.scripts;
  return i && typeof i == "object" ? Boolean(i[t]) : !1;
}
var H = /* @__PURE__ */ ((e) => (e.Build = "build", e.BuildComponents = "build:components", e.BuildElements = "build:elements", e.BuildFunctions = "build:functions", e.BuildPages = "build:pages", e.BuildDocs = "build:docs", e.Dev = "dev", e.DevComponents = "dev:components", e.DevFunctions = "dev:functions", e.DevPages = "dev:pages", e.DevDocs = "dev:docs", e.Playground = "playground", e))(H || {});
const { prompts: bo } = Ei;
async function hi(e) {
  e.components || e === "components" ? (console.log("Starting development server for your components..."), await Y(H.DevComponents)) : await bo.select({
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
  }) === "components" ? (console.log("Starting development server for your components..."), await Y(H.DevComponents)) : process.exit(ae.InvalidArgument);
}
const { prompts: wo } = Ei;
async function Tt(e) {
  if (e.components || e === "components")
    console.log("Building your component library for production use & npm/CDN distribution..."), await Y(H.BuildComponents), console.log("Building your web component library for production use & npm/CDN distribution..."), await Y(H.BuildElements);
  else if (e.webComponents || e.elements || e === "web-components" || e === "elements")
    console.log("Building your web component library for production use & npm/CDN distribution..."), await Y(H.BuildElements);
  else {
    const t = await wo.select({
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
    t === "components" ? (console.log("Building your Stacks component library for production use..."), await Y(H.BuildComponents)) : t === "functions" ? (console.log("Building your Stacks function library for production use..."), await Y(H.DevFunctions)) : process.exit(ae.InvalidArgument);
  }
}
async function xo() {
  try {
    const e = ls("artisan");
    process.on("uncaughtException", Pt), process.on("unhandledRejection", Pt), e.version(G).command("dev", "Start the development server for any of the following packages").option("-c, --components", "Start the Components development server").option("-f, --functions", "Start the Functions development server").option("-p, --pages", "Start the Pages development server").option("-d, --docs", "Start the Documentation development server").action(async (t) => {
      await hi(t);
    }), e.version(G).command("dev:components", "Start the development server for your component library").action(async () => {
      await hi("components");
    }), e.version(G).command("build", "Automagically build any of your libraries/packages for production use. Select any of the following packages").option("-c, --components", "Build your component library").option("-w, --web-components", "Build your web component library").option("-e, --elements", "An alias to the -w flag").option("-f, --functions", "Build your function library").option("-p, --pages", "Build your pages").option("-d, --docs", "Build your documentation").action(async (t) => {
      await Tt(t);
    }), e.version(G).command("build:components", "Automagically build your component libraries for production use & npm/CDN distribution.").action(async () => {
      await Tt("components");
    }), e.version(G).command("build:elements", "Automagically build web component library for production use & npm/CDN distribution.").action(async () => {
      await Tt("web-components");
    }), e.version(G).command("version", "Review the current version").outputVersion(), e.parse();
  } catch (e) {
    Pt(e);
  }
}
function Pt(e) {
  let t = e.message || String(e);
  (process.env.DEBUG || process.env.NODE_ENV === "development") && (t = e.stack || t), console.error(t), process.exit(ae.FatalError);
}
xo();
