document.documentElement.classList.add("js");

const dialog = document.querySelector(".calculation-dialog");
const forms = document.querySelectorAll(".calculation-form");
const openButtons = document.querySelectorAll("[data-open-calculation]");
const closeButton = document.querySelector("[data-close-calculation]");
const mobileMenu = document.querySelector(".mobile-menu");
const openMenuButton = document.querySelector("[data-open-menu]");
const closeMenuButton = document.querySelector("[data-close-menu]");
const blizzardCanvas = document.querySelector("#blizzard-canvas");
const cargoVisual = document.querySelector(".cargo-visual__image");
const cargoItems = document.querySelectorAll(
  ".cargo-manifest article[data-cargo-image-avif][data-cargo-image-webp]"
);
let previouslyFocusedElement = null;

const fieldRules = {
  phone: (value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 ? "" : "Укажите телефон, чтобы логист мог связаться с вами.";
  },
  origin: (value) => value.trim() ? "" : "Укажите город или регион отправления.",
  destination: (value) => value ? "" : "Выберите направление.",
  cargo_description: (value) => (
    value.trim().length >= 5 ? "" : "Кратко опишите груз."
  ),
  email: (value) => (
    !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? ""
      : "Проверьте адрес электронной почты."
  ),
  consent: (_, field) => field.checked ? "" : "Необходимо согласие на обработку данных."
};

function trackEvent(eventName, details = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...details });
  window.dispatchEvent(new CustomEvent("analytics:event", {
    detail: { event: eventName, ...details }
  }));
}

function openCalculation() {
  if (!dialog || dialog.open) return;

  previouslyFocusedElement = document.activeElement;
  if (mobileMenu?.open) mobileMenu.close();
  dialog.showModal();
  document.body.dataset.modalOpen = "true";
  dialog.querySelector(".form-status").textContent = "";
  trackEvent("hero_cta_click");

  window.requestAnimationFrame(() => {
    dialog.querySelector("#phone")?.focus();
  });
}

function closeCalculation() {
  if (!dialog?.open) return;

  dialog.close();
  previouslyFocusedElement?.focus();
}

function openMenu() {
  if (!mobileMenu || mobileMenu.open) return;

  previouslyFocusedElement = document.activeElement;
  mobileMenu.showModal();
  document.body.dataset.modalOpen = "true";
  closeMenuButton?.focus();
}

function closeMenu() {
  if (!mobileMenu?.open) return;

  mobileMenu.close();
  previouslyFocusedElement?.focus();
}

function getErrorElement(field) {
  const describedBy = field.getAttribute("aria-describedby")?.split(" ")[0];
  return describedBy ? document.getElementById(describedBy) : null;
}

function setFieldError(field, message) {
  const errorElement = getErrorElement(field);
  field.setAttribute("aria-invalid", message ? "true" : "false");
  if (errorElement) errorElement.textContent = message;
}

function validateField(field) {
  const rule = fieldRules[field.name];
  if (!rule) return true;

  const message = rule(field.value, field);
  setFieldError(field, message);
  return !message;
}

function getFocusableElements() {
  return [...dialog.querySelectorAll(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"
  )].filter((element) => element.offsetParent !== null);
}

openButtons.forEach((button) => {
  button.addEventListener("click", openCalculation);
});

closeButton?.addEventListener("click", closeCalculation);
openMenuButton?.addEventListener("click", openMenu);
closeMenuButton?.addEventListener("click", closeMenu);

mobileMenu?.querySelectorAll('nav a[href^="#"]').forEach((link) => {
  link.addEventListener("click", closeMenu);
});

mobileMenu?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeMenu();
});

mobileMenu?.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeMenu();
});

dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) closeCalculation();
});

/* Слушатель close висел только на dialog, но не на mobileMenu.
   Нативный <dialog> закрывается по Escape без участия closeMenu(),
   поэтому data-modal-open оставался на body вместе с
   overflow: hidden - после закрытия меню страница переставала
   скроллиться. Оба диалога снимают флаг в одном месте. */
[dialog, mobileMenu].forEach((element) => {
  element?.addEventListener("close", () => {
    delete document.body.dataset.modalOpen;
  });
});

dialog?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCalculation();
    return;
  }

  if (event.key !== "Tab") return;

  const focusableElements = getFocusableElements();
  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement?.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement?.focus();
  }
});

dialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCalculation();
});

forms.forEach((form) => {
  const formStatus = form.querySelector(".form-status");

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    const clearError = () => {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
      formStatus.textContent = "";
    };

    field.addEventListener("input", clearError);
    field.addEventListener("change", clearError);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fields = [...form.querySelectorAll("[name]")];
    const valid = fields.map(validateField).every(Boolean);

    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      formStatus.textContent = "Проверьте отмеченные поля.";
      return;
    }

    trackEvent("form_submit_calculation", {
      destination: form.elements.destination.value,
      form_location: form.dataset.formLocation || "dialog",
      integration_status: "not_connected"
    });

    formStatus.textContent = "Форма работает в демонстрационном режиме. Данные не отправлены.";
  });
});

