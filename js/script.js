(() => {
  const data = window.WEDDING_DATA;
  if (!data) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const setupHeroSize = () => {
    const hero = $(".hero");
    const touchViewport = window.matchMedia("(pointer: coarse)");
    let viewportWidth = 0;

    const updateSize = () => {
      const width = document.documentElement.clientWidth;
      // In-app toolbars can resize even svh. Keep the initial mobile crop until rotation/width changes.
      if (width === viewportWidth && touchViewport.matches) return;
      viewportWidth = width;
      hero.style.height = `${window.innerHeight}px`;
    };

    updateSize();
    window.addEventListener("resize", updateSize);
  };

  const parseWeddingDate = () => {
    const [year, month, day] = data.wedding.date.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const renderText = () => {
    const { groom, bride } = data.couple;
    const weddingDate = parseWeddingDate();
    const weekdaysKo = ["일", "월", "화", "수", "목", "금", "토"];
    const weekdaysEn = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const monthsEn = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    $("#heroImage").src = data.images.hero;
    $("#groomName").textContent = groom.name;
    $("#brideName").textContent = bride.name;
    $("#groomEnglish").textContent = groom.english;
    $("#brideEnglish").textContent = bride.english;
    $("#heroWeekday").textContent = weekdaysEn[weddingDate.getDay()];
    $("#heroDateEnglish").textContent = `${monthsEn[weddingDate.getMonth()]} ${String(weddingDate.getDate()).padStart(2, "0")} ${weddingDate.getFullYear()}`;
    $("#heroDateKorean").textContent = `${weddingDate.getFullYear()}년 ${weddingDate.getMonth() + 1}월 ${weddingDate.getDate()}일 ${weekdaysKo[weddingDate.getDay()]}요일`;
    $("#heroDaymark").textContent = `${String(weddingDate.getMonth() + 1).padStart(2, "0")}.${String(weddingDate.getDate()).padStart(2, "0")}`;

    $("#invitationMessage").innerHTML = data.copy.invitation.map((line) => `<p>${line}</p>`).join("");

    $("#groomFather").textContent = groom.father;
    $("#groomMother").textContent = groom.mother;
    $("#groomRelation").textContent = groom.relation;
    $("#groomFullName").textContent = groom.name;
    $("#brideFather").textContent = bride.father;
    $("#brideMother").textContent = bride.mother;
    $("#brideRelation").textContent = bride.relation;
    $("#brideFullName").textContent = bride.name;

    $("#calendar-title").textContent = `${weddingDate.getMonth() + 1}월의 ${weddingDate.getDate()}번째 날.`;
    $("#calendarTimeText").textContent = `${weddingDate.getFullYear()}. ${String(weddingDate.getMonth() + 1).padStart(2, "0")}. ${String(weddingDate.getDate()).padStart(2, "0")} · ${weekdaysEn[weddingDate.getDay()].slice(0, 3)}`;
    $("#dDayDate").textContent = `${weddingDate.getFullYear()}.${String(weddingDate.getMonth() + 1).padStart(2, "0")}.${String(weddingDate.getDate()).padStart(2, "0")} ${weekdaysEn[weddingDate.getDay()].slice(0, 3)}`;
    $("#outroMessage").innerHTML = data.copy.outro;
    $("#outroNames").textContent = `${groom.displayName} · ${bride.displayName}`;

    document.title = `${groom.name} ✦ ${bride.name}, 결혼합니다`;
  };

  const renderCalendar = () => {
    const weddingDate = parseWeddingDate();
    const year = weddingDate.getFullYear();
    const month = weddingDate.getMonth();
    const weddingDay = weddingDate.getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const wrap = $("#calendarDays");

    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push('<span class="calendar__day calendar__day--empty" aria-hidden="true"></span>');
    for (let day = 1; day <= lastDate; day += 1) {
      const current = new Date(year, month, day);
      const weekendClass = current.getDay() === 0 ? " calendar__day--sun" : current.getDay() === 6 ? " calendar__day--sat" : "";
      const isWedding = day === weddingDay;
      cells.push(`
        <span class="calendar__day${weekendClass}${isWedding ? " calendar__day--wedding" : ""}">
          <span>${day}</span>
        </span>
      `);
    }
    wrap.innerHTML = cells.join("");
  };

  const renderDDay = () => {
    const weddingDate = parseWeddingDate();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weddingStart = new Date(weddingDate.getFullYear(), weddingDate.getMonth(), weddingDate.getDate());
    const difference = Math.ceil((weddingStart - todayStart) / 86400000);
    const target = $("#dDayNumber");

    if (difference > 0) target.textContent = `D-${difference}`;
    else if (difference === 0) target.textContent = "D-DAY";
    else target.textContent = `D+${Math.abs(difference)}`;
  };

  let activeIndex = 0;
  const gallery = document.documentElement.classList.contains("show-gift")
    ? data.images.gallery.slice(0, 6)
    : data.images.gallery;

  const galleryItem = (src, index) => `
    <button class="gallery-photo" type="button" data-gallery-index="${index}" aria-label="${index + 1}번째 사진 크게 보기">
      <img src="${src}" alt="웨딩 갤러리 사진 ${index + 1}" loading="lazy" draggable="false" />
    </button>
  `;

  const renderGallery = () => {
    $("#galleryGrid").innerHTML = gallery.map((src, index) => galleryItem(src, index)).join("");
    $("#galleryCount").textContent = `${String(gallery.length).padStart(2, "0")} PHOTOS`;
  };

  const updateLightbox = () => {
    $("#lightboxImage").src = gallery[activeIndex];
    $("#lightboxImage").alt = `웨딩 갤러리 사진 ${activeIndex + 1}`;
    $("#lightboxCounter").textContent = `${activeIndex + 1} / ${gallery.length}`;
  };

  const openLightbox = (index) => {
    activeIndex = index;
    updateLightbox();
    const lightbox = $("#lightbox");
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeLightbox = () => {
    const lightbox = $("#lightbox");
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const moveLightbox = (direction) => {
    activeIndex = (activeIndex + direction + gallery.length) % gallery.length;
    updateLightbox();
  };

  const bindGalleryEvents = () => {
    document.addEventListener("contextmenu", (event) => {
      if (event.target instanceof Element && event.target.closest("img, .gallery-photo, .lightbox__media")) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener("dragstart", (event) => {
      if (event.target instanceof Element && event.target.closest("img, .gallery-photo, .lightbox__media")) {
        event.preventDefault();
      }
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-gallery-index]");
      if (!button) return;
      openLightbox(Number(button.dataset.galleryIndex));
    });

    $("#lightboxClose").addEventListener("click", closeLightbox);
    $("#lightboxPrev").addEventListener("click", () => moveLightbox(-1));
    $("#lightboxNext").addEventListener("click", () => moveLightbox(1));

    const lightbox = $("#lightbox");
    let swipeStart = null;
    const isPageZoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;
    const cancelSwipe = () => { swipeStart = null; };

    // 확대는 브라우저에 맡기고, 기본 배율의 한 손가락 동작만 사진 넘기기로 처리합니다.
    lightbox.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 1 || isPageZoomed() || event.target.closest("button")) {
        cancelSwipe();
        return;
      }

      const touch = event.touches[0];
      swipeStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    lightbox.addEventListener("touchmove", (event) => {
      if (event.touches.length !== 1 || isPageZoomed()) cancelSwipe();
    }, { passive: true });

    lightbox.addEventListener("touchend", (event) => {
      const start = swipeStart;
      cancelSwipe();
      if (!start || event.touches.length !== 0 || isPageZoomed() || !lightbox.classList.contains("is-open")) return;

      const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
      if (!touch) return;
      const diffX = touch.clientX - start.x;
      const diffY = touch.clientY - start.y;

      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
        moveLightbox(diffX > 0 ? -1 : 1);
      }
    }, { passive: true });

    lightbox.addEventListener("touchcancel", cancelSwipe, { passive: true });
    window.visualViewport?.addEventListener("resize", cancelSwipe);

    document.addEventListener("keydown", (event) => {
      if (!$("#lightbox").classList.contains("is-open")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    });
  };

  const copyAccountNumber = async (number) => {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(number);
        return;
      } catch {
        // 일부 모바일 브라우저에서는 기존 복사 방식을 사용합니다.
      }
    }
    const previousFocus = document.activeElement;
    const field = document.createElement("textarea");
    field.value = number;
    field.readOnly = true;
    field.className = "account-copy-field";
    document.body.append(field);
    try {
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, number.length);
      if (!document.execCommand("copy")) throw new Error("Copy failed");
    } finally {
      field.remove();
      previousFocus?.focus({ preventScroll: true });
    }
  };

  const renderAccounts = () => {
    if (!document.documentElement.classList.contains("show-gift")) {
      $("#accounts").remove();
      return;
    }
    const groups = $("#accountGroups");
    const status = $("#accountStatus");
    let statusTimer;
    const announce = (message) => {
      clearTimeout(statusTimer);
      status.textContent = "";
      statusTimer = setTimeout(() => { status.textContent = message; }, 50);
    };

    const textElement = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    };

    [["groom", "신랑 측"], ["bride", "신부 측"]].forEach(([side, title]) => {
      const group = document.createElement("details");
      group.className = "account-group";
      group.append(textElement("summary", "account-group__summary", title));
      const list = document.createElement("ul");
      list.className = "account-list";
      const accounts = (data.accounts?.[side] || []).filter((account) =>
        [account.bank, account.number, account.holder].every((value) => typeof value === "string" && value.trim())
      );

      accounts.forEach((account) => {
        const row = document.createElement("li");
        row.className = "account-row";
        const info = document.createElement("div");
        info.className = "account-row__info";
        info.append(
          textElement("p", "account-row__label", account.label || title),
          textElement("p", "account-row__holder", `${account.bank.trim()} · ${account.holder.trim()}`),
          textElement("p", "account-row__number", account.number.trim())
        );
        const button = textElement("button", "account-row__copy", "복사");
        button.type = "button";
        button.setAttribute("aria-label", `${account.label || title} ${account.holder.trim()} 계좌번호 복사`);
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await copyAccountNumber(account.number.trim());
            announce(`${account.holder.trim()} 님의 계좌번호가 복사되었습니다.`);
          } catch {
            announce("복사하지 못했습니다. 계좌번호를 길게 눌러 직접 복사해 주세요.");
          } finally {
            button.disabled = false;
          }
        });
        row.append(info, button);
        list.append(row);
      });

      if (accounts.length) group.append(list);
      else group.append(textElement("p", "account-group__empty", "계좌정보를 준비 중입니다."));
      groups.append(group);
    });
  };

  const setupContacts = () => {
    const sheet = $("#contactSheet");
    const trigger = $("#contactOpen");
    const backdrop = $("#contactBackdrop");
    const title = $("#contactTitle");
    const invitation = $(".invitation");
    const groups = $("#contactGroups");
    let hasMissingNumber = false;

    const textElement = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    };

    [["groom", "신랑 측"], ["bride", "신부 측"]].forEach(([side, title]) => {
      const group = document.createElement("section");
      group.className = "contact-group";
      const heading = textElement("h3", "contact-group__title", title);
      heading.id = `contact-${side}-title`;
      group.setAttribute("aria-labelledby", heading.id);
      const list = document.createElement("ul");
      list.className = "contact-list";

      [["father", "아버지"], ["mother", "어머니"]].forEach(([relation, label]) => {
        const name = data.couple[side][relation];
        const rawNumber = data.contacts?.[side]?.[relation];
        const number = typeof rawNumber === "string" ? rawNumber.replace(/[\s()-]/g, "") : "";
        const hasNumber = /^\+?\d{8,15}$/.test(number);
        if (!hasNumber) hasMissingNumber = true;

        const row = document.createElement("li");
        row.className = "contact-row";
        const info = document.createElement("div");
        info.className = "contact-row__info";
        info.append(
          textElement("p", "contact-row__relation", label),
          textElement("p", "contact-row__name", name)
        );
        const actions = document.createElement("div");
        actions.className = "contact-row__actions";
        [["tel", "전화"], ["sms", "문자"]].forEach(([scheme, action]) => {
          const link = textElement(hasNumber ? "a" : "button", "contact-row__action", action);
          link.setAttribute("aria-label", `${title} ${label} ${name} 님께 ${action}${hasNumber ? "하기" : " (연락처 준비 중)"}`);
          if (hasNumber) link.href = `${scheme}:${number}`;
          else {
            link.type = "button";
            link.disabled = true;
          }
          actions.append(link);
        });
        row.append(info, actions);
        list.append(row);
      });
      group.append(heading, list);
      groups.append(group);
    });
    $("#contactNotice").hidden = !hasMissingNumber;

    let scrollPosition = { x: 0, y: 0 };
    let isOpen = false;
    let useFallback = false;
    let previousAriaHidden = null;
    let previousInert = false;

    const restorePage = () => {
      if (!isOpen) return;
      isOpen = false;
      backdrop.hidden = true;
      if (useFallback) {
        if (previousAriaHidden === null) invitation.removeAttribute("aria-hidden");
        else invitation.setAttribute("aria-hidden", previousAriaHidden);
        if (!previousInert) invitation.removeAttribute("inert");
      }
      document.body.classList.remove("contact-open");
      document.body.style.removeProperty("--contact-scroll-top");
      // Older WebViews may not accept the scrollTo options object.
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(scrollPosition.x, scrollPosition.y);
      trigger.focus({ preventScroll: true });
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    };

    const closeContacts = () => {
      if (!isOpen) return;
      if (useFallback) {
        sheet.removeAttribute("open");
        restorePage();
      } else {
        sheet.close();
      }
    };

    trigger.addEventListener("click", () => {
      if (isOpen) return;
      scrollPosition = { x: window.scrollX, y: window.scrollY };
      document.body.style.setProperty("--contact-scroll-top", `-${scrollPosition.y}px`);
      document.body.classList.add("contact-open");
      isOpen = true;
      useFallback = true;
      if (typeof sheet.showModal === "function" && typeof sheet.close === "function") {
        try {
          sheet.showModal();
          useFallback = !sheet.hasAttribute("open");
        } catch {
          // Keep contacts usable when the embedded browser cannot show a native dialog.
        }
      }
      if (useFallback) {
        sheet.setAttribute("open", "");
        backdrop.hidden = false;
        previousAriaHidden = invitation.getAttribute("aria-hidden");
        previousInert = invitation.hasAttribute("inert");
        title.focus({ preventScroll: true });
        invitation.setAttribute("aria-hidden", "true");
        invitation.setAttribute("inert", "");
      } else {
        title.focus({ preventScroll: true });
      }
    });
    $("#contactClose").addEventListener("click", closeContacts);
    backdrop.addEventListener("click", closeContacts);
    sheet.addEventListener("close", restorePage);

    document.addEventListener("keydown", (event) => {
      if (!isOpen || !useFallback) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeContacts();
      } else if (event.key === "Tab") {
        const controls = $$("button:not([disabled]), a[href]", sheet);
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !controls.includes(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !controls.includes(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    document.addEventListener("focusin", (event) => {
      if (isOpen && useFallback && !sheet.contains(event.target)) title.focus({ preventScroll: true });
    });

    const isOutsideSheet = (event) => {
      const bounds = sheet.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    let startedOutside = false;
    sheet.addEventListener("pointerdown", (event) => { startedOutside = event.target === sheet && isOutsideSheet(event); });
    sheet.addEventListener("click", (event) => {
      if (startedOutside && event.target === sheet && isOutsideSheet(event)) closeContacts();
      startedOutside = false;
    });
  };

  const bindReveal = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      $$(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    $$(".reveal").forEach((el) => observer.observe(el));
  };

  setupHeroSize();
  renderText();
  renderCalendar();
  renderDDay();
  renderGallery();
  renderAccounts();
  setupContacts();
  bindGalleryEvents();
  bindReveal();
})();
