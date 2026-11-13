(async function () {
  const response = await fetch("./data/site.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Nie udało się pobrać data/site.json");
  const data = await response.json();
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  let lang = localStorage.getItem("gent-language") || "pl";
  const tr = value => value && typeof value === "object" ? (value[lang] ?? value.pl ?? value.en ?? "") : (value ?? "");
  const addLabel = () => lang === "en" ? "Add to cart" : "Dodaj do koszyka";
  const addedLabel = () => lang === "en" ? "Added to cart" : "Dodano do koszyka";
  const safeUrl = value => /^(https?:\/\/|mailto:|tel:|\/|#|\.{1,2}\/)/i.test(String(value||"")) ? value : "#";

  const getImageUrl = value => {
    if (!value) return "";
    const path = String(value).trim();
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return new URL(path.replace(/^\/+/, ""), new URL("./", window.location.href)).href;
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = tr(value);
  };
  const setImage = (node, src, alt) => {
    if (node && src) {
      node.src = getImageUrl(src);
      node.alt = tr(alt);
    }
  };

  document.title = data.brand?.name || "Gent Flowers";
  const logo = data.brand?.logo || "./gent-flowers-logo.png";
  $$(".brand-logo").forEach(img => {
    img.src = getImageUrl(logo);
    img.alt = data.brand?.name || "Gent Flowers";
  });

  const theme = data.theme || {};
  const root = document.documentElement;
  [
    ["--cms-page-bg", "page_background"],
    ["--cms-ink", "ink"],
    ["--cms-muted", "muted"],
    ["--cms-rose", "hero_background"],
    ["--cms-green", "green"],
    ["--cms-accent", "accent"],
    ["--cms-line", "line"]
  ].forEach(([variable, key]) => {
    if (theme[key]) root.style.setProperty(variable, theme[key]);
  });

  setText(".topline [data-i18n='delivery']", data.texts?.delivery);
  setText(".topline [data-i18n='contact']", data.texts?.contact);
  setText(".hero .eyebrow span", data.hero?.eyebrow || data.texts?.studio);
  setText(".hero h1", data.texts?.heroTitle);
  setText(".hero-copy p", data.texts?.heroText);
  setText(".hero-note", data.texts?.heroNote);

  const heroImg = $(".hero-image img");
  setImage(heroImg, data.hero?.image, data.hero?.image_alt);

  const heroBtn = $(".hero-copy .button");
  if (heroBtn) {
    heroBtn.href = safeUrl(data.hero_button?.url);
    const label = $("span:first-child", heroBtn);
    if (label) label.textContent = tr(data.hero_button?.label);
  }

  // Keep the main navigation in one canonical order on every page.
  // Match CMS entries by their meaning, not by array position, so a reordered
  // Pages CMS list cannot silently swap "Katalog" and "Kolekcje".
  const navLinks = $$(".nav .links a");
  const navAliases = {
    home: ["Start", "Home"],
    bouquets: ["Katalog", "Catalog", "Bukiety", "Bouquets"],
    collections: ["Kolekcje", "Collections"],
    about: ["O nas", "About us"]
  };
  const navFallbacks = {
    home: { label: { pl: "Start", en: "Home" }, url: "./index.html" },
    bouquets: { label: { pl: "Katalog", en: "Catalog" }, url: "./shop.html" },
    collections: { label: { pl: "Kolekcje", en: "Collections" }, url: "./index.html#collections" },
    about: { label: { pl: "O nas", en: "About us" }, url: "./about.html" }
  };
  const navItemsByKey = {};
  Object.entries(navAliases).forEach(([key, aliases], index) => {
    const item = (data.navigation || []).find(entry =>
      aliases.includes(String(entry.label?.pl || "")) ||
      aliases.includes(String(entry.label?.en || ""))
    );
    navItemsByKey[key] = item || (data.navigation || [])[index] || navFallbacks[key];
  });

  const canonicalNavUrls = {
    home: "./index.html",
    bouquets: "./shop.html",
    collections: "./index.html#collections",
    about: "./about.html"
  };
  navLinks.forEach(a => {
    const item = navItemsByKey[a.dataset.i18n];
    if (!item) return;
    a.textContent = tr(item.label);
    a.href = canonicalNavUrls[a.dataset.i18n] || safeUrl(item.url);
  });

  const collectionRoot = $(".collections");
  function renderCollections() {
    if (!collectionRoot) return;
    collectionRoot.replaceChildren();
    (data.collections || []).forEach(item => {
      const a = el("a", "collection");
      a.href = safeUrl(item.url);
      const img = el("img");
      setImage(img, item.image, item.alt);
      a.append(img);
      const title = el("span", "", tr(item.title));
      const small = el("small", "", tr(item.subtitle));
      title.append(small);
      a.append(title);
      collectionRoot.append(a);
    });
  }
  renderCollections();

  setText("#collections .section-head .eyebrow", data.texts?.findOccasion);
  setText("#collections h2", data.texts?.collectionsTitle);
  setText("#collections .section-head p", data.texts?.collectionIntro);

  const grid = $("#productGrid");

  const controls = $$(".view-button");
  const carouselControls = $("#carouselControls");
  const prev = $("#carouselPrev");
  const next = $("#carouselNext");
  const position = $("#carouselPosition");

  function updateCarousel() {
    if (!grid || !position) return;

    const cards = $$(".product", grid);
    const first = cards[0];

    if (!first) {
      position.textContent = "0 / 0";
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }

    const step = first.getBoundingClientRect().width + 18;
    const index = Math.round(grid.scrollLeft / Math.max(step, 1));

    position.textContent =
      `${Math.min(index + 1, cards.length)} / ${cards.length}`;

    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= cards.length - 1;
  }

  function productCard(item, index) {
    const article = el("article", "product");
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-haspopup", "dialog");

    const photo = el("div", "product-photo");
    const img = el("img");
    setImage(img, item.image, item.alt);
    photo.append(img);

    if (tr(item.badge)) {
      const badge = el("span", "tag", tr(item.badge));
      photo.append(badge);
    }

    const quickActions = el("div", "product-quick-actions");
    const quick = el("button", "quick", addLabel());
    quick.type = "button";
    quick.dataset.price = item.price;
    quick.dataset.label = addLabel();
    const buyNow = el("button", "buy-now", lang === "en" ? "Buy now" : "Kup teraz");
    buyNow.type = "button";
    buyNow.dataset.action = "buy-now";
    quickActions.append(quick, buyNow);
    photo.append(quickActions);
    article.append(photo);

    const info = el("div", "product-info");
    const head = el("div");
    const name = el("div", "product-name", tr(item.name));
    const sub = el("div", "product-sub", tr(item.subtitle));
    head.append(name, sub);

    const price = el("div", "price", `${item.price} ${item.currency || "zł"}`);
    const desc = el("div", "product-description", tr(item.description));
    const options = el("div", "product-options");

    const paletteHead = el("div", "palette-head", tr(data.texts?.palette));
    const swatches = el("div", "swatches");

    (item.palette || []).forEach(color => {
      const swatch = el("span", "color-swatch");
      swatch.style.setProperty("--swatch", color.hex || "#ddd");
      swatch.title = tr(color.name);
      swatch.setAttribute("aria-label", tr(color.name));
      swatches.append(swatch);
    });

    options.append(paletteHead, swatches);
    info.append(head, price, desc, options);
    article.append(info);

    article._productData = item;
    return article;
  }

  function renderProducts() {
    if (!grid) return;

    const currentView = grid.classList.contains("view-carousel")
      ? "view-carousel"
      : grid.classList.contains("view-list")
        ? "view-list"
        : "";

    grid.replaceChildren();

    (data.products || []).forEach((item, i) => {
      grid.append(productCard(item, i));
    });

    grid.classList.remove("view-list", "view-carousel");
    if (currentView) grid.classList.add(currentView);

    updateCarousel();
  }

  renderProducts();

  setText("#shop .section-head .eyebrow", data.texts?.pickedForYou);
  setText("#shop h2", data.texts?.favoriteBouquets);
  setText("#shop .section-head p", data.texts?.freshDaily);

  const storyImg = $("#story > img");
  setImage(storyImg, data.story?.image, data.story?.alt);

  setText("#story .eyebrow", data.texts?.ourStudio);
  setText("#story h2", data.texts?.storyTitle);
  setText("#story p", data.texts?.storyText);

  const storyLink = $("#story .text-link");
  if (storyLink) {
    storyLink.textContent = tr(data.texts?.meetGent);
    storyLink.href = safeUrl(data.story?.button_url);
  }

  // Page-specific content is managed from the same Pages CMS document.
  const pageKey = document.body.classList.contains("page-contacts")
    ? "contacts"
    : document.body.classList.contains("page-delivery") ? "delivery" : null;
  const pageData = pageKey ? data.pages?.[pageKey] : null;
  const pageSection = $(".page-extra");
  if (pageData && pageSection) {
    const eyebrow = $(".section-head .eyebrow", pageSection);
    const title = $("[data-page-title]", pageSection);
    const body = $("[data-page-copy]", pageSection);
    if (eyebrow) eyebrow.textContent = tr(pageData.eyebrow);
    if (title) title.textContent = tr(pageData.title);
    if (body) body.textContent = tr(pageData.body);

    if (pageKey === "contacts") {
      const links = $(".page-extra-copy p a", pageSection);
      if (links) {
        links.textContent = tr(pageData.link_label);
        links.href = pageData.email ? `mailto:${pageData.email}` : "#";
      }
      const linkWrap = links?.parentElement;
      if (linkWrap && pageData.telegram) {
        const telegram = el("a", "text-link", tr(pageData.telegram_label));
        telegram.href = safeUrl(pageData.telegram);
        telegram.target = "_blank";
        telegram.rel = "noopener noreferrer";
        linkWrap.append(el("span", "", " · "), telegram);
      }
    } else {
      const copy = $(".page-extra-copy", pageSection);
      const paragraphs = copy ? $$("p", copy) : [];
      if (paragraphs[1]) paragraphs[1].textContent = tr(pageData.secondary);
      const button = $("a.button", pageSection);
      if (button) {
        const label = $("span", button);
        if (label) label.textContent = tr(pageData.button_label);
        button.href = safeUrl(pageData.button_url);
      }
    }
  }

  setText(".footer [data-i18n='footerLine']", data.texts?.footerLine);
  setText(".footer [data-i18n='hours']", data.texts?.hours);

  const footerNav = $(".footer-pages");
  function renderFooterNavigation() {
    if (!footerNav || !Array.isArray(data.footer_navigation)) return;
    footerNav.replaceChildren();
    data.footer_navigation.forEach(item => {
      const link = el("a", "", tr(item.label));
      link.href = safeUrl(item.url);
      footerNav.append(link);
    });
  }
  renderFooterNavigation();

  const footer = $("#footer");
  const extraRoot = el("div", "cms-extra-root");

  (data.extra_blocks || []).forEach(block => {
    const section = el("section", "cms-extra-section");

    if (block.type === "text") {
      if (tr(block.title)) section.append(el("h2", "", tr(block.title)));
      if (tr(block.body)) section.append(el("p", "", tr(block.body)));
    } else if (block.type === "image") {
      if (tr(block.title)) section.append(el("h2", "", tr(block.title)));
      const image = el("img");
      setImage(image, block.image, block.alt);
      section.append(image);
    } else if (block.type === "cta") {
      if (tr(block.title)) section.append(el("h2", "", tr(block.title)));
      if (tr(block.body)) section.append(el("p", "", tr(block.body)));

      const button = el("a", "button", tr(block.button?.label));
      button.href = safeUrl(block.button?.url);
      section.append(button);
    }

    extraRoot.append(section);
  });

  if (footer) footer.before(extraRoot);

  const languageButtons = $$("[data-lang]");

  function setLanguage(next) {
    lang = next;
    document.documentElement.lang = lang;

    const fixed = {
      delivery: data.texts?.delivery,
      contact: data.texts?.contact,
      studio: data.texts?.studio,
      heroTitle: data.texts?.heroTitle,
      heroText: data.texts?.heroText,
      heroNote: data.texts?.heroNote,
      chooseBouquet: data.hero_button?.label,
      home: navItemsByKey.home?.label,
      bouquets: navItemsByKey.bouquets?.label,
      collections: navItemsByKey.collections?.label,
      about: navItemsByKey.about?.label,
      findOccasion: data.texts?.findOccasion,
      collections: data.texts?.collectionsTitle,
      collectionIntro: data.texts?.collectionIntro,
      pickedForYou: data.texts?.pickedForYou,
      favoriteBouquets: data.texts?.favoriteBouquets,
      freshDaily: data.texts?.freshDaily,
      tile: data.texts?.tile,
      list: data.texts?.list,
      carousel: data.texts?.carousel,
      ourStudio: data.texts?.ourStudio,
      storyTitle: data.texts?.storyTitle,
      storyText: data.texts?.storyText,
      meetGent: data.texts?.meetGent,
      footerLine: data.texts?.footerLine,
      hours: data.texts?.hours,
      palette: data.texts?.palette,
      productDetails: data.texts?.productDetails,
      add: addLabel(),
      buyNow: lang === "en" ? "Buy now" : "Kup teraz"
    };

    $$("[data-i18n]").forEach(node => {
      const key = node.dataset.i18n;
      if (fixed[key] !== undefined) node.textContent = tr(fixed[key]);
    });

    languageButtons.forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.lang === lang)
      );
    });

    const languageSwitch = languageButtons[0]?.closest(".language");
    if (languageSwitch) languageSwitch.classList.toggle("is-en", lang === "en");

    renderProducts();
    const modalButton = $("#modalAdd");
    if (modalButton) modalButton.textContent = addLabel();
    const modalBuyNow = $("#modalBuyNow");
    if (modalBuyNow) modalBuyNow.textContent = lang === "en" ? "Buy now" : "Kup teraz";

    localStorage.setItem("gent-language", lang);
  }

  languageButtons.forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  setLanguage(lang);

  controls.forEach(button => {
    button.addEventListener("click", () => {
      if (!grid) return;

      grid.classList.remove("view-list", "view-carousel");

      if (button.dataset.view === "list") {
        grid.classList.add("view-list");
      }

      if (button.dataset.view === "carousel") {
        grid.classList.add("view-carousel");
      }

      controls.forEach(item => {
        item.setAttribute("aria-pressed", String(item === button));
      });

      if (carouselControls) {
        carouselControls.style.display =
          button.dataset.view === "carousel" ? "flex" : "none";
      }

      grid.scrollTo({ left: 0, behavior: "smooth" });
      updateCarousel();
    });
  });

  if (prev) {
    prev.addEventListener("click", () => {
      grid.scrollBy({ left: -grid.clientWidth * 0.58, behavior: "smooth" });
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      grid.scrollBy({ left: grid.clientWidth * 0.58, behavior: "smooth" });
    });
  }

  if (grid) grid.addEventListener("scroll", updateCarousel);
  window.addEventListener("resize", updateCarousel);

  const modal = $("#productModal");
  const modalPanel = modal?.querySelector(".product-detail");
  const modalImage = $("#modalImage");
  const modalTitle = $("#modalTitle");
  const modalDesc = $("#modalDescription");
  const modalPrice = $("#modalPrice");
  const modalSwatches = $("#modalSwatches");
  const modalAddButton = $("#modalAdd");
  const modalBuyNowButton = $("#modalBuyNow");
  if (modalAddButton) modalAddButton.textContent = addLabel();
  if (modalBuyNowButton) modalBuyNowButton.textContent = lang === "en" ? "Buy now" : "Kup teraz";
  modalBuyNowButton?.addEventListener("click", () => {
    const item = activeCard?._productData;
    if (!item) return;
    if (window.GentStore?.buyNow) {
      closeProduct();
      window.GentStore.buyNow(item);
    }
  });

  let activeCard = null;

  function openProduct(card) {
    if (
      !modal ||
      !modalPanel ||
      !modalImage ||
      !modalTitle ||
      !modalDesc ||
      !modalPrice ||
      !modalSwatches
    ) return;

    activeCard = card;
    const item = card._productData || {};

    modalImage.src = getImageUrl(item.image);
    modalImage.alt = tr(item.alt);
    modalTitle.textContent = tr(item.name);
    modalDesc.textContent = tr(item.description);
    modalPrice.textContent = `${item.price} ${item.currency || "zł"}`;

    modalSwatches.replaceChildren();

    (item.palette || []).forEach((color, i) => {
      const button = el("button", "color-swatch");
      button.type = "button";
      button.style.setProperty("--swatch", color.hex || "#ddd");
      button.title = tr(color.name);
      button.setAttribute("aria-label", tr(color.name));
      button.setAttribute("aria-pressed", String(i === 0));

      button.addEventListener("click", () => {
        $$(".color-swatch", modalSwatches).forEach(x => {
          x.setAttribute("aria-pressed", String(x === button));
        });
      });

      modalSwatches.append(button);
    });

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modalPanel.focus();
  }

  function closeProduct() {
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (activeCard?.isConnected) activeCard.focus();
  }

  function addToCart() {
    const item = activeCard?._productData;
    if (!item) return;
    if (window.GentStore?.add) {
      window.GentStore.add(item);
      closeProduct();
    } else {
      console.error("Gent Flowers cart is not ready: window.GentStore.add is unavailable");
    }
  }

  if (grid) {
    grid.addEventListener("click", event => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement;

      const card = target?.closest(".product");
      if (!card) return;

      const buyNow = target.closest("[data-action=\"buy-now\"]");
      if (buyNow) {
        event.preventDefault();
        event.stopPropagation();
        if (window.GentStore?.buyNow) window.GentStore.buyNow(card._productData);
        return;
      }

      const quick = target.closest(".quick");

      if (quick) {
        event.preventDefault();
        event.stopPropagation();

        if (window.GentStore?.add) {
          window.GentStore.add(card._productData);
        } else {
          console.error("Gent Flowers cart is not ready: window.GentStore.add is unavailable");
          return;
        }

        quick.textContent = addedLabel();

        setTimeout(() => {
          quick.textContent = quick.dataset.label || addLabel();
        }, 1100);

        return;
      }

      openProduct(card);
    });

    grid.addEventListener("keydown", event => {
      const card = event.target.closest(".product");

      if (
        card &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        openProduct(card);
      }
    });
  }

  $("#modalClose")?.addEventListener("click", closeProduct);

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeProduct();
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      modal?.classList.contains("is-open")
    ) {
      closeProduct();
    }
  });

  $("#modalAdd")?.addEventListener("click", addToCart);

})().catch(error => console.error("Gent Flowers CMS:", error));
