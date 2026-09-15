const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "../../js/guestbook.js"), "utf8");
const markup = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");

class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.handlers = {};
    this.attributes = {};
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.ownText = "";
  }
  get textContent() { return this.ownText + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  set innerHTML(_value) { throw new Error("Guest text must never be rendered as HTML"); }
  setAttribute(name, value) { this.attributes[name] = value; }
  setCustomValidity(message) { this.validationMessage = message; }
  focus() { this.focused = true; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  append(...children) {
    children.forEach((child) => {
      if (child.tag === "fragment") this.append(...child.children);
      else { child.parent = this; this.children.push(child); }
    });
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function client(app, options = {}) {
  const nodes = {};
  for (const match of markup.matchAll(/<([a-z][^\s/>]*)([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    if (nodes[match[3]]) throw new Error("Duplicate HTML ID: " + match[3]);
    const element = new Element(match[1]);
    element.hidden = /\bhidden\b/.test(match[2]);
    element.required = /\brequired\b/.test(match[2]);
    element.maxLength = Number(match[2].match(/maxlength="(\d+)"/)?.[1]) || Infinity;
    element.minLength = Number(match[2].match(/minlength="(\d+)"/)?.[1]) || 0;
    nodes[match[3]] = element;
  }
  const setUpForm = (form, fields) => {
    const formFields = fields.map((key) => nodes[key]);
    nodes[form].reset = () => formFields.forEach((field) => { field.value = ""; });
    nodes[form].reportValidity = () => formFields.every((field) => field.disabled || (!field.validationMessage && (!field.required || field.value) && field.value.length >= field.minLength && field.value.length <= field.maxLength));
  };
  setUpForm("guestbookForm", ["guestbookName", "guestbookMessage", "guestbookWebsite", "guestbookPassword"]);
  setUpForm("guestbookManage", ["guestbookEditName", "guestbookEditMessage", "guestbookManagePassword"]);

  const timers = new Set();
  const manualTimers = new Map();
  let clockTime = 0;
  let nextTimer = 0;
  const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
  const control = { posts: [], reads: [], dropPost: false, losePostResponse: false, holdPost: false, heldPosts: [], holdLists: Boolean(options.holdLists), heldLists: [], holdStatuses: false, heldStatuses: [], failReads: false };
  const head = new Element("head");
  const storage = new Map();
  const document = {
    head,
    querySelector: (selector) => nodes[selector.slice(1)],
    getElementById: (key) => nodes[key],
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element("fragment")
  };
  const context = vm.createContext({
    document, crypto: webcrypto, URL, URLSearchParams, AbortController, Intl, TextEncoder,
    WEDDING_DATA: { guestbook: options.config ?? { enabled: true, endpoint: "https://script.google.com/macros/s/test-deployment/exec" } },
    localStorage: {
      getItem: (key) => { if (options.blockStorage) throw new Error("Storage blocked"); return storage.get(key); },
      setItem: (key, value) => { if (options.blockStorage) throw new Error("Storage blocked"); storage.set(key, value); }
    },
    setTimeout: (fn, ms) => {
      if (options.manualTimers) {
        const timer = ++nextTimer;
        manualTimers.set(timer, { fn, at: clockTime + ms });
        return timer;
      }
      const timer = setTimeout(fn, ms === 60000 ? 60000 : ms >= 15000 ? 100 : 0);
      if (ms === 60000) timer.unref();
      timers.add(timer);
      return timer;
    },
    clearTimeout: (timer) => options.manualTimers ? manualTimers.delete(timer) : clearTimeout(timer),
    fetch: async (_url, request) => {
      if (request.method !== "POST" || request.mode !== "no-cors" || request.credentials !== "omit") throw new Error("Unexpected transport");
      const parameter = Object.fromEntries(request.body);
      control.posts.push(parameter);
      if (!control.dropPost) app.post(parameter);
      if (control.holdPost) await new Promise((resolve) => control.heldPosts.push(resolve));
      if (control.losePostResponse) throw new Error("Lost network response");
      return { type: "opaque", status: 0 };
    }
  });
  context.window = context;
  head.append = (script) => {
    const parameters = Object.fromEntries(new URL(script.src).searchParams);
    control.reads.push(parameters);
    const output = app.context.doGet({ parameter: parameters });
    const deliver = () => queueMicrotask(() => {
      if (control.failReads) script.onerror();
      else vm.runInContext(output.body, context);
    });
    if (control.holdLists && parameters.action === "list") control.heldLists.push(deliver);
    else if (control.holdStatuses && parameters.action === "status") control.heldStatuses.push(deliver);
    else deliver();
  };
  vm.runInContext(source, context);
  return {
    nodes, control, context,
    fill(name = "친구", message = "행복하게 잘 살아!", password = "1234") {
      nodes.guestbookName.value = name;
      nodes.guestbookMessage.value = message;
      nodes.guestbookPassword.value = password;
      nodes.guestbookName.handlers.input();
      nodes.guestbookMessage.handlers.input();
      nodes.guestbookPassword.handlers.input();
    },
    send: () => nodes.guestbookForm.handlers.submit({ preventDefault() {} }),
    manage: () => nodes.guestbookManage.handlers.submit({ preventDefault() {} }),
    openManage(action = "update", index = 0) {
      const buttons = nodes.guestbookList.children[index].children.find((child) => child.className === "guestbook-entry__actions");
      buttons.children[action === "update" ? 0 : 1].handlers.click();
    },
    flush,
    advanceTime: async (ms) => {
      if (!options.manualTimers) throw new Error("Enable manualTimers before advancing time");
      const target = clockTime + ms;
      while (true) {
        const next = [...manualTimers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        clockTime = timer.at;
        manualTimers.delete(id);
        timer.fn();
        await flush();
      }
      clockTime = target;
      await flush();
    },
    dispose: () => { timers.forEach(clearTimeout); manualTimers.clear(); }
  };
}

module.exports = { client };
