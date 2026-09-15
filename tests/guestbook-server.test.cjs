const test = require("node:test");
const assert = require("node:assert/strict");
const { backend, id, input } = require("./helpers/guestbook.cjs");

test("setup is repeatable and preserves existing messages", () => {
  const app = backend();
  app.post(input());
  const before = JSON.stringify(app.records);
  app.context.setup();
  assert.equal(JSON.stringify(app.records), before);
});

test("POST persists literal text and public GET only exposes display fields", () => {
  const app = backend();
  const text = '=IMPORTXML("https://example.invalid", "//x")\n<script>alert(1)</script>';
  const result = app.post(input(1, { name: "  =1+1  ", message: text }));
  assert.equal(result.state, "published");
  assert.equal(app.control.richWrites, 1);
  const page = app.get({ action: "list" });
  assert.equal(page.total, 1);
  assert.equal(page.entries[0].name, "=1+1");
  assert.equal(page.entries[0].message, text);
  assert.deepEqual(Object.keys(page.entries[0]).sort(), ["createdAt", "id", "message", "name", "revision"]);
  assert.equal(app.get({ action: "status", id: id(1) }).state, "published");
});

test("a missing password key prevents writes without exposing server details", () => {
  const app = backend();
  app.properties.delete("GUESTBOOK_PASSWORD_KEY");
  const result = app.post(input());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNAVAILABLE");
  assert.equal(app.records.length, 1);
  assert.ok(!result.error.message.includes("GUESTBOOK_PASSWORD_KEY"));
});

test("receipt includes a fresh public page without an additional Sheets data read", () => {
  const app = backend();
  for (let i = 1; i <= 8; i++) app.post(input(i));
  app.records[1][4] = "pending";
  app.records[2][4] = "hidden";
  app.records[3][4] = "deleted";
  const before = app.control.rangeReads;
  const receipt = app.get({ action: "status", id: id(1) });
  assert.equal(app.control.rangeReads - before, 2); // Header and one data range.
  assert.equal(receipt.state, "pending");
  assert.deepEqual(receipt.list, app.get({ action: "list" }));
  assert.equal(receipt.list.total, 5);
  assert.ok(receipt.list.entries.every((entry) => ![id(1), id(2), id(3)].includes(entry.id)));
  assert.deepEqual(Object.keys(receipt.list.entries[0]).sort(), ["createdAt", "id", "message", "name", "revision"]);
  assert.ok(!JSON.stringify(receipt).includes(app.records[1][6]));
  assert.ok(!JSON.stringify(receipt).includes(app.properties.get("GUESTBOOK_PASSWORD_KEY")));
  assert.equal(app.get({ action: "status", id: id(99) }).state, "missing");
  assert.equal(app.get({ action: "status", id: id(99) }).list, undefined);
});

test("duplicate retries create one row and cannot change its contents", () => {
  const app = backend();
  assert.equal(app.post(input()).ok, true);
  assert.equal(app.post(input()).ok, true);
  assert.equal(app.records.length, 2);
  assert.equal(app.post(input(1, { message: "changed" })).error.code, "ID_CONFLICT");
  assert.equal(app.records[1][3], input().message);
});

test("moderation keeps pending and hidden messages out of public reads", () => {
  const app = backend({ approval: true });
  app.post(input());
  assert.equal(app.get({ action: "list" }).total, 0);
  assert.deepEqual(app.get({ action: "status", id: id(1) }), { ok: true, id: id(1), entryId: id(1), action: "create", state: "pending", list: { ok: true, entries: [], total: 0, nextCursor: "" } });
  app.records[1][4] = "published";
  assert.equal(app.get({ action: "list" }).total, 1);
  app.records[1][4] = "hidden";
  assert.equal(app.get({ action: "list" }).total, 0);
  assert.equal(app.get({ action: "status", id: id(1) }).state, "hidden");
  app.post(input());
  assert.equal(app.records[1][4], "hidden");
});

