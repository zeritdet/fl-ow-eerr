(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const KEY = "gent-cart-v1";
  const ORDER_API_URL = "https://gent-flowers-orders.zeritdet.workers.dev/api/orders";
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
    if (confirmationPanel) confirmationPanel.hidden = true;
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
    overlay.innerHTML = `<div class="cart-backdrop" data-cart-close></div><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" tabindex="-1"><div class="cart-drawer-head"><div><div class="eyebrow">${text("GENT FLOWERS", "GENT FLOWERS")}</div><h2 id="cartTitle">${text("Twój koszyk", "Your basket")}</h2></div><button class="drawer-close" type="button" aria-label="${text("Zamknij", "Close")}" data-cart-close>×</button></div><div class="cart-items" id="cartItems"></div><p class="cart-empty" id="cartEmpty">${text("Twój koszyk jest pusty.", "Your basket is empty.")}</p><div class="cart-footer" id="cartFooter"><div class="cart-total"><span>${text("Razem", "Total")}</span><strong id="cartTotal">0 zł</strong></div><button class="button cart-copy-order" id="cartCopyOrder" type="button">${text("Skopiuj podsumowanie zamówienia", "Copy order summary")} <span>→</span></button><button class="button cart-checkout-open" id="cartCheckoutOpen" type="button">${text("Przejdź do zamówienia", "Proceed to checkout")} <span>→</span></button><form class="checkout-form" id="checkoutForm" hidden><h3>${text("Dane do dostawy", "Delivery details")}</h3><label>${text("Imię i nazwisko", "Full name")}<input name="name" autocomplete="name" required minlength="2" maxlength="100"></label><label>${text("Numer telefonu", "Phone number")}<input name="phone" type="tel" autocomplete="tel" required minlength="6" maxlength="30" placeholder="+48 ..."></label><label>${text("Adres dostawy", "Delivery address")}<input name="address" autocomplete="street-address" required minlength="5" maxlength="200" placeholder="${text("Ulica, numer domu/mieszkania, miasto", "Street, building/apartment number, city")}"></label><label>${text("Data dostawy", "Delivery date")}<input name="deliveryDate" type="date" required></label><label>${text("Preferowana godzina", "Preferred time")}<select name="deliveryTime" required><option value="">${text("Wybierz godzinę", "Choose a time")}</option><option>09:00–12:00</option><option>12:00–15:00</option><option>15:00–18:00</option><option>18:00–21:00</option></select></label><label>${text("Uwagi do zamówienia (opcjonalnie)", "Order notes (optional)")}<textarea name="notes" rows="3" maxlength="500"></textarea></label><p class="checkout-message" id="checkoutMessage" role="status" aria-live="polite"></p><button class="button cart-submit-order" id="cartSubmitOrder" type="submit">${text("Wyślij zamówienie", "Place order")} <span>→</span></button><button class="cart-clear checkout-back" id="checkoutBack" type="button">${text("Wróć do koszyka", "Back to basket")}</button></form><button class="cart-clear" id="cartClear" type="button">${text("Wyczyść koszyk", "Clear basket")}</button><p>${text("Podsumowanie możesz wysłać nam, aby potwierdzić zamówienie.", "Copy the summary and send it to us to confirm your order.")}</p></div></aside>`;
    document.body.append(overlay);
  }
  const itemsNode = $("#cartItems"), emptyNode = $("#cartEmpty"), footerNode = $("#cartFooter");
  const cartDrawer = $(".cart-drawer", overlay);
  let confirmationPanel = $("#orderConfirmation", overlay);
  if (!confirmationPanel && cartDrawer) {
    confirmationPanel = document.createElement("section");
    confirmationPanel.id = "orderConfirmation";
    confirmationPanel.className = "order-confirmation";
    confirmationPanel.hidden = true;
    confirmationPanel.setAttribute("role", "status");
    confirmationPanel.setAttribute("aria-live", "polite");
    confirmationPanel.innerHTML = `<div class="order-confirmation-icon" aria-hidden="true">✓</div><h3>${text("Dziękujemy za zamówienie!", "Thank you for your order!")}</h3><p>${text("Twoje zamówienie zostało wysłane. Oczekuj telefonu od kuriera w celu potwierdzenia dostawy.", "Your order has been sent. Please expect a call from the courier to confirm delivery.")}</p>`;
    cartDrawer.append(confirmationPanel);
  }
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
  const checkoutForm = $("#checkoutForm");
  const checkoutOpen = $("#cartCheckoutOpen");
  const checkoutMessage = $("#checkoutMessage");
  const checkoutBack = $("#checkoutBack");
  const dateInput = checkoutForm?.elements.deliveryDate;
  if (dateInput) {
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    dateInput.min = localToday;
  }
  checkoutOpen?.addEventListener("click", () => {
    if (!cart.length) return;
    if (confirmationPanel) confirmationPanel.hidden = true;
    if (emptyNode) emptyNode.hidden = true;
    checkoutForm.hidden = false;
    checkoutOpen.hidden = true;
    $("#cartCopyOrder").hidden = true;
    $("#cartClear").hidden = true;
    checkoutForm.elements.name.focus();
  });
  checkoutBack?.addEventListener("click", () => {
    checkoutForm.hidden = true;
    checkoutOpen.hidden = false;
    $("#cartCopyOrder").hidden = false;
    $("#cartClear").hidden = false;
    if (checkoutMessage) checkoutMessage.textContent = "";
  });
  checkoutForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!cart.length || !checkoutForm.reportValidity()) return;
    const submit = $("#cartSubmitOrder");
    const formData = new FormData(checkoutForm);
    const payload = {
      customer: {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        deliveryDate: String(formData.get("deliveryDate") || ""),
        deliveryTime: String(formData.get("deliveryTime") || ""),
        notes: String(formData.get("notes") || "").trim()
      },
      language: lang(),
      items: cart.map(({product, qty}) => ({
        name: product.name?.[lang()] || product.name?.pl || product.name?.en || "",
        quantity: qty,
        price: Number(product.price)
      }))
    };
    submit.disabled = true;
    submit.textContent = text("Wysyłanie…", "Sending…");
    if (checkoutMessage) checkoutMessage.textContent = "";
    try {
      const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || text("Nie udało się wysłać zamówienia. Spróbuj ponownie.", "Could not submit the order. Please try again."));
      cart = [];
      save(); renderCart();
      checkoutForm.reset();
      checkoutForm.hidden = true;
      checkoutOpen.hidden = false;
      $("#cartCopyOrder").hidden = false;
      $("#cartClear").hidden = false;
      if (emptyNode) emptyNode.hidden = true;
      if (confirmationPanel) confirmationPanel.hidden = false;
      toast(text("Zamówienie wysłane! Dziękujemy.", "Order sent! Thank you."));
    } catch (error) {
      if (checkoutMessage) checkoutMessage.textContent = error.message || text("Błąd połączenia. Spróbuj ponownie.", "Connection error. Please try again.");
    } finally {
      submit.disabled = false;
      submit.innerHTML = `${text("Wyślij zamówienie", "Place order")} <span>→</span>`;
    }
  });

  updateCount(); renderCart();
})();
