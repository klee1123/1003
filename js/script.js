(() => {
  const data = window.WEDDING_DATA;
  if (!data) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const parseWeddingDate = () => {
    const [year, month, day] = data.wedding.date.split("-").map(Number);
    const [hour, minute] = data.wedding.time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  };

  const formatKoreanTime = (hour, minute) => {
    const period = hour < 12 ? "오전" : "오후";
    const normalizedHour = hour % 12 || 12;
    return `${period} ${normalizedHour}시${minute ? ` ${minute}분` : ""}`;
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
    $("#heroDateKorean").textContent = `${weddingDate.getFullYear()}년 ${weddingDate.getMonth() + 1}월 ${weddingDate.getDate()}일 ${weekdaysKo[weddingDate.getDay()]}요일 ${formatKoreanTime(weddingDate.getHours(), weddingDate.getMinutes())}`;
    $("#heroVenue").textContent = data.wedding.venue;
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
    $("#calendarTimeText").textContent = `${weddingDate.getFullYear()}. ${String(weddingDate.getMonth() + 1).padStart(2, "0")}. ${String(weddingDate.getDate()).padStart(2, "0")} · ${weekdaysEn[weddingDate.getDay()].slice(0, 3)} · ${weddingDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    $("#dDayNames").textContent = `${groom.displayName} ${bride.displayName}`;
    $("#dDayDate").textContent = `${weddingDate.getFullYear()}.${String(weddingDate.getMonth() + 1).padStart(2, "0")}.${String(weddingDate.getDate()).padStart(2, "0")} ${weekdaysEn[weddingDate.getDay()].slice(0, 3)} ${data.wedding.time}`;
    $("#outroMessage").innerHTML = data.copy.outro;
    $("#outroNames").textContent = `${groom.displayName} · ${bride.displayName}`;

    document.title = `${groom.name} ♥ ${bride.name} 결혼합니다.`;
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
          ${isWedding ? `<small>${data.wedding.time}</small>` : ""}
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
  const gallery = data.images.gallery;

  const galleryItem = (src, index) => `
    <button class="gallery-photo" type="button" data-gallery-index="${index}" aria-label="${index + 1}번째 사진 크게 보기">
      <img src="${src}" alt="웨딩 갤러리 사진 ${index + 1}" loading="lazy" />
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
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-gallery-index]");
      if (!button) return;
      openLightbox(Number(button.dataset.galleryIndex));
    });

    $("#lightboxClose").addEventListener("click", closeLightbox);
    $("#lightboxPrev").addEventListener("click", () => moveLightbox(-1));
    $("#lightboxNext").addEventListener("click", () => moveLightbox(1));

    let touchStartX = null;
    $("#lightbox").addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    $("#lightbox").addEventListener("touchend", (event) => {
      if (touchStartX === null) return;
      const diff = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 45) moveLightbox(diff > 0 ? -1 : 1);
      touchStartX = null;
    }, { passive: true });

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

  renderText();
  renderCalendar();
  renderDDay();
  renderGallery();
  renderAccounts();
  bindGalleryEvents();
  bindReveal();
})();
