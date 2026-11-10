(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const KEY = "gent-cart-v1";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cart = []; }
  const lang = () => localStorage.getItem("gent-language") || document.documentElement.lang || "pl";
  const text = (pl, en) => lang() === "en" ? en : pl;
  const money = n => `${Number(n || 0).toLocaleString(lang() === "pl" ? "pl-PL" : "en-GB")} zł`;
  const normalize = s => String(s || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/ß/g, "ss");
  const getData = card => card?._productData || null;
  const productId = p => String(p?.name?.pl || p?.name?.en || p?.image || "");
  const save = () => { localStorage.setItem(KEY, JSON.stringify(cart)); updateCount(); };
  const countNode = $("#count");
  function updateCount() {
    const count = cart.reduce((n, item) => n + item.qty, 0);
    if (countNode) { countNode.textContent = count; countNode.hidden = count === 0; }
    const cartButton = $(".tools .cart");
    if (cartButton) cartButton.setAttribute("aria-label", `${text("Koszyk", "Cart")}: ${count}`);
  }
  function toast(message) {
    let node = $("#storeToast");
    if (!node) { node = document.createElement("div"); node.id = "storeToast"; node.className = "store-toast"; node.setAttribute("role", "status"); document.body.append(node); }
    node.textContent = message; node.classList.add("is-visible");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("is-visible"), 1900);
  }
  function add(product) {
    if (!product) return;
    const id = productId(product);
    const existing = cart.find(x => x.id === id);
    if (existing) existing.qty += 1;
    else cart.push({ id, product, qty: 1 });
    save(); renderCart();
    toast(text("Dodano do koszyka", "Added to cart"));
  }
  window.GentStore = { add };

  // Search panel
  const searchButton = $$("button.icon").find(b => /szukaj|search/i.test(b.getAttribute("aria-label") || ""));
  const nav = $(".nav");
  let searchPanel = $("#catalogSearch");
  if (!searchPanel && nav) {
    searchPanel = document.createElement("section");
    searchPanel.id = "catalogSearch"; searchPanel.className = "catalog-search"; searchPanel.hidden = true;
    searchPanel.innerHTML = `<label class="search-label" for="catalogSearchInput">${text("Szukaj bukietu", "Search bouquets")}</label><div class="search-field-wrap"><input id="catalogSearchInput" type="search" autocomplete="off" placeholder="${text("Wpisz nazwę, kwiat lub dowolne słowo z opisu…", "Type a name, flower or any word from the description…")}"><button type="button" class="search-clear" id="catalogSearchClear">${text("Wyczyść", "Clear")}</button></div><p class="search-meta" id="catalogSearchMeta" aria-live="polite"></p>`;
    nav.after(searchPanel);
  }
  const searchInput = $("#catalogSearchInput");
  const searchMeta = $("#catalogSearchMeta");
  function searchProducts() {
    const query = normalize(searchInput?.value).trim();
    const words = query.split(/\s+/).filter(Boolean);
    const cards = $$(".product", $("#productGrid"));
    let shown = 0;
    cards.forEach(card => {
      const p = getData(card);
      const corpus = normalize([
        p?.name?.pl, p?.name?.en, p?.subtitle?.pl, p?.subtitle?.en,
        p?.description?.pl, p?.description?.en, p?.alt?.pl, p?.alt?.en
      ].join(" "));
      const match = !words.length || words.some(word => corpus.includes(word));
      card.hidden = !match;
      if (match) shown++;
    });
    if (searchMeta) searchMeta.textContent = query
      ? (shown ? text(`Znaleziono: ${shown}`, `Found: ${shown}`) : text("Nie znaleziono bukietów. Spróbuj innego słowa.", "No bouquets found. Try another word."))
      : text("Wyszukiwanie obejmuje nazwy, skład i opisy bukietów.", "Search includes bouquet names, flowers and descriptions.");
    const empty = $("#catalogEmpty");
    if (empty) empty.hidden = shown !== 0;
  }
  searchButton?.addEventListener("click", () => {
    if (!searchPanel) return;
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) { $("#catalogSearchInput")?.focus(); $("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else { if (searchInput) searchInput.value = ""; searchProducts(); }
  });
  searchInput?.addEventListener("input", searchProducts);
  $("#catalogSearchClear")?.addEventListener("click", () => { searchInput.value = ""; searchProducts(); searchInput.focus(); });

  // Cart drawer
  const cartButton = $(".tools .cart");
  let overlay = $("#gentCart");
  if (!overlay) {
    overlay = document.createElement("div"); overlay.id = "gentCart"; overlay.className = "cart-overlay"; overlay.hidden = true;
    overlay.innerHTML = `<div class="cart-backdrop" data-cart-close></div><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" tabindex="-1"><div class="cart-drawer-head"><div><div class="eyebrow">${text("GENT FLOWERS", "GENT FLOWERS")}</div><h2 id="cartTitle">${text("Twój koszyk", "Your basket")}</h2></div><button class="drawer-close" type="button" aria-label="${text("Zamknij", "Close")}" data-cart-close>×</button></div><div class="cart-items" id="cartItems"></div><p class="cart-empty" id="cartEmpty">${text("Twój koszyk jest pusty.", "Your basket is empty.")}</p><div class="cart-footer" id="cartFooter"><div class="cart-total"><span>${text("Razem", "Total")}</span><strong id="cartTotal">0 zł</strong></div><button class="button cart-copy-order" id="cartCopyOrder" type="button">${text("Skopiuj podsumowanie zamówienia", "Copy order summary")} <span>→</span></button><button class="cart-clear" id="cartClear" type="button">${text("Wyczyść koszyk", "Clear basket")}</button><p>${text("Podsumowanie możesz wysłać nam, aby potwierdzić zamówienie.", "Copy the summary and send it to us to confirm your order.")}</p></div></aside>`;
    document.body.append(overlay);
  }
  const itemsNode = $("#cartItems"), emptyNode = $("#cartEmpty"), footerNode = $("#cartFooter");
  function renderCart() {
    if (!itemsNode) return;
    itemsNode.replaceChildren();
    cart.forEach(({product:p, qty, id}) => {
      const row = document.createElement("article"); row.className = "cart-item";
      const img = document.createElement("img"); img.className = "cart-item-image"; img.src = p.image?.startsWith("/") ? `.${p.image}` : p.image; img.alt = p.alt?.[lang()] || p.alt?.pl || "";
      const body = document.createElement("div"); body.className = "cart-item-body";
      const name = document.createElement("div"); name.className = "cart-item-name"; name.textContent = p.name?.[lang()] || p.name?.pl || "";
      const sub = document.createElement("div"); sub.className = "cart-item-sub"; sub.textContent = p.subtitle?.[lang()] || p.subtitle?.pl || "";
      const price = document.createElement("div"); price.className = "cart-item-price"; price.textContent = `${money(p.price)} × ${qty} = ${money(p.price * qty)}`;
      const controls = document.createElement("div"); controls.className = "cart-quantity";
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", text("Zmniejsz ilość", "Decrease quantity")); minus.addEventListener("click", () => changeQty(id, -1));
      const value = document.createElement("span"); value.className = "cart-quantity-value"; value.textContent = qty;
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", text("Zwiększ ilość", "Increase quantity")); plus.addEventListener("click", () => changeQty(id, 1));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "cart-remove"; remove.textContent = text("Usuń", "Remove"); remove.addEventListener("click", () => { cart = cart.filter(x => x.id !== id); save(); renderCart(); });
      controls.append(minus, value, plus, remove); body.append(name, sub, price, controls); row.append(img, body); itemsNode.append(row);
    });
    const totalQty = cart.reduce((n,x) => n+x.qty,0), total = cart.reduce((n,x) => n+x.qty*x.product.price,0);
    if (emptyNode) emptyNode.hidden = totalQty > 0;
    if (footerNode) footerNode.hidden = totalQty === 0;
    $("#cartTotal").textContent = money(total);
  }
  function changeQty(id, delta) {
    const item = cart.find(x => x.id === id); if (!item) return;
    item.qty += delta; if (item.qty <= 0) cart = cart.filter(x => x.id !== id);
    save(); renderCart();
  }
  function openCart() { overlay.hidden = false; document.body.classList.add("cart-open"); $(".cart-drawer", overlay)?.focus(); }
  function closeCart() { overlay.hidden = true; document.body.classList.remove("cart-open"); cartButton?.focus(); }
  cartButton?.addEventListener("click", openCart);
  overlay.addEventListener("click", e => { if (e.target.closest("[data-cart-close]")) closeCart(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeCart(); });
  $("#cartClear")?.addEventListener("click", () => { cart = []; save(); renderCart(); });
  $("#cartCopyOrder")?.addEventListener("click", async () => {
    const lines = cart.map(({product:p,qty}) => `${p.name?.[lang()] || p.name?.pl} — ${qty} × ${money(p.price)} = ${money(p.price*qty)}`);
    const total = cart.reduce((n,x) => n+x.qty*x.product.price,0);
    const summary = `${text("Zamówienie Gent Flowers", "Gent Flowers order")}\n${lines.join("\n")}\n${text("Razem", "Total")}: ${money(total)}`;
    try { await navigator.clipboard.writeText(summary); toast(text("Podsumowanie skopiowane", "Order summary copied")); }
    catch { toast(text("Nie udało się skopiować podsumowania", "Could not copy the summary")); }
  });
  updateCount(); renderCart();
})();
