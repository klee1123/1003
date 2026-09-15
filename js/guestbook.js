(() => {
  "use strict";

  const section = document.querySelector("#guestbook");
  const config = window.WEDDING_DATA?.guestbook;
  if (!section) return;
  if (config?.enabled === false) {
    section.hidden = true;
    return;
  }

  const $ = (id) => document.getElementById(id);
  const form = $("guestbookForm");
  const nameField = $("guestbookName");
  const messageField = $("guestbookMessage");
  const passwordField = $("guestbookPassword");
  const fields = $("guestbookFields");
  const submit = $("guestbookSubmit");
  const status = $("guestbookStatus");
  const list = $("guestbookList");
  const listStatus = $("guestbookListStatus");
  const more = $("guestbookMore");
  const refresh = $("guestbookRefresh");
  const manageForm = $("guestbookManage");
  const manageFields = $("guestbookManageFields");
  const editName = $("guestbookEditName");
  const editMessage = $("guestbookEditMessage");
  const managePassword = $("guestbookManagePassword");
  const manageStatus = $("guestbookManageStatus");
  let endpoint;
  try {
    endpoint = new URL(config?.endpoint || "");
    if (endpoint.origin !== "https://script.google.com" || !/^\/macros\/s\/[\w-]+\/exec$/.test(endpoint.pathname)) return;
    endpoint.search = "";
    endpoint.hash = "";
  } catch {
    return;
  }

  $("guestbookNotice").hidden = true;
  form.hidden = false;
  $("guestbookMessages").hidden = false;

  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const deviceId = () => {
    let id;
    try { id = localStorage.getItem("wedding-guestbook-device"); } catch { /* Storage is optional. */ }
    if (!/^[a-f0-9]{32}$/.test(id || "")) {
      id = randomId();
      try { localStorage.setItem("wedding-guestbook-device", id); } catch { /* Private browsers can still post. */ }
    }
    return id;
  };
  const clientId = deviceId();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deriveProof = async (password, id) => {
    if (!crypto.subtle) throw new Error("비밀번호 기능을 사용하려면 청첩장을 최신 브라우저의 HTTPS 주소로 열어주세요.");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(`wedding-guestbook:${id}`), iterations: 600000 }, key, 256);
    return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const validatePassword = (field) => {
    field.setCustomValidity(field.value.length >= 4 && field.value.length <= 32 && field.value.trim() ? "" : "비밀번호는 4~32자로 입력해 주세요.");
  };

  // Apps Script does not expose configurable CORS headers. JSONP is used only
  // for public reads; writes use POST and are verified by their unique receipt.
  const read = (parameters, timeoutMs = 15000) => new Promise((resolve, reject) => {
    const callback = `weddingGuestbook_${randomId()}`;
    const script = document.createElement("script");
    const url = new URL(endpoint.href);
    Object.entries({ ...parameters, callback, _: Date.now() }).forEach(([key, value]) => url.searchParams.set(key, value));
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      // A timed-out script can still arrive. Leave a harmless callback briefly.
      window[callback] = () => {};
      setTimeout(() => { delete window[callback]; }, 60000);
      if (error) reject(error);
      else resolve(result);
    };
    const transportError = (message) => Object.assign(new Error(message), { retryable: true });
    const timer = setTimeout(() => finish(transportError("연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.")), timeoutMs);
    window[callback] = (result) => {
      if (!result || result.ok !== true) finish(new Error(result?.error?.message || "방명록을 불러오지 못했어요."));
      else finish(null, result);
    };
    script.onerror = () => finish(transportError("방명록에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."));
    script.src = url.href;
    document.head.append(script);
  });

  let entries = [];
  let nextCursor = "";
  let listGeneration = 0;
  let listLoading = false;
  let listLoaded = false;
  const dateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const renderEntries = () => {
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "guestbook-entry";
      const head = document.createElement("div");
      head.className = "guestbook-entry__head";
      const name = document.createElement("span");
      name.className = "guestbook-entry__name";
      name.textContent = entry.name;
      const time = document.createElement("time");
      time.className = "guestbook-entry__date";
      const date = new Date(entry.createdAt);
      if (Number.isFinite(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = dateFormat.format(date);
      }
      const message = document.createElement("p");
      message.className = "guestbook-entry__message";
      message.textContent = entry.message;
      head.append(name, time);
      item.append(head, message);
      const actions = document.createElement("div");
      actions.className = "guestbook-entry__actions";
      [["update", "수정"], ["delete", "삭제"]].forEach(([action, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "guestbook-entry__action";
        button.textContent = label;
        button.setAttribute("aria-label", `${entry.name}님의 축하글 ${label}`);
        button.addEventListener("click", () => openManager(entry, action, button));
        actions.append(button);
      });
      item.append(actions);
      fragment.append(item);
    });
    list.replaceChildren(fragment);
  };

  const isListResponse = (result) => result?.ok === true && Array.isArray(result.entries) && Number.isInteger(result.total) && result.total >= 0 && typeof result.nextCursor === "string";
  const applyList = (result, reset) => {
    if (!isListResponse(result)) throw new Error("방명록을 불러오지 못했어요.");
    const seen = new Set(reset ? [] : entries.map((entry) => entry.id));
    const incoming = result.entries.filter((entry) => {
      if (!entry || typeof entry.id !== "string" || typeof entry.name !== "string" || typeof entry.message !== "string" || !Number.isFinite(new Date(entry.createdAt).getTime()) || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    entries = reset ? incoming : [...entries, ...incoming];
    nextCursor = result.nextCursor;
    renderEntries();
    listLoaded = true;
    $("guestbookCount").textContent = String(result.total);
    more.hidden = !nextCursor;
    listStatus.textContent = entries.length ? (reset ? "" : "축하글을 더 불러왔어요.") : "첫 번째 축하의 말을 남겨주세요.";
  };
  const setListLoading = (loading) => {
    listLoading = loading;
    refresh.disabled = more.disabled = loading;
    list.setAttribute("aria-busy", String(loading));
  };
  const loadList = async (reset = false) => {
    if (!reset && listLoading) return;
    const generation = ++listGeneration;
    const initialLoad = !listLoaded;
    const cursor = reset ? "" : nextCursor;
    setListLoading(true);
    listStatus.textContent = "축하글을 불러오고 있어요.";
    try {
      for (let attempt = 0; attempt < (initialLoad ? 2 : 1); attempt += 1) {
        if (generation !== listGeneration) return;
        try {
          const result = await read({ action: "list", cursor }, initialLoad && attempt === 0 ? 30000 : 15000);
          if (generation !== listGeneration) return;
          applyList(result, reset);
          return;
        } catch (error) {
          if (generation !== listGeneration) return;
          if (!initialLoad || attempt > 0 || !error.retryable) throw error;
          listStatus.textContent = "축하글을 다시 불러오고 있어요. 잠시만 기다려주세요.";
          await delay(750);
        }
      }
    } catch (error) {
      if (generation === listGeneration) listStatus.textContent = `${error.message} 새로고침을 눌러주세요.`;
    } finally {
      if (generation === listGeneration) setListLoading(false);
    }
  };
  const refreshFromReceipt = (receipt, needsRefresh) => {
    if (needsRefresh) {
      // Concurrent writes need a fresh snapshot when their receipts arrive out of order.
      void loadList(true);
      return;
    }
    ++listGeneration; // Ignore list requests started before this confirmed write.
    setListLoading(false);
    try {
      applyList(receipt.list, true);
    } catch {
      // The write is confirmed even if its list response is malformed.
      listStatus.textContent = "최신 목록을 표시하지 못했어요. 새로고침을 눌러주세요.";
    }
  };

  const updateCounter = () => { $("guestbookCounter").textContent = `${messageField.value.length} / 300`; };
  nameField.addEventListener("input", () => nameField.setCustomValidity(""));
  passwordField.addEventListener("input", () => passwordField.setCustomValidity(""));
  messageField.addEventListener("input", () => {
    messageField.setCustomValidity("");
    updateCounter();
  });
  refresh.addEventListener("click", () => loadList(true));
  more.addEventListener("click", () => loadList());

  let sending = false;
  let pending = null;
  let pendingPassword = "";
  const confirmReceipt = async (id) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt) await delay(1500 * attempt);
      try {
        const receipt = await read({ action: "status", id });
        if (["published", "pending", "hidden", "deleted", "rejected"].includes(receipt.state)) return receipt;
      } catch { /* A write may have succeeded even if its response was lost. */ }
    }
    throw new Error("등록 여부를 확인하지 못했어요.");
  };

  let completedWrites = 0;
  const sendRequest = async (payload) => {
    const previousWrites = completedWrites;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      await fetch(endpoint.href, { method: "POST", mode: "no-cors", credentials: "omit", body: new URLSearchParams(payload), signal: controller.signal });
    } catch { /* Verify actual persistence even if the response was lost. */ }
    finally { clearTimeout(timeout); }
    const receipt = await confirmReceipt(payload.id);
    const needsRefresh = previousWrites !== completedWrites;
    if (receipt.state !== "rejected") completedWrites += 1;
    return { receipt, needsRefresh };
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    nameField.setCustomValidity(nameField.value.trim() ? "" : "이름을 입력해 주세요.");
    messageField.setCustomValidity(messageField.value.trim() ? "" : "축하 메시지를 입력해 주세요.");
    validatePassword(passwordField);
    if (!form.reportValidity()) return;

    const name = nameField.value.trim();
    const message = messageField.value.replace(/\r\n?/g, "\n").trim();
    // Retry an uncertain write using the same ID, so it cannot create two rows.
    if (!pending || pending.name !== name || pending.message !== message || pendingPassword !== passwordField.value) {
      pending = { id: randomId(), name, message };
      pendingPassword = passwordField.value;
    }
    sending = true;
    fields.disabled = true;
    form.setAttribute("aria-busy", "true");
    submit.textContent = "마음을 전하고 있어요…";
    status.dataset.state = "loading";
    status.textContent = "축하글을 저장하고 있어요. 잠시만 기다려주세요.";

    let attempted = false;
    try {
      const passwordProof = await deriveProof(pendingPassword, pending.id);
      attempted = true;
      const { receipt, needsRefresh } = await sendRequest({ action: "create", ...pending, passwordProof, clientId, website: $("guestbookWebsite").value });
      if (receipt.state === "rejected") {
        pending = null;
        pendingPassword = "";
        throw new Error(receipt.error?.message || "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      pending = null;
      pendingPassword = "";
      form.reset();
      updateCounter();
      status.dataset.state = "success";
      status.textContent = receipt.state === "pending"
        ? "따뜻한 마음 감사합니다. 확인 후 방명록에 소개할게요."
        : receipt.state === "hidden" || receipt.state === "deleted"
          ? "이미 접수된 축하글입니다. 따뜻한 마음 감사합니다."
          : "축하글을 남겼어요. 따뜻한 마음 감사합니다.";
      refreshFromReceipt(receipt, needsRefresh);
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = pending && attempted
        ? "등록 여부를 확인하지 못했어요. 입력한 내용은 그대로 두고 잠시 후 다시 눌러주세요."
        : error.message;
    } finally {
      sending = false;
      fields.disabled = false;
      form.setAttribute("aria-busy", "false");
      submit.textContent = "축하글 남기기";
    }
  });

  let management = null;
  let managing = false;
  let pendingChange = null;
  let returnFocus = null;
  const closeManager = () => {
    if (managing) return;
    management = null;
    pendingChange = null;
    manageForm.reset();
    manageForm.hidden = true;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else refresh.focus({ preventScroll: true });
  };
  const openManager = (entry, action, trigger) => {
    if (managing) return;
    manageForm.reset();
    management = { entry, action };
    pendingChange = null;
    returnFocus = trigger;
    manageForm.dataset.action = action;
    manageForm.hidden = false;
    manageStatus.textContent = "";
    $("guestbookManageTitle").textContent = action === "update" ? "축하글 수정" : "축하글 삭제";
    $("guestbookManageDescription").textContent = action === "update" ? `${entry.name}님의 축하글을 수정합니다.` : `${entry.name}님의 축하글을 삭제할까요? 삭제하면 목록에서 사라집니다.`;
    $("guestbookManageSubmit").textContent = action === "update" ? "수정하기" : "삭제하기";
    $("guestbookEditFields").hidden = action === "delete";
    editName.disabled = editMessage.disabled = action === "delete";
    editName.value = entry.name;
    editMessage.value = entry.message;
    [editName, editMessage, managePassword].forEach((field) => field.setCustomValidity(""));
    (action === "update" ? editName : managePassword).focus();
  };
  $("guestbookManageCancel").addEventListener("click", () => {
    closeManager();
    manageStatus.textContent = "";
  });
  [editName, editMessage, managePassword].forEach((field) => field.addEventListener("input", () => field.setCustomValidity("")));
  manageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (managing || !management) return;
    validatePassword(managePassword);
    if (management.action === "update") {
      editName.setCustomValidity(editName.value.trim() ? "" : "이름을 입력해 주세요.");
      editMessage.setCustomValidity(editMessage.value.trim() ? "" : "축하 메시지를 입력해 주세요.");
    }
    if (!manageForm.reportValidity()) return;
    managing = true;
    manageFields.disabled = true;
    manageForm.setAttribute("aria-busy", "true");
    const { entry, action } = management;
    const name = editName.value.trim();
    const message = editMessage.value.replace(/\r\n?/g, "\n").trim();
    const password = managePassword.value;
    manageStatus.dataset.state = "loading";
    manageStatus.textContent = action === "update" ? "축하글을 수정하고 있어요." : "축하글을 삭제하고 있어요.";
    $("guestbookManageSubmit").textContent = action === "update" ? "수정 중…" : "삭제 중…";
    let attempted = false;
    try {
      const passwordProof = await deriveProof(password, entry.id);
      if (!pendingChange || pendingChange.name !== name || pendingChange.message !== message || pendingChange.passwordProof !== passwordProof) {
        pendingChange = { id: randomId(), action, entryId: entry.id, revision: entry.revision, name, message, passwordProof, clientId };
      }
      attempted = true;
      const { receipt, needsRefresh } = await sendRequest(pendingChange);
      if (receipt.state === "rejected") {
        pendingChange = null;
        throw new Error(receipt.error?.message || "변경하지 못했어요. 다시 시도해 주세요.");
      }
      if (receipt.entryId !== entry.id || receipt.action !== action || (action === "delete" && receipt.state !== "deleted")) throw new Error("변경 여부를 확인하지 못했어요.");
      managing = false;
      closeManager();
      manageStatus.dataset.state = "success";
      manageStatus.textContent = action === "delete" ? "축하글을 삭제했어요." : receipt.state === "pending" ? "수정한 축하글은 확인 후 다시 소개할게요." : "축하글을 수정했어요.";
      // Remove stale content immediately; a failed refresh must not show deleted text.
      entries = entries.filter((item) => item.id !== entry.id);
      renderEntries();
      refresh.focus({ preventScroll: true });
      refreshFromReceipt(receipt, needsRefresh);
    } catch (error) {
      manageStatus.dataset.state = "error";
      manageStatus.textContent = pendingChange && attempted ? "변경 여부를 확인하지 못했어요. 입력한 내용은 그대로 두고 잠시 후 다시 눌러주세요." : error.message;
    } finally {
      managing = false;
      manageFields.disabled = false;
      manageForm.setAttribute("aria-busy", "false");
      $("guestbookManageSubmit").textContent = action === "update" ? "수정하기" : "삭제하기";
    }
  });

  // Fetch once on page entry so the first response can arrive before scrolling here.
  void loadList(true);
})();
