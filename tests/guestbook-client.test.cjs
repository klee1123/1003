const test = require("node:test");
const assert = require("node:assert/strict");
const { backend, input } = require("./helpers/guestbook.cjs");
const { client } = require("./helpers/guestbook-client.cjs");

const setup = (t, options = {}, app = backend()) => {
  const page = client(app, options);
  t.after(page.dispose);
  return { ...page, app };
};

test("unconfigured or invalid endpoints keep the form closed and make no requests", (t) => {
  for (const endpoint of ["", "https://example.com/macros/s/id/exec", "https://script.google.com/macros/s/id/dev"]) {
    const page = setup(t, { config: { enabled: true, endpoint } });
    assert.equal(page.nodes.guestbookForm.hidden, true);
    assert.equal(page.control.reads.length, 0);
  }
  const hidden = setup(t, { config: { enabled: false } });
  assert.equal(hidden.nodes.guestbook.hidden, true);
});

test("visitor HTML is rendered as literal text and pagination loads more messages", async (t) => {
  const app = backend();
  for (let i = 1; i <= 7; i++) app.post(input(i, { message: '<img src=x onerror="alert(1)">\n축하해요' }));
  const page = setup(t, {}, app);
  await page.flush();
  assert.equal(page.nodes.guestbookList.children.length, 5);
  assert.equal(page.nodes.guestbookMore.hidden, false);
  assert.match(page.nodes.guestbookList.textContent, /<img src=x onerror="alert\(1\)">/);
  await page.nodes.guestbookMore.handlers.click();
  assert.equal(page.nodes.guestbookList.children.length, 7);
  assert.equal(page.nodes.guestbookMore.hidden, true);
});

test("the first list is requested on page entry and a response after 15 seconds still loads", async (t) => {
  const app = backend();
  app.post(input());
  const page = setup(t, { manualTimers: true, holdLists: true }, app);
  assert.deepEqual(page.control.reads.map((read) => read.action), ["list"]);
  await page.advanceTime(20000);
  assert.equal(page.nodes.guestbookListStatus.textContent, "축하글을 불러오고 있어요.");
  assert.equal(page.nodes.guestbookRefresh.disabled, true);
  page.control.heldLists[0]();
  await page.flush();
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.equal(page.nodes.guestbookListStatus.textContent, "");
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
  await page.advanceTime(10000);
  assert.equal(page.control.reads.length, 1);
});

test("an initial timeout retries once and ignores the late first response", async (t) => {
  const app = backend();
  app.post(input());
  const page = setup(t, { manualTimers: true, holdLists: true }, app);
  await page.advanceTime(30000);
  assert.match(page.nodes.guestbookListStatus.textContent, /다시 불러오고 있어요/);
  assert.doesNotMatch(page.nodes.guestbookListStatus.textContent, /새로고침/);
  assert.equal(page.nodes.guestbookRefresh.disabled, true);
  app.records[1][3] = "새로 읽은 축하글";
  page.control.holdLists = false;
  await page.advanceTime(750);
  assert.equal(page.control.reads.length, 2);
  assert.match(page.nodes.guestbookList.textContent, /새로 읽은 축하글/);
  page.control.heldLists[0]();
  await page.flush();
  assert.match(page.nodes.guestbookList.textContent, /새로 읽은 축하글/);
  assert.equal(page.nodes.guestbookListStatus.textContent, "");
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
});

test("an initial network failure recovers automatically without a page refresh", async (t) => {
  const app = backend();
  app.post(input());
  const page = setup(t, { manualTimers: true, holdLists: true }, app);
  page.control.failReads = true;
  page.control.heldLists[0]();
  await page.flush();
  assert.match(page.nodes.guestbookListStatus.textContent, /다시 불러오고 있어요/);
  page.control.failReads = false;
  page.control.holdLists = false;
  await page.advanceTime(750);
  assert.equal(page.control.reads.length, 2);
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.equal(page.nodes.guestbookListStatus.textContent, "");
});

test("persistent initial timeouts stop after two requests and leave manual refresh available", async (t) => {
  const page = setup(t, { manualTimers: true, holdLists: true });
  await page.advanceTime(45750);
  assert.equal(page.control.reads.length, 2);
  assert.match(page.nodes.guestbookListStatus.textContent, /새로고침/);
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
  await page.advanceTime(60000);
  assert.equal(page.control.reads.length, 2);
  page.control.holdLists = false;
  await page.nodes.guestbookRefresh.handlers.click();
  assert.equal(page.nodes.guestbookListStatus.textContent, "첫 번째 축하의 말을 남겨주세요.");
});

test("an initial server configuration error is shown without automatic retries", async (t) => {
  const app = backend({ configured: false });
  const page = setup(t, { manualTimers: true }, app);
  await page.flush();
  assert.match(page.nodes.guestbookListStatus.textContent, /새로고침/);
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
  await page.advanceTime(60000);
  assert.equal(page.control.reads.length, 1);
});

test("a confirmed post cancels a scheduled initial retry and keeps its fresh list", async (t) => {
  const page = setup(t, { manualTimers: true, holdLists: true });
  await page.advanceTime(30000);
  page.fill();
  await page.send();
  assert.equal(page.nodes.guestbookList.children.length, 1);
  await page.advanceTime(750);
  assert.deepEqual(page.control.reads.map((read) => read.action), ["list", "status"]);
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.equal(page.nodes.guestbookListStatus.textContent, "");
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
});

test("successful posting is confirmed through the server and refreshes the list", async (t) => {
  const page = setup(t);
  page.fill();
  assert.equal(page.nodes.guestbookCounter.textContent, "10 / 300");
  await page.send();
  await page.flush();
  assert.equal(page.app.records.length, 2);
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
  assert.equal(page.nodes.guestbookMessage.value, "");
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.equal(page.control.reads.some((read) => read.action === "status"), true);
});