test("cursor pagination stays stable through new posts and deleted rows", () => {
  const app = backend();
  for (let i = 1; i <= 12; i++) {
    app.post(input(i));
    app.records[i][1] = new Date(Date.UTC(2026, 8, i)).toISOString();
  }
  const first = app.get({ action: "list" });
  assert.deepEqual(first.entries.map((entry) => entry.id), [12, 11, 10, 9, 8].map(id));
  app.post(input(13));
  app.records[13][1] = "2026-10-01T00:00:00.000Z";
  app.records.splice(8, 1); // Delete the cursor row itself.
  const second = app.get({ action: "list", cursor: first.nextCursor });
  assert.deepEqual(second.entries.map((entry) => entry.id), [7, 6, 5, 4, 3].map(id));
  const third = app.get({ action: "list", cursor: second.nextCursor });
  assert.deepEqual(third.entries.map((entry) => entry.id), [2, 1].map(id));
  assert.equal(third.nextCursor, "");
});

test("equal timestamps are paginated without skipping or duplicating posts", () => {
  const app = backend();
  for (let i = 1; i <= 8; i++) {
    app.post(input(i));
    app.records[i][1] = "2026-09-15T00:00:00.000Z";
  }
  const first = app.get({ action: "list" });
  const second = app.get({ action: "list", cursor: first.nextCursor });
  assert.deepEqual([...first.entries, ...second.entries].map((entry) => entry.id), [8, 7, 6, 5, 4, 3, 2, 1].map(id));
});

test("server validates lengths, whitespace, control characters, IDs and spam field", () => {
  for (const overrides of [
    { name: "  " }, { name: "가".repeat(21) }, { name: "a\nb" },
    { message: "\n\t" }, { message: "가".repeat(301) }, { message: "a\u0000b" },
    { id: "bad" }, { clientId: "bad" }, { website: "https://spam.invalid" }
  ]) {
    const app = backend();
    assert.equal(app.post(input(1, overrides)).ok, false);
    assert.equal(app.records.length, 1);
  }
  const app = backend();
  assert.equal(app.post(input(1, { name: "가".repeat(20), message: "나".repeat(300) })).ok, true);
});

test("rate limit rejects another post on the same device, then allows a later one", () => {
  const app = backend();
  app.post(input());
  assert.equal(app.post(input(2, { clientId: input().clientId })).error.code, "RATE_LIMIT");
  const receipt = app.get({ action: "status", id: id(2) });
  assert.equal(receipt.state, "rejected");
  assert.equal(receipt.error.code, "RATE_LIMIT");
  app.records[1][1] = new Date(Date.now() - 31000).toISOString();
  assert.equal(app.post(input(2, { clientId: input().clientId })).ok, true);
  assert.equal(app.get({ action: "status", id: id(2) }).state, "published");
});

test("lock contention and storage failures do not report success", () => {
  const app = backend();
  app.control.lockAvailable = false;
  assert.equal(app.post(input()).error.code, "BUSY");
  assert.equal(app.get({ action: "status", id: id(1) }).state, "rejected");
  app.control.lockAvailable = true;
  app.control.failWrites = true;
  assert.equal(app.post(input(2)).error.code, "UNAVAILABLE");
  assert.equal(app.records.length, 1);
  assert.equal(app.control.releases, 2); // setup and failed write
});

test("writes extend the sheet when its allocated rows are full", () => {
  const app = backend();
  app.control.maxRows = 1;
  assert.equal(app.post(input()).ok, true);
  assert.equal(app.control.maxRows, 101);
});

test("missing configuration and damaged headers fail without exposing internals", () => {
  const missing = backend({ configured: false });
  assert.equal(missing.get({ action: "list" }).error.code, "UNAVAILABLE");
  const app = backend();
  app.records[0][2] = "changed";
  assert.equal(app.post(input()).error.code, "UNAVAILABLE");
  assert.equal(app.records.length, 1);
});

test("JSONP is read-only, validates callbacks and escapes script payloads", () => {
  const app = backend();
  assert.equal(app.get({ action: "create", ...input() }).ok, false);
  assert.equal(app.records.length, 1);
  app.post(input(1, { message: "</script>\u2028\u2029" }));
  const callback = `weddingGuestbook_${id(99)}`;
  const result = app.context.doGet({ parameter: { action: "list", callback } });
  assert.equal(result.type, "javascript");
  assert.ok(result.body.startsWith(`${callback}(`));
  assert.ok(!result.body.includes("</script>"));
  assert.ok(!result.body.includes("\u2028"));
  const invalid = app.context.doGet({ parameter: { callback: "alert(1)//" } });
  assert.equal(invalid.type, "json");
  assert.equal(JSON.parse(invalid.body).error.code, "INVALID_CALLBACK");
  assert.equal(app.get({ action: "list", cursor: "invalid" }).error.code, "INVALID_CURSOR");
});