document.querySelectorAll('[data-analytics="phone_click"]').forEach((link) => {
  link.addEventListener("click", () => trackEvent("phone_click"));
});

document.querySelectorAll('[data-analytics="email_click"]').forEach((link) => {
  link.addEventListener("click", () => trackEvent("email_click"));
});

if (cargoVisual) {
  let activeCargoItem = null;
  let cargoRequestId = 0;
  const cargoVisualFrame = cargoVisual.closest(".cargo-visual");
  const cargoVisualNext = cargoVisualFrame?.querySelector(".cargo-visual__image--next");
  const cargoCaption = cargoVisualFrame?.querySelectorAll("figcaption span");
  const cargoAssetCache = new Map();

  const loadCargoAsset = (item) => {
    const cachedAsset = cargoAssetCache.get(item);
    if (cachedAsset) return cachedAsset;

    const sources = [item.dataset.cargoImageAvif, item.dataset.cargoImageWebp]
      .filter(Boolean);

    const asset = new Promise((resolve, reject) => {
      const loadSource = (index) => {
        const source = sources[index];
        if (!source) {
          reject(new Error("Cargo image could not be loaded."));
          return;
        }

        const image = new Image();
        image.decoding = "async";
        image.addEventListener("load", () => resolve({ image, source }), { once: true });
        image.addEventListener("error", () => loadSource(index + 1), { once: true });
        image.src = source;
      };

      loadSource(0);
    });

    cargoAssetCache.set(item, asset);
    asset.catch(() => cargoAssetCache.delete(item));
    return asset;
  };

  const preloadCargoImages = () => {
    const preloadNext = (index) => {
      const item = cargoItems[index];
      if (!item) return;

      loadCargoAsset(item)
        .catch(() => undefined)
        .finally(() => preloadNext(index + 1));
    };

    preloadNext(0);
  };

  const cargoSection = document.querySelector("#gruzi");
  if (cargoSection && "IntersectionObserver" in window) {
    const preloadObserver = new IntersectionObserver((entries, observer) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(preloadCargoImages, { timeout: 1200 });
      } else {
        window.setTimeout(preloadCargoImages, 0);
      }
    }, { rootMargin: "1600px 0px" });

    preloadObserver.observe(cargoSection);
  } else {
    preloadCargoImages();
  }

  const updateCargoCaption = (item) => {
    if (!cargoCaption?.length) return;
    cargoCaption[0].textContent = item.dataset.cargoCaptionTitle || "";
    cargoCaption[1].textContent = item.dataset.cargoCaptionMeta || "";
  };

  cargoItems.forEach((item) => {
    const showCargoImage = () => {
      if (item === activeCargoItem) return;

      activeCargoItem = item;
      const requestId = ++cargoRequestId;
      const clearItemState = () => {
        item.classList.remove("is-loading");
        item.removeAttribute("aria-busy");
      };

      item.classList.add("is-loading");
      item.setAttribute("aria-busy", "true");
      cargoVisualFrame?.classList.add("is-loading");

      loadCargoAsset(item).then(({ source }) => {
        if (requestId !== cargoRequestId) {
          clearItemState();
          return;
        }

        updateCargoCaption(item);
        cargoItems.forEach((other) => {
          const isActive = other === item;
          other.classList.toggle("is-active", isActive);
          other.setAttribute("aria-pressed", String(isActive));
        });

        if (!cargoVisualFrame || !cargoVisualNext) {
          cargoVisual.src = source;
          cargoVisual.alt = item.dataset.cargoAlt || "";
          cargoVisualFrame?.classList.remove("is-loading");
          clearItemState();
          return;
        }

        let didFinish = false;
        let fallbackTimer = 0;
        const finishTransition = () => {
          if (didFinish) return;
          didFinish = true;
          window.clearTimeout(fallbackTimer);
          clearItemState();
          if (requestId !== cargoRequestId) return;

          cargoVisual.src = source;
          cargoVisual.alt = item.dataset.cargoAlt || "";
          cargoVisualNext.removeAttribute("src");
          cargoVisualFrame.classList.remove("is-switching");
          cargoVisualFrame.classList.remove("is-loading");
        };

        cargoVisualNext.addEventListener("animationend", finishTransition, { once: true });
        cargoVisualNext.src = source;
        cargoVisualFrame.classList.remove("is-switching");
        void cargoVisualNext.offsetWidth;
        cargoVisualFrame.classList.add("is-switching");

        if (reducedMotionQuery.matches) {
          window.requestAnimationFrame(finishTransition);
        } else {
          fallbackTimer = window.setTimeout(finishTransition, 720);
        }
      }).catch(() => {
        clearItemState();
        if (requestId !== cargoRequestId) return;
        cargoVisualFrame?.classList.remove("is-loading");
        activeCargoItem = null;
      });
    };

    item.addEventListener("pointerenter", showCargoImage);
    item.addEventListener("pointerdown", showCargoImage);
    item.addEventListener("click", showCargoImage);
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showCargoImage();
    });
  });
}

