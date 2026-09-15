const test = require("node:test");
const assert = require("node:assert/strict");
const { backend, id, input } = require("./helpers/guestbook.cjs");
const { client } = require("./helpers/guestbook-client.cjs");

const change = (request = 100, overrides = {}) => ({ ...input(1), id: id(request), entryId: id(1), revision: id(1), action: "update", name: "수정한 이름", message: "수정한 축하글", ...overrides });
const pageFor = (t, app = backend()) => {
  const page = client(app);
  t.after(page.dispose);
  return { ...page, app };
};
const ownPost = async (page) => {
  page.fill();
  await page.send();
  await page.flush();
};

test("password proofs are required, salted per entry and never exposed in public responses", () => {
  const app = backend();
  assert.equal(app.post(input(1, { passwordProof: "" })).error.code, "INVALID_PASSWORD");
  app.post(input(1));
  app.post(input(2));
  assert.notEqual(app.records[1][6], input().passwordProof);
  assert.notEqual(app.records[1][6], app.records[2][6]);
  const publicData = JSON.stringify(app.get({ action: "list" }));
  assert.ok(!publicData.includes(app.records[1][6]));
  assert.ok(!publicData.includes(app.properties.get("GUESTBOOK_PASSWORD_KEY")));
});

test("wrong passwords cannot edit or delete a message", () => {
  const app = backend();
  app.post(input());
  for (const action of ["update", "delete"]) {
    const result = app.post(change(action === "update" ? 100 : 101, { action, passwordProof: "b".repeat(64) }));
    assert.equal(result.error.code, "WRONG_PASSWORD");
    assert.equal(app.records[1][3], input().message);
    assert.equal(app.records[1][4], "published");
  }
});

test("five bad attempts lock the entry across requests until the lock expires", () => {
  const app = backend();
  app.post(input());
  for (let i = 0; i < 5; i++) app.post(change(100 + i, { passwordProof: "b".repeat(64), clientId: id(200 + i) }));
  assert.equal(app.post(change(110)).error.code, "PASSWORD_LOCKED");
  assert.equal(app.records[1][3], input().message);
  app.records[1][8] = String(Date.now() - 1);
  assert.equal(app.post(change(111)).ok, true);
  assert.equal(app.records[1][7], "0");
  assert.equal(app.records[1][8], "");
});

test("edits preserve creation time and retries cannot overwrite a newer revision", () => {
  const app = backend();
  app.post(input());
  const createdAt = app.records[1][1];
  assert.equal(app.post(change()).ok, true);
  const writes = app.control.richWrites;
  assert.equal(app.post(change()).ok, true);
  assert.equal(app.control.richWrites, writes);
  assert.equal(app.records[1][1], createdAt);
  assert.equal(app.records[1][9], id(100));
  assert.equal(app.post(change(101, { revision: id(100), message: "가장 최신 글" })).ok, true);
  assert.equal(app.post(change()).error.code, "CONFLICT");
  assert.equal(app.records[1][3], "가장 최신 글");
  assert.equal(app.get({ action: "status", id: id(101) }).action, "update");
});

test("delete clears guest content, verifies its receipt, and cannot be reversed by a stale edit", () => {
  const app = backend();
  app.post(input());
  const request = change(100, { action: "delete" });
  assert.equal(app.post(request).state, "deleted");
  assert.equal(app.post(request).state, "deleted");
  assert.equal(app.get({ action: "list" }).total, 0);
  assert.equal(app.records[1][2], "");
  assert.equal(app.records[1][3], "");
  assert.deepEqual(app.get({ action: "status", id: id(100) }), { ok: true, id: id(100), entryId: id(1), action: "delete", state: "deleted", list: { ok: true, entries: [], total: 0, nextCursor: "" } });
  assert.equal(app.post(change(101, { revision: id(100) })).error.code, "NOT_FOUND");
});

test("edits respect moderator-hidden entries and require reapproval when enabled", () => {
  const app = backend({ approval: true });
  app.post(input());
  app.records[1][4] = "published";
  assert.equal(app.post(change()).state, "pending");
  assert.equal(app.get({ action: "list" }).total, 0);
  app.records[1][4] = "hidden";
  assert.equal(app.post(change(101, { revision: id(100) })).state, "hidden");
});

test("setup rejects incomplete headers without changing existing data", () => {
  const app = backend();
  app.post(input());
  app.records[0] = app.records[0].slice(0, 6);
  const original = JSON.stringify(app.records);
  const key = app.properties.get("GUESTBOOK_PASSWORD_KEY");
  assert.throws(() => app.context.setup(), /열 이름 또는 순서/);
  assert.equal(JSON.stringify(app.records), original);
  assert.equal(app.properties.get("GUESTBOOK_PASSWORD_KEY"), key);
});

test("setup refuses to silently replace a missing key for existing password-protected posts", () => {
  const app = backend();
  app.post(input());
  app.properties.delete("GUESTBOOK_PASSWORD_KEY");
  assert.throws(() => app.context.setup(), /비밀번호 키/);
  assert.equal(app.properties.has("GUESTBOOK_PASSWORD_KEY"), false);
});

