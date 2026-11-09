(() => {
  const grid = document.querySelector("#productGrid");
  const modal = document.querySelector("#productModal");

  if (!grid || !modal) {
    console.error("Gent Flowers: не найдена сетка товаров или модальное окно");
    return;
  }

  const panel = modal.querySelector(".product-detail");
  const image = document.querySelector("#modalImage");
  const title = document.querySelector("#modalTitle");
  const description = document.querySelector("#modalDescription");
  const price = document.querySelector("#modalPrice");
  const swatches = document.querySelector("#modalSwatches");
  const count = document.querySelector("#count");

  let activeCard = null;
  let cartCount = Number(count?.textContent) || 0;

  function openProduct(card) {
    activeCard = card;

    const img = card.querySelector(".product-photo img");
    const name = card.querySelector(".product-name");
    const desc = card.querySelector(".product-description");
    const cost = card.querySelector(".price");

    image.src = img?.src || "";
    image.alt = img?.alt || "";
    title.textContent = name?.textContent.trim() || "";
    description.textContent = desc?.textContent.trim() || "";
    price.textContent = cost?.textContent.trim() || "";

    swatches.replaceChildren();

    card.querySelectorAll(".color-swatch").forEach((color, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-swatch";
      button.style.setProperty(
        "--swatch",
        getComputedStyle(color).getPropertyValue("--swatch")
      );
      button.setAttribute("aria-label", color.getAttribute("aria-label") || color.title || "Цвет");
      button.setAttribute("aria-pressed", String(index === 0));

      button.addEventListener("click", () => {
        swatches.querySelectorAll(".color-swatch").forEach(item => {
          item.setAttribute("aria-pressed", String(item === button));
        });
      });

      swatches.append(button);
    });

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    panel?.focus();
  }

  function closeProduct() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (activeCard?.isConnected) activeCard.focus();
  }

  // Открытие карточки независимо от обработчиков CMS
  grid.addEventListener("click", event => {
    const target = event.target;
    const card = target.closest(".product");

    if (!card || target.closest(".quick")) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openProduct(card);
  }, true);

  // Поддержка клавиатуры
  grid.addEventListener("keydown", event => {
    const card = event.target.closest(".product");

    if (!card || event.target !== card) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProduct(card);
    }
  }, true);

  document.querySelector("#modalClose")?.addEventListener("click", closeProduct);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeProduct();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeProduct();
    }
  });

  document.querySelector("#modalAdd")?.addEventListener("click", () => {
    cartCount++;
    if (count) count.textContent = cartCount;
    closeProduct();
  });

  grid.querySelectorAll(".product").forEach(card => {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
  });

  console.log("Gent Flowers: product modal fix loaded");
})();