const revealElements = document.querySelectorAll("[data-reveal]");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const crackPaths = document.querySelectorAll("[data-crack-start]");
const iceGate = document.querySelector("[data-ice-gate]");
const heroSection = document.querySelector("#hero");
const iceGateCrackPaths = document.querySelectorAll("[data-ice-crack]");
let crackAnimationFrame = 0;
let iceMotionIdleTimer = 0;
let blizzardScene = null;

/* will-change держит отдельный слой в памяти видеокарты, поэтому
   подсказка живёт только пока идёт скролл. В покое класс снимается
   и 12 слоёв (пурга, луч, 10 осколков) освобождаются. */
function setIceMotionActive(active) {
  window.clearTimeout(iceMotionIdleTimer);
  iceGate?.classList.toggle("is-motion-active", active);
  document.documentElement.classList.toggle("is-ice-motion-active", active);
  if (active) {
    iceMotionIdleTimer = window.setTimeout(() => setIceMotionActive(false), 200);
  }
}

if ("IntersectionObserver" in window && !reducedMotionQuery.matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.08
  });

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(start, end, value) {
  const progress = clamp((value - start) / Math.max(0.001, end - start));
  return progress * progress * (3 - 2 * progress);
}

function readScrollMetrics() {
  const viewportHeight = window.innerHeight;

  return {
    y: window.scrollY,
    viewportHeight,
    documentHeight: document.documentElement.scrollHeight,
    heroHeight: heroSection?.offsetHeight || viewportHeight,
    compactScene: window.innerWidth <= 760,
    iceGateRect: iceGate?.getBoundingClientRect()
  };
}

function updateIceGate({ iceGateRect, viewportHeight, compactScene }) {
  if (!iceGate) return;

  if (reducedMotionQuery.matches) {
    iceGate.style.setProperty("--ice-progress", "0.72");
    iceGate.style.setProperty("--ice-break", "1");
    iceGate.style.setProperty("--ice-open", "0.38");
    iceGate.style.setProperty("--ice-release", "0.38");
    iceGate.style.setProperty("--ice-scatter", "0");
    iceGate.style.setProperty("--ice-reveal", "1");
    iceGate.style.setProperty("--ice-fragment-opacity", "0");
    iceGate.style.setProperty("--ice-fracture-opacity", "0.78");
    iceGateCrackPaths.forEach((path) => {
      path.style.strokeDashoffset = "0";
    });
    return;
  }

  const travel = Math.max(1, iceGateRect.height - viewportHeight);
  const progress = clamp(-iceGateRect.top / travel);
  /* Фазы растянуты почти на весь ход: последний осколок уходит к 0.92,
     дальше сцена сразу отлипает. Раньше всё заканчивалось к 0.8, и
     оставшийся ход зритель смотрел в неподвижный кадр. */
  const fracture = smoothstep(0.05, 0.45, progress);
  const release = compactScene
    ? smoothstep(0.42, 0.66, progress)
    : smoothstep(0.38, 0.62, progress);
  const scatter = compactScene
    ? smoothstep(0.6, 0.95, progress)
    : smoothstep(0.56, 0.92, progress);
  const opening = smoothstep(0.46, 0.82, progress);
  const fragmentOpacity = 1 - (
    compactScene
      ? smoothstep(0.72, 0.93, progress)
      : smoothstep(0.68, 0.9, progress)
  );
  const fractureFade = 1 - smoothstep(0.52, 0.76, progress);
  /* Текст входит из-под расходящейся плиты и держится до конца. */
  const reveal = smoothstep(0.6, 0.84, progress);
  const impact = fracture * (1 - opening * 0.9);

  iceGate.style.setProperty("--ice-progress", progress.toFixed(4));
  iceGate.style.setProperty("--ice-break", impact.toFixed(4));
  iceGate.style.setProperty("--ice-open", opening.toFixed(4));
  iceGate.style.setProperty("--ice-release", release.toFixed(4));
  iceGate.style.setProperty("--ice-scatter", scatter.toFixed(4));
  iceGate.style.setProperty("--ice-reveal", reveal.toFixed(4));
  iceGate.style.setProperty("--ice-fragment-opacity", fragmentOpacity.toFixed(4));
  iceGate.style.setProperty("--ice-fracture-opacity", fractureFade.toFixed(4));

  iceGateCrackPaths.forEach((path) => {
    const pathStart = Number(path.dataset.iceStart || 0);
    const pathEnd = Number(path.dataset.iceEnd || 1);
    const localProgress = smoothstep(pathStart, pathEnd, progress);
    path.style.strokeDashoffset = String(1 - localProgress);
  });
}

