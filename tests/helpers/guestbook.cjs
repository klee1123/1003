const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHmac, randomUUID } = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "../../apps-script/Code.gs"), "utf8");

const id = (value) => value.toString(16).padStart(32, "0");
const input = (value = 1, overrides = {}) => ({ action: "create", id: id(value), clientId: id(value + 1000), name: "친구", message: "두 사람의 결혼을 축하해요!", website: "", passwordProof: "a".repeat(64), ...overrides });

function backend({ approval = false, configured = true } = {}) {
  const records = [];
  const cache = new Map();
  const properties = new Map();
  const control = { lockAvailable: true, releases: 0, richWrites: 0, rangeReads: 0, maxRows: 1000, failWrites: false };
  const sheet = {
    getLastRow: () => records.length,
    getMaxRows: () => control.maxRows,
    getMaxColumns: () => 26,
    insertRowsAfter: (_after, count) => { control.maxRows += count; },
    setFrozenRows() {}, setColumnWidth() {},
    getRange(row, column, height, width) {
      if (row + height - 1 > control.maxRows) throw new Error("Outside sheet bounds");
      return {
        getDisplayValues: () => {
          control.rangeReads++;
          return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => String(records[row - 1 + i]?.[column - 1 + j] ?? "")));
        },
        setValues(values) {
          values.forEach((cells, i) => {
            records[row - 1 + i] ??= [];
            cells.forEach((cell, j) => { records[row - 1 + i][column - 1 + j] = cell; });
          });
          return this;
        },
        setRichTextValues(values) {
          if (control.failWrites) throw new Error("Simulated Sheets outage");
          control.richWrites++;
          return this.setValues(values.map((cells) => cells.map((cell) => cell.text)));
        },
        setFontWeight() { return this; }, setBackground() { return this; }, setWrap() { return this; }
      };
    }
  };
  const spreadsheet = { getSheetByName: () => sheet, insertSheet: () => sheet, getId: () => "test-sheet-id" };
  const context = vm.createContext({
    console: { log() {}, error() {} },
    Utilities: { getUuid: randomUUID, Charset: { UTF_8: "utf8" }, computeHmacSha256Signature: (value, key) => [...createHmac("sha256", key).update(value, "utf8").digest()] },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      flush() {},
      newRichTextValue: () => ({ setText(text) { this.text = text; return this; }, build() { return { text: this.text }; } })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: (key) => cache.get(key), remove: (key) => cache.delete(key) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => control.lockAvailable, releaseLock: () => control.releases++ }) },
    ContentService: { MimeType: { JSON: "json", JAVASCRIPT: "javascript" }, createTextOutput: (body) => ({ body, setMimeType(type) { this.type = type; return this; } }) }
  });
  vm.runInContext(source.replace("REQUIRE_APPROVAL: false", `REQUIRE_APPROVAL: ${approval}`), context);
  if (configured) context.setup();
  return {
    context, records, cache, properties, control,
    get: (parameter) => JSON.parse(context.doGet({ parameter }).body),
    post: (parameter) => JSON.parse(context.doPost({ parameter }).body)
  };
}

module.exports = { backend, id, input };