test("browser sends only a stretched proof in POST, never a password or proof in GET", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  const post = page.control.posts[0];
  assert.equal(post.password, undefined);
  assert.match(post.passwordProof, /^[a-f0-9]{64}$/);
  assert.ok(page.control.reads.every((read) => !read.password && !read.passwordProof));
  assert.equal(page.nodes.guestbookPassword.value, "");
});

test("browser edit verifies the password, updates the list, and clears its password field", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  page.openManage();
  page.nodes.guestbookEditMessage.value = "수정한 마음";
  page.nodes.guestbookManagePassword.value = "1234";
  await page.manage();
  await page.flush();
  assert.equal(page.app.records[1][3], "수정한 마음");
  assert.match(page.nodes.guestbookList.textContent, /수정한 마음/);
  assert.equal(page.nodes.guestbookManageStatus.dataset.state, "success");
  assert.equal(page.nodes.guestbookManage.hidden, true);
  assert.equal(page.nodes.guestbookManagePassword.value, "");
});

test("edit and delete update the visible list using only POST and receipt", async (t) => {
  const page = pageFor(t);
  await page.flush();
  await ownPost(page);
  const readCount = page.control.reads.length;
  page.openManage();
  page.nodes.guestbookEditMessage.value = "바로 보여야 하는 수정";
  page.nodes.guestbookManagePassword.value = "1234";
  await page.manage();
  assert.match(page.nodes.guestbookList.textContent, /바로 보여야 하는 수정/);
  page.openManage("delete");
  page.nodes.guestbookManagePassword.value = "1234";
  await page.manage();
  assert.equal(page.nodes.guestbookList.children.length, 0);
  assert.equal(page.nodes.guestbookCount.textContent, "0");
  assert.deepEqual(page.control.reads.slice(readCount).map((read) => read.action), ["status", "status"]);
  assert.equal(page.control.posts.length, 3);
});

test("overlapping writes cannot restore an older snapshot when receipts arrive out of order", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  page.app.records[1][1] = new Date(Date.now() - 31000).toISOString();
  page.control.holdStatuses = true;
  const waitForReceipts = async (count) => {
    for (let i = 0; page.control.heldStatuses.length < count && i < 300; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(page.control.heldStatuses.length, count);
  };
  page.fill("새 친구", "새 축하글");
  const creating = page.send();
  await waitForReceipts(1);
  page.openManage();
  page.nodes.guestbookEditMessage.value = "가장 최신 수정";
  page.nodes.guestbookManagePassword.value = "1234";
  const editing = page.manage();
  await waitForReceipts(2);
  page.control.heldStatuses[1]();
  await editing;
  assert.match(page.nodes.guestbookList.textContent, /가장 최신 수정/);
  page.control.heldStatuses[0]();
  await creating;
  await page.flush();
  assert.equal(page.nodes.guestbookList.children.length, 2);
  assert.match(page.nodes.guestbookList.textContent, /가장 최신 수정/);
  assert.match(page.nodes.guestbookList.textContent, /새 축하글/);
});

test("delete opens a confirmation form; cancel does not send a request", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  page.openManage("delete");
  assert.equal(page.control.posts.length, 1);
  assert.equal(page.nodes.guestbookEditFields.hidden, true);
  assert.match(page.nodes.guestbookManageDescription.textContent, /삭제할까요/);
  page.nodes.guestbookManageCancel.handlers.click();
  assert.equal(page.nodes.guestbookManage.hidden, true);
  assert.equal(page.control.posts.length, 1);
});

test("wrong password preserves the editing draft; correct password can then save", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  page.openManage();
  page.nodes.guestbookEditMessage.value = "수정 중인 글";
  page.nodes.guestbookManagePassword.value = "wrong";
  await page.manage();
  assert.equal(page.nodes.guestbookManageStatus.dataset.state, "error");
  assert.match(page.nodes.guestbookManageStatus.textContent, /비밀번호가 맞지/);
  assert.equal(page.nodes.guestbookEditMessage.value, "수정 중인 글");
  assert.equal(page.nodes.guestbookManage.hidden, false);
  page.nodes.guestbookManagePassword.value = "1234";
  await page.manage();
  assert.equal(page.nodes.guestbookManageStatus.dataset.state, "success");
});

test("uncertain deletion can be retried using the same request without false success", async (t) => {
  const page = pageFor(t);
  await ownPost(page);
  page.openManage("delete");
  page.nodes.guestbookManagePassword.value = "1234";
  page.control.dropPost = true;
  await page.manage();
  assert.equal(page.nodes.guestbookManageStatus.dataset.state, "error");
  assert.equal(page.app.records[1][4], "published");
  page.control.dropPost = false;
  page.control.losePostResponse = true;
  await page.manage();
  await page.flush();
  assert.equal(page.control.posts[1].id, page.control.posts[2].id);
  assert.equal(page.app.records[1][4], "deleted");
  assert.equal(page.nodes.guestbookList.children.length, 0);
  assert.equal(page.nodes.guestbookManageStatus.dataset.state, "success");
});