const siteHeader = document.querySelector(".site-header");
const headerProgress = document.querySelector(".site-header__progress");
let lastHeaderScroll = window.scrollY;

/* Состояние страницы по скроллу: подложка и показ шапки, линия
   пройденного пути, плотность пурги. Всё считается в том же
   rAF-проходе, что и ледовый рубеж - отдельный listener не нужен. */
function updateScrollState({ y, heroHeight, documentHeight, viewportHeight }) {
  if (!siteHeader) return;

  const docked = y > heroHeight * 0.6;
  const isBeyondHero = y > heroHeight * 1.05;

  document.documentElement.classList.toggle("is-beyond-hero", isBeyondHero);
  blizzardScene?.setHeroActive(!isBeyondHero);

  siteHeader.classList.toggle("site-header--docked", docked);

  const goingDown = y > lastHeaderScroll;
  const pastThreshold = y > heroHeight;
  siteHeader.classList.toggle(
    "site-header--hidden",
    goingDown && pastThreshold && !reducedMotionQuery.matches
      && !document.body.dataset.modalOpen
  );
  lastHeaderScroll = y;

  const travel = Math.max(
    1,
    documentHeight - viewportHeight
  );
  /* Переменную читает только полоска прогресса в шапке. На :root
     она гасила стиль всего документа на каждом кадре скролла. */
  headerProgress?.style.setProperty(
    "--scroll-progress",
    clamp(y / travel).toFixed(4)
  );

  /* Пурга стихает над формой: одинаковая плотность на всей странице
     в hero читается атмосферой, а поверх полей - помехой. Заодно
     совпадает с сюжетом: груз дошёл, шторм ослабевает. */
}

function updateIceFracture() {
  crackAnimationFrame = 0;
  const metrics = readScrollMetrics();
  updateScrollState(metrics);

  const { iceGateRect, viewportHeight } = metrics;
  const iceGateIsNear = iceGateRect
    && iceGateRect.bottom > -viewportHeight
    && iceGateRect.top < viewportHeight * 2;

  const iceMotionActive = Boolean(iceGateIsNear && !reducedMotionQuery.matches);
  setIceMotionActive(iceMotionActive);

  if (!iceGateIsNear) return;

  updateIceGate(metrics);
  if (!crackPaths.length) return;

  if (reducedMotionQuery.matches) {
    crackPaths.forEach((path) => {
      path.style.strokeDashoffset = "0";
    });
    return;
  }

  const iceGateEnd = metrics.y + iceGateRect.top + iceGateRect.height;
  const start = Math.max(0, iceGateEnd - viewportHeight * 0.28);
  const end = Math.max(start + 1, metrics.documentHeight - viewportHeight);
  const progress = clamp((metrics.y - start) / (end - start));

  crackPaths.forEach((path) => {
    const pathStart = Number(path.dataset.crackStart || 0);
    const pathEnd = Number(path.dataset.crackEnd || 1);
    const localProgress = clamp(
      (progress - pathStart) / Math.max(0.001, pathEnd - pathStart)
    );
    path.style.strokeDashoffset = String(1 - localProgress);
  });
}

function requestIceFractureUpdate() {
  if (crackAnimationFrame) return;
  crackAnimationFrame = window.requestAnimationFrame(updateIceFracture);
}

window.addEventListener("scroll", requestIceFractureUpdate, { passive: true });
window.addEventListener("resize", requestIceFractureUpdate, { passive: true });
reducedMotionQuery.addEventListener("change", requestIceFractureUpdate);
updateIceFracture();

/* Снег рисуется не по снежинке за раз, а дорожками: частицы с
   близкой прозрачностью и толщиной копятся в один Path2D и уходят
   одним stroke(). ~760 отдельных вызовов canvas на кадр (плюс
   столько же строк rgba в мусор) превращаются в ~50 - именно они
   и роняли слабые машины, а не блюр и не CSS-слои. */
const ALPHA_LANES = 12;
const WIDTH_LANES = 4;
const LANE_ALPHA_MAX = 0.8;
const LANE_WIDTH_MIN = 0.2;
const LANE_WIDTH_MAX = 1.25;
const LANE_STYLES = [];

for (let alphaLane = 0; alphaLane < ALPHA_LANES; alphaLane += 1) {
  for (let widthLane = 0; widthLane < WIDTH_LANES; widthLane += 1) {
    LANE_STYLES[alphaLane * WIDTH_LANES + widthLane] = {
      stroke: `rgba(201, 216, 225, ${(
        (alphaLane + 0.5) / ALPHA_LANES * LANE_ALPHA_MAX
      ).toFixed(3)})`,
      width: LANE_WIDTH_MIN + (
        (widthLane + 0.5) / WIDTH_LANES * (LANE_WIDTH_MAX - LANE_WIDTH_MIN)
      )
    };
  }
}

/* Ступени качества. Только вниз: если машина не тянет кадр, попытка
   вернуть нагрузку обратно снова его уронит - получим качели. */