test("an opaque POST without a saved receipt never produces a success message", async (t) => {
  const page = setup(t);
  page.control.dropPost = true;
  page.fill();
  await page.send();
  assert.equal(page.nodes.guestbookStatus.dataset.state, "error");
  assert.equal(page.nodes.guestbookMessage.value, "행복하게 잘 살아!");
  assert.equal(page.nodes.guestbookFields.disabled, false);
  page.control.dropPost = false;
  await page.send();
  assert.equal(page.control.posts[0].id, page.control.posts[1].id);
  assert.equal(page.app.records.length, 2);
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
});

test("a lost POST response can still be confirmed, without duplicate rows", async (t) => {
  const page = setup(t);
  page.control.losePostResponse = true;
  page.fill();
  await page.send();
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
  assert.equal(page.app.records.length, 2);
});

test("double submit sends only one POST while controls are disabled", async (t) => {
  const page = setup(t);
  page.control.holdPost = true;
  page.fill();
  const first = page.send();
  assert.equal(page.nodes.guestbookFields.disabled, true);
  await page.send();
  for (let attempt = 0; !page.control.heldPosts.length && attempt < 300; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(page.control.posts.length, 1);
  page.control.heldPosts[0]();
  await first;
  assert.equal(page.nodes.guestbookFields.disabled, false);
});

test("approval mode reports receipt without displaying the pending message", async (t) => {
  const page = setup(t, {}, backend({ approval: true }));
  page.fill();
  await page.send();
  await page.flush();
  assert.match(page.nodes.guestbookStatus.textContent, /확인 후/);
  assert.equal(page.nodes.guestbookList.children.length, 0);
  page.app.records[1][4] = "published";
  await page.nodes.guestbookRefresh.handlers.click();
  assert.equal(page.nodes.guestbookList.children.length, 1);
});

test("server rejection keeps the draft and gives its retry instruction", async (t) => {
  const page = setup(t);
  page.fill();
  await page.send();
  page.fill("친구", "한 번 더 축하해!");
  await page.send();
  assert.equal(page.nodes.guestbookStatus.dataset.state, "error");
  assert.match(page.nodes.guestbookStatus.textContent, /30초/);
  assert.equal(page.nodes.guestbookMessage.value, "한 번 더 축하해!");
  assert.equal(page.app.records.length, 2);
});

test("whitespace validation prevents writes, and blocked browser storage is optional", async (t) => {
  const page = setup(t, { blockStorage: true });
  page.fill(" ", "\n");
  await page.send();
  assert.equal(page.control.posts.length, 0);
  page.fill();
  await page.send();
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
});

test("a stale list response cannot overwrite the list bundled with a confirmed post", async (t) => {
  const page = setup(t);
  await page.flush();
  page.control.holdLists = true;
  const stale = page.nodes.guestbookRefresh.handlers.click();
  page.fill();
  await page.send();
  assert.equal(page.control.heldLists.length, 1);
  assert.equal(page.nodes.guestbookList.children.length, 1);
  page.control.heldLists[0]();
  await stale;
  assert.equal(page.nodes.guestbookList.children.length, 1);
});

test("posting after list load needs only POST and receipt, with the new entry immediately visible", async (t) => {
  const page = setup(t);
  await page.flush();
  page.fill();
  await page.send();
  assert.equal(page.control.posts.length, 1);
  assert.deepEqual(page.control.reads.map((read) => read.action), ["list", "status"]);
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.equal(page.nodes.guestbookCount.textContent, "1");
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
});

test("posting does not wait for the initial list and ignores its late response", async (t) => {
  const page = setup(t, { holdLists: true });
  page.fill();
  await page.send();
  assert.equal(page.control.posts.length, 1);
  assert.deepEqual(page.control.reads.map((read) => read.action), ["list", "status"]);
  assert.equal(page.nodes.guestbookList.children.length, 1);
  page.control.heldLists[0]();
  await page.flush();
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
  assert.equal(page.nodes.guestbookList.children.length, 1);
});

test("a malformed bundled list reports a list error without losing a confirmed save or fetching again", async (t) => {
  const app = backend();
  const doGet = app.context.doGet;
  app.context.doGet = (event) => {
    const result = JSON.parse(doGet({ parameter: { ...event.parameter, callback: "" } }).body);
    if (result.list) delete result.list.nextCursor;
    return app.context.json_(result, event.parameter.callback);
  };
  const page = setup(t, {}, app);
  await page.flush();
  page.fill();
  await page.send();
  await page.flush();
  assert.deepEqual(page.control.reads.map((read) => read.action), ["list", "status"]);
  assert.equal(page.nodes.guestbookStatus.dataset.state, "success");
  assert.equal(page.nodes.guestbookList.children.length, 0);
  assert.match(page.nodes.guestbookListStatus.textContent, /최신 목록을 표시하지 못했어요/);
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
  await page.nodes.guestbookRefresh.handlers.click();
  assert.equal(page.nodes.guestbookList.children.length, 1);
});

test("list errors preserve existing messages and expose a working refresh action", async (t) => {
  const app = backend();
  app.post(input());
  const page = setup(t, {}, app);
  await page.flush();
  page.control.failReads = true;
  await page.nodes.guestbookRefresh.handlers.click();
  assert.equal(page.nodes.guestbookList.children.length, 1);
  assert.match(page.nodes.guestbookListStatus.textContent, /새로고침/);
  assert.equal(page.nodes.guestbookRefresh.disabled, false);
  page.control.failReads = false;
  await page.nodes.guestbookRefresh.handlers.click();
  assert.equal(page.nodes.guestbookListStatus.textContent, "");
});
