/** Google Sheets → 확장 프로그램 → Apps Script에 붙여 넣으세요. */
const GUESTBOOK = Object.freeze({
  SHEET_NAME: "방명록",
  REQUIRE_APPROVAL: false, // true: 새 글은 pending, 시트에서 published로 바꾸면 공개
  PAGE_SIZE: 5,
  NAME_LIMIT: 20,
  MESSAGE_LIMIT: 300,
  POST_INTERVAL_MS: 30000,
  PASSWORD_ATTEMPTS: 5,
  PASSWORD_LOCK_MS: 15 * 60 * 1000
});
const HEADERS = ["글 ID", "작성 시각 (UTC)", "이름", "축하 메시지", "상태", "기기 ID", "비밀번호 검증값", "비밀번호 오류 횟수", "잠금 만료", "최근 요청 ID", "최근 작업", "최근 요청 검증값"];
const ID_PATTERN = /^[a-f0-9]{32}$/;
const PROOF_PATTERN = /^[a-f0-9]{64}$/;
const CALLBACK_PATTERN = /^weddingGuestbook_[a-f0-9]{32}$/;

/** 최초 한 번 실행하고 Google 권한을 허용합니다. 다시 실행해도 글은 유지됩니다. */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Google 시트의 확장 프로그램 → Apps Script에서 실행해 주세요.");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let sheet = spreadsheet.getSheetByName(GUESTBOOK.SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(GUESTBOOK.SHEET_NAME);
    if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    checkHeaders_(sheet);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#eee8df");
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 420);
    sheet.setColumnWidth(5, 110);
    sheet.getRange(1, 3, sheet.getMaxRows(), 2).setWrap(true);
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty("GUESTBOOK_SPREADSHEET_ID", spreadsheet.getId());
    if (!properties.getProperty("GUESTBOOK_PASSWORD_KEY")) {
      if (rows_(sheet).some(function (row) { return row[6]; })) throw new Error("기존 비밀번호 키가 없습니다. 백업한 GUESTBOOK_PASSWORD_KEY를 복원하세요.");
      properties.setProperty("GUESTBOOK_PASSWORD_KEY", Utilities.getUuid() + Utilities.getUuid());
    }
    SpreadsheetApp.flush();
    console.log("방명록 준비 완료. 웹 앱으로 배포한 뒤 /exec 주소를 js/data.js에 입력하세요.");
  } finally {
    lock.releaseLock();
  }
}

/** 공개 글 조회와 본인 요청 ID의 접수 결과만 읽습니다. GET으로는 저장하지 않습니다. */
function doGet(event) {
  const params = event && event.parameter || {};
  const callback = params.callback || "";
  if (callback && !CALLBACK_PATTERN.test(callback)) return json_({ ok: false, error: { code: "INVALID_CALLBACK", message: "잘못된 요청입니다." } });
  let result;
  try {
    if (params.action === "status") result = status_(params.id);
    else if (!params.action || params.action === "list") result = list_(params.cursor || "");
    else throw publicError_("INVALID_ACTION", "잘못된 요청입니다.");
  } catch (error) {
    result = failure_(error);
  }
  return json_(result, callback);
}

/** 응답이 opaque이므로 프런트엔드는 status 조회로 실제 저장 결과를 확인합니다. */
function doPost(event) {
  const params = event && event.parameter || {};
  try {
    if (params.action === "create") return json_(create_(validate_(params)));
    if (params.action === "update" || params.action === "delete") return json_(change_(params));
    throw publicError_("INVALID_ACTION", "잘못된 요청입니다.");
  } catch (error) {
    const result = failure_(error);
    if (ID_PATTERN.test(params.id || "")) {
      try { CacheService.getScriptCache().put("receipt:" + params.id, JSON.stringify(result.error), 600); }
      catch (cacheError) { console.error(cacheError); }
    }
    return json_(result);
  }
}