const QUALITY_TIERS = [
  { particleScale: 1, pixelRatio: 1.5 },
  { particleScale: 0.6, pixelRatio: 1.25 },
  { particleScale: 0.35, pixelRatio: 1 }
];

class BlizzardScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.pointerQuery = window.matchMedia("(pointer: fine)");
    this.particles = [];
    this.lanes = new Array(ALPHA_LANES * WIDTH_LANES).fill(null);
    this.litParticles = [];
    this.litCount = 0;
    this.beam = { active: false, cosine: 1, sine: 0, length: 0 };
    this.beamLayer = document.querySelector(".ambient-beam")
      || document.documentElement;
    this.quality = 0;
    this.frameCost = 0;
    this.frameSamples = 0;
    this.resizeTimer = 0;
    this.animationFrame = 0;
    this.previousTime = 0;
    this.isVisible = !document.hidden;
    this.heroActive = true;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.publishedBeam = null;
    this.pointer = {
      x: window.innerWidth * 0.72,
      y: window.innerHeight * 0.42,
      targetX: window.innerWidth * 0.72,
      targetY: window.innerHeight * 0.42,
      originX: window.innerWidth + 120,
      originY: window.innerHeight * 0.34,
      side: 1,
      targetSide: 1,
      angle: Math.PI,
      strength: 0,
      targetStrength: 0
    };

    this.resize = this.resize.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
    this.handleMotionPreference = this.handleMotionPreference.bind(this);

    this.bindEvents();
    this.resize();
    this.start();
  }

  bindEvents() {
    window.addEventListener("resize", this.handleResize, { passive: true });
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.handlePointerLeave);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.motionQuery.addEventListener("change", this.handleMotionPreference);
    this.pointerQuery.addEventListener("change", this.handleMotionPreference);
  }

  /* resize пересобирает буфер канваса, читает layout и может создать
     сотни частиц. На мобильных он летит пачкой при каждом показе
     адресной строки - поэтому откладываем. */
  handleResize() {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(this.resize, 140);
  }

  resize() {
    const tier = QUALITY_TIERS[this.quality];

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
    this.heroHeight = document.querySelector("#hero")?.offsetHeight
      || this.height;

    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    const edgeOffset = 120;
    this.pointer.originX = this.pointer.side < 0
      ? -edgeOffset
      : this.width + edgeOffset;
    this.pointer.originY = Math.min(
      this.height * 0.74,
      Math.max(this.height * 0.14, this.pointer.originY)
    );

    const coarseMultiplier = this.pointerQuery.matches ? 1 : 0.82;
    const targetCount = Math.round(
      Math.min(760, Math.max(200, (this.width * this.height) / 1700))
      * coarseMultiplier
      * tier.particleScale
    );

    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    }

    while (this.particles.length < targetCount) {
      this.particles.push(this.initParticle({}, true));
    }

    if (this.motionQuery.matches) {
      this.drawStaticFrame();
    }
  }

  /* Заполняем существующий объект вместо создания нового: частицы
     переиспользуются каждый кадр, и throwaway-объект на каждую
     улетевшую снежинку кормил сборщик мусора без нужды. */
  initParticle(particle, initial = false) {
    const depth = Math.random() < 0.78
      ? 0.03 + Math.pow(Math.random(), 1.8) * 0.45
      : 0.48 + Math.random() * 0.52;
    const speedVariation = 0.64 + Math.random() * 0.82;
    const fineSnow = depth < 0.42 || Math.random() < 0.62;

    particle.x = initial
      ? Math.random() * this.width
      : this.width + 30 + Math.random() * 220;
    particle.y = initial
      ? Math.random() * this.height
      : -50 + Math.random() * (this.height + 60);
    particle.depth = depth;
    particle.velocityX = -(2.1 + depth * 10.6) * speedVariation;
    particle.velocityY = (0.55 + depth * 3.4) * speedVariation;
    particle.length = fineSnow
      ? 0.6 + Math.random() * 2.8 + depth * 3.8
      : 3.2 + depth * 14 + Math.random() * 8;
    particle.width = 0.2 + depth * 1.05;
    particle.alpha = 0.11 + depth * 0.54 + Math.random() * 0.12;
    particle.phase = Math.random() * Math.PI * 2;
    particle.gustPhase = Math.random() * Math.PI * 2;
    particle.flutter = 0.28 + Math.random() * 1.35;
    particle.drift = 0.45 + Math.random() * 1.2;
    particle.lane = (
      Math.min(
        ALPHA_LANES - 1,
        (particle.alpha / LANE_ALPHA_MAX * ALPHA_LANES) | 0
      ) * WIDTH_LANES
      + Math.min(
        WIDTH_LANES - 1,
        Math.max(0, (
          (particle.width - LANE_WIDTH_MIN)
          / (LANE_WIDTH_MAX - LANE_WIDTH_MIN) * WIDTH_LANES
        ) | 0)
      )
    );

    return particle;
  }

  resetParticle(particle) {
    this.initParticle(particle, false);
    if (Math.random() > 0.72) {
      particle.y = -30 - Math.random() * 100;
      particle.x = Math.random() * (this.width + 160);
    }
  }

  handlePointerMove(event) {
    if (!this.pointerQuery.matches || this.motionQuery.matches) return;

    this.pointer.targetX = event.clientX;
    this.pointer.targetY = event.clientY;
    this.pointer.targetSide = event.clientX <= this.width / 2 ? -1 : 1;
    this.pointer.targetStrength = 1;
  }

  handlePointerLeave() {
    this.pointer.targetStrength = 0;
  }

  handleVisibility() {
    this.isVisible = !document.hidden;
    if (this.isVisible) {
      this.previousTime = 0;
      this.start();
    } else {
      window.cancelAnimationFrame(this.animationFrame);
    }
  }

  handleMotionPreference() {
    window.cancelAnimationFrame(this.animationFrame);
    this.previousTime = 0;

    if (this.motionQuery.matches) {
      this.pointer.targetStrength = 0;
      this.pointer.strength = 0;
      this.drawStaticFrame();
    } else {
      this.start();
    }
  }

  setHeroActive(active) {
    if (this.heroActive === active) return;

    this.heroActive = active;

    if (active) {
      this.start();
      return;
    }

    window.cancelAnimationFrame(this.animationFrame);
    this.context.clearRect(0, 0, this.width, this.height);
    this.canvas.dataset.motion = "paused";
    this.beamLayer.style.setProperty("--beam-strength", "0");
    this.publishedBeam = null;
  }

  start() {
    if (!this.heroActive || !this.isVisible) return;

    if (this.motionQuery.matches) {
      this.drawStaticFrame();
      return;
    }

    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  updatePointer(delta) {
    const positionEase = 1 - Math.pow(0.9, delta);
    const originEase = 1 - Math.pow(0.955, delta);
    const sideEase = 1 - Math.pow(0.94, delta);
    const angleEase = 1 - Math.pow(0.94, delta);
    const strengthEase = 1 - Math.pow(0.88, delta);

    this.pointer.x += (this.pointer.targetX - this.pointer.x) * positionEase;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * positionEase;
    this.pointer.side += (
      this.pointer.targetSide - this.pointer.side
    ) * sideEase;

    const edgeOffset = 120;
    const desiredOriginX = (
      this.width / 2
      + this.pointer.side * (this.width / 2 + edgeOffset)
    );
    const desiredOriginY = Math.min(
      this.height * 0.76,
      Math.max(
        this.height * 0.12,
        this.height * 0.16 + this.pointer.y * 0.48
      )
    );

    this.pointer.originX += (
      desiredOriginX - this.pointer.originX
    ) * originEase;
    this.pointer.originY += (
      desiredOriginY - this.pointer.originY
    ) * originEase;

    const desiredAngle = Math.atan2(
      this.pointer.y - this.pointer.originY,
      this.pointer.x - this.pointer.originX
    );

    const angleDifference = Math.atan2(
      Math.sin(desiredAngle - this.pointer.angle),
      Math.cos(desiredAngle - this.pointer.angle)
    );
    this.pointer.angle += angleDifference * angleEase;

    const sideVisibility = Math.min(1, Math.abs(this.pointer.side) * 1.7);
    const desiredStrength = this.pointer.targetStrength * sideVisibility;
    this.pointer.strength += (
      desiredStrength - this.pointer.strength
    ) * strengthEase;
  }

  /* Отдаёт положение и силу луча в CSS, чтобы прожектор курсора
     подсвечивал не только пургу в hero, но и световые слои секций
     на всей странице. Пишем только при заметном изменении - иначе
     каждый кадр дёргал бы пересчёт стилей. */
  publishBeam() {
    /* В hero настоящий луч рисует canvas, и ambient-ореол только
       вымывал бы кадр. Поэтому он вступает после первого экрана:
       прожектор уходит - остаётся свет, который он оставил. */
    const handoff = smoothstep(
      this.heroHeight * 0.55,
      this.heroHeight * 1.05,
      window.scrollY
    );
    const strength = this.pointerQuery.matches && !this.motionQuery.matches
      ? this.pointer.strength * handoff
      : 0;

    /* Весь первый экран handoff равен нулю: ореол полностью
       прозрачен, и его координаты ни на что не влияют. Раньше мы
       всё равно писали их каждый кадр - а запись переменной гасит
       стиль всего поддерева и тянет за собой пересчёт. Пока луча
       не видно, молчим. */
    if (strength < 0.001 && this.publishedBeam?.strength < 0.001) return;

    const x = Math.round(this.pointer.x);
    const y = Math.round(this.pointer.y);

    if (
      this.publishedBeam
      && Math.abs(this.publishedBeam.x - x) < 6
      && Math.abs(this.publishedBeam.y - y) < 6
      && Math.abs(this.publishedBeam.strength - strength) < 0.02
    ) {
      return;
    }

    this.publishedBeam = { x, y, strength };
    /* Переменные читает только .ambient-beam, поэтому пишем их в
       сам слой. На :root они инвалидировали стиль всего документа
       ради одного элемента. */
    const target = this.beamLayer.style;
    target.setProperty("--beam-x", `${x}px`);
    target.setProperty("--beam-y", `${y}px`);
    target.setProperty("--beam-strength", strength.toFixed(3));
  }

  drawBeacon() {
    const strength = this.pointer.strength;
    if (strength < 0.01 || !this.pointerQuery.matches) return;

    const context = this.context;
    const targetDistance = Math.hypot(
      this.pointer.x - this.pointer.originX,
      this.pointer.y - this.pointer.originY
    );
    const beamLength = Math.min(
      this.width * 1.16,
      Math.max(560, targetDistance * 1.42)
    );

    context.save();
    context.globalCompositeOperation = "screen";
    context.translate(this.pointer.originX, this.pointer.originY);
    context.rotate(this.pointer.angle);

    [
      {
        center: beamLength * 0.2,
        radiusX: beamLength * 0.34,
        radiusY: beamLength * 0.13,
        opacity: 0.16
      },
      {
        center: beamLength * 0.34,
        radiusX: beamLength * 0.48,
        radiusY: beamLength * 0.075,
        opacity: 0.27
      },
      {
        center: beamLength * 0.48,
        radiusX: beamLength * 0.58,
        radiusY: beamLength * 0.19,
        opacity: 0.12
      },
      {
        center: beamLength * 0.76,
        radiusX: beamLength * 0.48,
        radiusY: beamLength * 0.25,
        opacity: 0.07
      }
    ].forEach(({ center, radiusX, radiusY, opacity }) => {
      context.save();
      context.translate(center, 0);
      context.scale(radiusX / radiusY, 1);
      context.filter = "blur(16px)";
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radiusY);
      gradient.addColorStop(0, `rgba(242, 232, 210, ${opacity * strength})`);
      gradient.addColorStop(0.34, `rgba(224, 230, 220, ${opacity * 0.72 * strength})`);
      gradient.addColorStop(0.72, `rgba(201, 219, 225, ${opacity * 0.28 * strength})`);
      gradient.addColorStop(1, "rgba(186, 209, 217, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, radiusY, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    context.filter = "blur(22px)";
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, 260);
    halo.addColorStop(0, `rgba(255, 238, 205, ${0.12 * strength})`);
    halo.addColorStop(0.34, `rgba(231, 234, 220, ${0.075 * strength})`);
    halo.addColorStop(0.68, `rgba(201, 220, 226, ${0.035 * strength})`);
    halo.addColorStop(1, "rgba(188, 211, 219, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, 260, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /* Угол и длина луча за кадр не меняются, а считались заново для
     каждой из 760 снежинок - две тригонометрии и hypot на частицу.
     Считаем один раз на кадр. */
  prepareBeam() {
    const beam = this.beam;
    beam.active = this.pointer.strength >= 0.01 && this.pointerQuery.matches;
    if (!beam.active) return;

    beam.cosine = Math.cos(this.pointer.angle);
    beam.sine = Math.sin(this.pointer.angle);
    beam.length = Math.min(
      this.width * 1.12,
      Math.max(
        540,
        Math.hypot(
          this.pointer.x - this.pointer.originX,
          this.pointer.y - this.pointer.originY
        ) * 1.38
      )
    );
  }

  getBeamLight(particle) {
    const beam = this.beam;
    if (!beam.active) return 0;

    const offsetX = particle.x - this.pointer.originX;
    const offsetY = particle.y - this.pointer.originY;
    const cosine = beam.cosine;
    const sine = beam.sine;
    const forward = offsetX * cosine + offsetY * sine;
    const sideways = Math.abs(-offsetX * sine + offsetY * cosine);
    const beamLength = beam.length;

    if (forward < -16 || forward > beamLength) return 0;

    const halfWidth = 54 + Math.max(0, forward) * 0.24;
    if (sideways > halfWidth) return 0;

    const edgeFade = 1 - sideways / halfWidth;
    const distanceFade = 1 - Math.max(0, forward) / beamLength;
    return edgeFade * distanceFade * this.pointer.strength;
  }

  drawParticles(time, delta, shouldUpdate = true) {
    const context = this.context;
    const gust = (
      1.08
      + Math.sin(time * 0.00023) * 0.3
      + Math.sin(time * 0.00067 + 1.8) * 0.2
      + Math.sin(time * 0.00117 + 4.1) * 0.1
    );

    const lanes = this.lanes;
    for (let index = 0; index < lanes.length; index += 1) {
      lanes[index] = null;
    }
    this.litCount = 0;

    context.save();
    context.globalCompositeOperation = "screen";
    context.lineCap = "round";

    this.particles.forEach((particle) => {
      if (shouldUpdate) {
        const flutter = Math.sin(time * 0.0012 * particle.flutter + particle.phase);
        const crosswind = Math.sin(
          time * 0.00074 * particle.drift + particle.gustPhase
        );
        particle.x += (
          particle.velocityX * gust
          + flutter * particle.depth * 3.2
          + crosswind * 1.1
        ) * delta;
        particle.y += (
          particle.velocityY
          + flutter * 0.5
          + crosswind * particle.depth * 0.72
        ) * delta;

        if (
          particle.x < -particle.length - 30
          || particle.y > this.height + particle.length + 30
        ) {
          this.resetParticle(particle);
        }
      }

      const streakScale = 0.72 + particle.depth * 0.94;
      const tailX = particle.x - particle.velocityX * streakScale;
      const tailY = particle.y - particle.velocityY * streakScale;
      const beamLight = this.getBeamLight(particle);

      /* Снежинки в конусе прожектора теплеют и толстеют - их
         единицы, красим индивидуально. Остальные идут в дорожки. */
      if (beamLight > 0.02) {
        this.litParticles[this.litCount] = this.litParticles[this.litCount] || {};
        const lit = this.litParticles[this.litCount];
        lit.x = particle.x;
        lit.y = particle.y;
        lit.tailX = tailX;
        lit.tailY = tailY;
        lit.alpha = Math.min(
          0.96,
          particle.alpha * (0.56 + gust * 0.36) + beamLight * 0.7
        );
        lit.light = beamLight;
        lit.width = particle.width + beamLight * 0.55;
        this.litCount += 1;
        return;
      }

      let path = lanes[particle.lane];
      if (!path) {
        path = new Path2D();
        lanes[particle.lane] = path;
      }
      path.moveTo(particle.x, particle.y);
      path.lineTo(tailX, tailY);
    });

    /* Порыв ветра общий для всех - он уходит в globalAlpha, а не в
       альфу каждой снежинки. Дорожки от этого не «прыгают». */
    context.globalAlpha = Math.min(1, 0.56 + gust * 0.36);
    for (let index = 0; index < lanes.length; index += 1) {
      const path = lanes[index];
      if (!path) continue;
      const style = LANE_STYLES[index];
      context.strokeStyle = style.stroke;
      context.lineWidth = style.width;
      context.stroke(path);
    }

    context.globalAlpha = 1;
    for (let index = 0; index < this.litCount; index += 1) {
      const lit = this.litParticles[index];
      context.beginPath();
      context.moveTo(lit.x, lit.y);
      context.lineTo(lit.tailX, lit.tailY);
      context.strokeStyle = `rgba(${201 + Math.round(lit.light * 26)}, ${
        216 + Math.round(lit.light * 14)
      }, ${225 - Math.round(lit.light * 10)}, ${lit.alpha})`;
      context.lineWidth = lit.width;
      context.stroke();
    }

    context.restore();
  }

  drawStaticFrame() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.publishBeam();
    this.prepareBeam();
    this.drawParticles(3200, 0, false);
    this.canvas.dataset.motion = "reduced";
  }

  /* Ни один список «слабых устройств» не угадает нужное железо, а
     ошибка стоит либо тормозов, либо зря урезанной картинки. Поэтому
     смотрим на реальное время кадра и снимаем нагрузку ступенями. */
  trackFrameCost(elapsed) {
    /* Выбросы - это вкладка вернулась из фона или пауза сборщика
       мусора, а не медленная машина. */
    if (elapsed > 120) return;

    this.frameSamples += 1;
    this.frameCost += (elapsed - this.frameCost) * 0.05;

    /* Первые ~1.5 с уходят на декод картинок и раскладку - судить
       по ним о железе нельзя. */
    if (this.frameSamples < 90) return;

    if (this.frameCost > 23 && this.quality < QUALITY_TIERS.length - 1) {
      this.quality += 1;
      this.frameCost = 16.67;
      this.frameSamples = 0;
      document.documentElement.dataset.blizzard = "low";
      this.resize();
    }
  }

  animate(time) {
    const isFirstFrame = !this.previousTime;
    const elapsed = isFirstFrame ? 16.67 : time - this.previousTime;
    const delta = Math.min(2.2, elapsed / 16.67);
    this.previousTime = time;

    if (!isFirstFrame) this.trackFrameCost(elapsed);

    this.context.clearRect(0, 0, this.width, this.height);
    this.updatePointer(delta);
    this.publishBeam();
    this.prepareBeam();
    this.drawBeacon();
    this.drawParticles(time, delta, true);
    this.canvas.dataset.motion = "active";

    this.animationFrame = window.requestAnimationFrame(this.animate);
  }
}

if (blizzardCanvas instanceof HTMLCanvasElement) {
  blizzardScene = new BlizzardScene(blizzardCanvas);
}