function validate_(params) {
  const name = String(params.name || "").trim();
  const message = String(params.message || "").replace(/\r\n?/g, "\n").trim();
  if (!ID_PATTERN.test(params.id || "") || !ID_PATTERN.test(params.clientId || "")) throw publicError_("INVALID_ID", "새로고침한 뒤 다시 남겨주세요.");
  if (String(params.website || "").trim()) throw publicError_("INVALID_INPUT", "저장하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
  validateProof_(params.passwordProof);
  if (!name || name.length > GUESTBOOK.NAME_LIMIT || /[\r\n\u0000-\u001f\u007f]/.test(name)) throw publicError_("INVALID_NAME", "이름은 1~20자로 입력해 주세요.");
  if (!message || message.length > GUESTBOOK.MESSAGE_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) throw publicError_("INVALID_MESSAGE", "축하 메시지는 1~300자로 입력해 주세요.");
  return { id: params.id, clientId: params.clientId, name: name, message: message, passwordProof: params.passwordProof };
}

function create_(entry) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw publicError_("BUSY", "다른 축하글을 저장 중이에요. 잠시 후 다시 남겨주세요.");
  try {
    const sheet = sheet_();
    const rows = rows_(sheet);
    const existing = rows.find(function (row) { return row[0] === entry.id; });
    if (existing) {
      if (existing[2] !== entry.name || existing[3] !== entry.message || existing[5] !== entry.clientId || existing[6] !== passwordHash_(entry.id, entry.passwordProof)) throw publicError_("ID_CONFLICT", "새로고침한 뒤 다시 남겨주세요.");
      CacheService.getScriptCache().remove("receipt:" + entry.id);
      return { ok: true, id: entry.id, state: state_(existing[4]) };
    }
    const now = Date.now();
    if (rows.some(function (row) { return row[5] === entry.clientId && now - new Date(row[1]).getTime() < GUESTBOOK.POST_INTERVAL_MS; })) throw publicError_("RATE_LIMIT", "잠시만요. 축하글은 30초 간격으로 남길 수 있어요.");
    const state = GUESTBOOK.REQUIRE_APPROVAL ? "pending" : "published";
    const values = [entry.id, new Date(now).toISOString(), entry.name, entry.message, state, entry.clientId, passwordHash_(entry.id, entry.passwordProof), "0", "", entry.id, "create", ""];
    if (sheet.getLastRow() === sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    writeRow_(sheet, sheet.getLastRow() + 1, values);
    CacheService.getScriptCache().remove("receipt:" + entry.id);
    return { ok: true, id: entry.id, state: state };
  } finally {
    lock.releaseLock();
  }
}

function validateProof_(proof) {
  if (!PROOF_PATTERN.test(proof || "")) throw publicError_("INVALID_PASSWORD", "비밀번호를 입력한 뒤 다시 시도해 주세요.");
}

function sign_(text) {
  const key = PropertiesService.getScriptProperties().getProperty("GUESTBOOK_PASSWORD_KEY");
  if (!key) throw new Error("setup을 실행해 비밀번호 키를 준비하세요.");
  return Utilities.computeHmacSha256Signature(text, key, Utilities.Charset.UTF_8).map(function (byte) { return (byte & 255).toString(16).padStart(2, "0"); }).join("");
}

function passwordHash_(id, proof) { return "v1$" + sign_("password|" + id + "|" + proof); }
function sameSecret_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function writeRow_(sheet, index, values) {
  // Rich text keeps visitor input literal, including strings starting with '='.
  const richValues = values.map(function (value) { return SpreadsheetApp.newRichTextValue().setText(String(value)).build(); });
  sheet.getRange(index, 1, 1, HEADERS.length).setRichTextValues([richValues]);
  SpreadsheetApp.flush();
}

function change_(params) {
  if (!ID_PATTERN.test(params.id || "") || !ID_PATTERN.test(params.entryId || "") || !ID_PATTERN.test(params.revision || "") || params.id === params.entryId) throw publicError_("INVALID_ID", "새로고침한 뒤 다시 시도해 주세요.");
  validateProof_(params.passwordProof);
  const edit = params.action === "update" ? validate_(params) : null;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw publicError_("BUSY", "다른 축하글을 저장 중이에요. 잠시 후 다시 시도해 주세요.");
  try {
    const sheet = sheet_();
    const rows = rows_(sheet);
    const index = rows.findIndex(function (row) { return row[0] === params.entryId; });
    if (index < 0) throw publicError_("NOT_FOUND", "글을 찾을 수 없어요. 목록을 새로고침해 주세요.");
    const row = rows[index];
    if (!row[6]) throw new Error("저장된 비밀번호 검증값이 없습니다.");
    const now = Date.now();
    if (Number(row[8]) > now) throw publicError_("PASSWORD_LOCKED", "비밀번호를 여러 번 잘못 입력했어요. 15분 후 다시 시도해 주세요.");
    if (row[8]) { row[7] = "0"; row[8] = ""; }
    if (!sameSecret_(row[6], passwordHash_(params.entryId, params.passwordProof))) {
      row[7] = String((Number(row[7]) || 0) + 1);
      if (Number(row[7]) >= GUESTBOOK.PASSWORD_ATTEMPTS) row[8] = String(now + GUESTBOOK.PASSWORD_LOCK_MS);
      writeRow_(sheet, index + 2, row);
      throw publicError_(row[8] ? "PASSWORD_LOCKED" : "WRONG_PASSWORD", row[8] ? "비밀번호를 여러 번 잘못 입력했어요. 15분 후 다시 시도해 주세요." : "비밀번호가 맞지 않아요. 다시 확인해 주세요.");
    }
    const digest = sign_(JSON.stringify([params.action, params.id, params.entryId, params.revision, edit ? edit.name : "", edit ? edit.message : "", params.passwordProof]));
    if (row[9] === params.id) {
      if (row[11] !== digest) throw publicError_("ID_CONFLICT", "요청 내용이 바뀌었어요. 목록을 새로고침해 주세요.");
    } else {
      if (row[4] === "deleted") throw publicError_("NOT_FOUND", "이미 삭제된 글이에요. 목록을 새로고침해 주세요.");
      if (params.revision !== row[9]) throw publicError_("CONFLICT", "다른 곳에서 글이 변경되었어요. 취소 후 목록을 새로고침해 다시 수정해 주세요.");
      if (params.action === "delete") {
        row[2] = "";
        row[3] = "";
        row[4] = "deleted";
      } else {
        row[2] = edit.name;
        row[3] = edit.message;
        if (row[4] === "published" && GUESTBOOK.REQUIRE_APPROVAL) row[4] = "pending";
      }
      row[7] = "0";
      row[8] = "";
      row[9] = params.id;
      row[10] = params.action;
      row[11] = digest;
      // Content and its receipt are stored together so retries cannot undo a newer edit.
      writeRow_(sheet, index + 2, row);
    }
    CacheService.getScriptCache().remove("receipt:" + params.id);
    return { ok: true, id: params.id, entryId: row[0], action: params.action, state: state_(row[4]) };
  } finally {
    lock.releaseLock();
  }
}

function list_(cursor) {
  if (cursor && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[a-f0-9]{32}$/.test(cursor)) throw publicError_("INVALID_CURSOR", "새로고침한 뒤 다시 확인해 주세요.");
  return listFromRows_(rows_(sheet_()), cursor);
}

function listFromRows_(rows, cursor) {
  const entries = rows.filter(function (row) {
    return row[4] === "published" && ID_PATTERN.test(row[0]) && row[2] && row[3] && Number.isFinite(new Date(row[1]).getTime());
  }).map(function (row) {
    return { id: row[0], createdAt: new Date(row[1]).toISOString(), name: row[2], message: row[3], revision: row[9] };
  });
  entries.sort(function (a, b) { return key_(a) < key_(b) ? 1 : key_(a) > key_(b) ? -1 : 0; });
  const remaining = cursor ? entries.filter(function (entry) { return key_(entry) < cursor; }) : entries;
  const page = remaining.slice(0, GUESTBOOK.PAGE_SIZE);
  return { ok: true, entries: page, total: entries.length, nextCursor: remaining.length > page.length ? key_(page[page.length - 1]) : "" };
}

function status_(id) {
  if (!ID_PATTERN.test(id || "")) throw publicError_("INVALID_ID", "잘못된 요청입니다.");
  const rows = rows_(sheet_());
  const row = rows.find(function (entry) { return entry[0] === id || entry[9] === id; });
  // Private text, password hashes and device identifiers are never returned.
  if (row) {
    const result = { ok: true, id: id, entryId: row[0], action: row[0] === id ? "create" : row[10], state: state_(row[4]) };
    // Reuse the same Sheets read for the receipt and refreshed public list.
    result.list = listFromRows_(rows, "");
    return result;
  }
  const error = CacheService.getScriptCache().get("receipt:" + id);
  return error ? { ok: true, id: id, state: "rejected", error: JSON.parse(error) } : { ok: true, id: id, state: "missing" };
}

function state_(value) { return value === "published" || value === "pending" || value === "deleted" ? value : "hidden"; }
function key_(entry) { return entry.createdAt + "|" + entry.id; }
function rows_(sheet) {
  const lastRow = sheet.getLastRow();
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
}
function checkHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (HEADERS.some(function (header, index) { return header !== actual[index]; })) throw new Error("방명록 시트의 열 이름 또는 순서가 변경되었습니다.");
}
function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("GUESTBOOK_SPREADSHEET_ID");
  if (!id) throw new Error("먼저 setup 함수를 실행하세요.");
  const sheet = SpreadsheetApp.openById(id).getSheetByName(GUESTBOOK.SHEET_NAME);
  if (!sheet) throw new Error("방명록 시트를 찾을 수 없습니다.");
  checkHeaders_(sheet);
  return sheet;
}
function publicError_(code, message) { const error = new Error(message); error.publicCode = code; return error; }
function failure_(error) {
  if (!error.publicCode) console.error(error);
  return { ok: false, error: { code: error.publicCode || "UNAVAILABLE", message: error.publicCode ? error.message : "방명록에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." } };
}
function json_(value, callback) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return ContentService.createTextOutput(callback ? callback + "(" + json + ");" : json).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
