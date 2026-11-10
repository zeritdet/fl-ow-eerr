(async function () {
  const response = await fetch("./data/site.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Nie udało się pobrać data/site.json");
  const data = await response.json();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storage = {
    read(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (_) { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    }
  };

  let lang = localStorage.getItem("gent-language") || "pl";
  if (!['pl', 'en'].includes(lang)) lang = 'pl';
  let currentView = 'grid';
  let currentQuery = '';
  let favoritesOnly = false;
  let activeItem = null;
  let activeCard = null;
  function createProductId(item, index) {
    const source = item?.name?.pl || item?.name?.en || `bouquet-${index + 1}`;
    const slug = String(source).toLocaleLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `bouquet-${slug || index + 1}`;
  }
  const products = (data.products || []).filter(item => item && item.name && Number.isFinite(Number(item.price)));
  products.forEach((item, index) => { if (!item.id) item.id = createProductId(item, index); });
  const productById = new Map(products.map(item => [item.id, item]));
  const favorites = new Set(storage.read('gent-favorites', []).filter(id => productById.has(id)));
  const storedCart = storage.read('gent-cart', {});
  const cart = {};
  Object.entries(storedCart && typeof storedCart === 'object' ? storedCart : {}).forEach(([id, qty]) => {
    const amount = Math.floor(Number(qty));
    if (productById.has(id) && amount > 0) cart[id] = Math.min(amount, 99);
  });

  const tr = value => value && typeof value === 'object'
    ? (value[lang] ?? value.pl ?? value.en ?? '')
    : (value ?? '');
  const getImageUrl = value => {
    if (!value) return '';
    const path = String(value).trim();
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return new URL(path.replace(/^\/+/, ''), new URL('./', window.location.href)).href;
  };
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const safeUrl = value => /^(https?:\/\/|mailto:|tel:|\/|#|\.{1,2}\/)/i.test(String(value || '')) ? value : '#';
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
  const normalize = value => String(value ?? '')
    .toLocaleLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  function flattenSearchValues(value, out = []) {
    if (typeof value === 'string' || typeof value === 'number') out.push(String(value));
    else if (Array.isArray(value)) value.forEach(item => flattenSearchValues(item, out));
    else if (value && typeof value === 'object') Object.values(value).forEach(item => flattenSearchValues(item, out));
    return out;
  }
  function productSearchText(item) {
    return normalize(flattenSearchValues(item).join(' '));
  }
  function persistFavorites() { storage.write('gent-favorites', [...favorites]); }
  function persistCart() { storage.write('gent-cart', cart); }
  function formatPrice(value) {
    return `${Number(value).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB')} ${products[0]?.currency || 'zł'}`;
  }
  function totalCartItems() { return Object.values(cart).reduce((sum, qty) => sum + qty, 0); }
  function totalCartPrice() {
    return Object.entries(cart).reduce((sum, [id, qty]) => sum + (Number(productById.get(id)?.price) || 0) * qty, 0);
  }
  function label(key) {
    const words = {
      pl: {
        favorites: 'Ulubione', search: 'Szukaj', cart: 'Koszyk', searchPlaceholder: 'Szukaj bukietu, kwiatów, opisu…',
        clear: 'Wyczyść', noResults: 'Nie znaleziono bukietów. Spróbuj innej nazwy kwiatu lub opisu.',
        noFavorites: 'Nie masz jeszcze ulubionych bukietów. Zaznacz serce przy wybranej kompozycji.',
        count: 'bukietów w katalogu', cartTitle: 'Twój koszyk', emptyCart: 'Twój koszyk jest pusty.',
        emptyHint: 'Dodaj bukiet z katalogu, a pojawi się tutaj.', subtotal: 'Razem',
        copyOrder: 'Skopiuj zamówienie', clearCart: 'Wyczyść koszyk',
        cartHelp: 'Skopiuj podsumowanie i wyślij je do pracowni, aby potwierdzić dostępność, dostawę i płatność.',
        copied: 'Podsumowanie zamówienia skopiowano.', copyFailed: 'Nie udało się skopiować. Spróbuj ponownie.',
        remove: 'Usuń', decrease: 'Zmniejsz ilość', increase: 'Zwiększ ilość',
        orderHeading: 'Zamówienie Gent Flowers', orderTotal: 'Suma', product: 'bukiet',
        inCart: 'W koszyku', added: 'Dodano do koszyka ✓', details: 'Szczegóły bukietu',
        favoriteAdd: 'Dodaj do ulubionych', favoriteRemove: 'Usuń z ulubionych', favoriteAdded: 'Dodano do ulubionych ✓', favoriteRemoved: 'Usunięto z ulubionych',
        searchResults: 'Znaleziono', all: 'Wszystkie bukiety',
        copiedButton: 'Skopiowano ✓'
      },
      en: {
        favorites: 'Favourites', search: 'Search', cart: 'Cart', searchPlaceholder: 'Search bouquets, flowers, descriptions…',
        clear: 'Clear', noResults: 'No bouquets found. Try another flower name or description.',
        noFavorites: 'You have no favourite bouquets yet. Tap the heart on a composition you like.',
        count: 'bouquets in catalogue', cartTitle: 'Your cart', emptyCart: 'Your cart is empty.',
        emptyHint: 'Add a bouquet from the catalogue and it will appear here.', subtotal: 'Subtotal',
        copyOrder: 'Copy order', clearCart: 'Clear cart',
        cartHelp: 'Copy the summary and send it to the flower studio to confirm availability, delivery and payment.',
        copied: 'Order summary copied.', copyFailed: 'Could not copy. Please try again.',
        remove: 'Remove', decrease: 'Decrease quantity', increase: 'Increase quantity',
        orderHeading: 'Gent Flowers order', orderTotal: 'Total', product: 'bouquet',
        inCart: 'In cart', added: 'Added to cart ✓', details: 'Bouquet details',
        favoriteAdd: 'Add to favourites', favoriteRemove: 'Remove from favourites', favoriteAdded: 'Added to favourites ✓', favoriteRemoved: 'Removed from favourites',
        searchResults: 'Found', all: 'All bouquets', copiedButton: 'Copied ✓'
      }
    };
    return words[lang][key] || key;
  }

  // Brand, theme and fixed page copy.
  document.title = data.brand?.name || 'Gent Flowers';
  const logo = data.brand?.logo || './gent-flowers-logo.png';
  $$('.brand-logo').forEach(img => { img.src = getImageUrl(logo); img.alt = data.brand?.name || 'Gent Flowers'; });
  const theme = data.theme || {};
  const root = document.documentElement;
  [
    ['--cms-page-bg', 'page_background'], ['--cms-ink', 'ink'], ['--cms-muted', 'muted'],
    ['--cms-rose', 'hero_background'], ['--cms-green', 'green'], ['--cms-accent', 'accent'], ['--cms-line', 'line']
  ].forEach(([variable, key]) => { if (theme[key]) root.style.setProperty(variable, theme[key]); });

  setText('.topline [data-i18n="delivery"]', data.texts?.delivery);
  setText('.topline [data-i18n="contact"]', data.texts?.contact);
  setText('.hero .eyebrow span', data.hero?.eyebrow || data.texts?.studio);
  setText('.hero h1', data.texts?.heroTitle);
  setText('.hero-copy p', data.texts?.heroText);
  setText('.hero-note', data.texts?.heroNote);
  setImage($('.hero-image img'), data.hero?.image, data.hero?.image_alt);
  const heroBtn = $('.hero-copy .button');
  if (heroBtn) { heroBtn.href = safeUrl(data.hero_button?.url); const first = $('span:first-child', heroBtn); if (first) first.textContent = tr(data.hero_button?.label); }

  const navLinks = $$('.nav .links a');
  (data.navigation || []).forEach((item, index) => {
    if (navLinks[index]) { navLinks[index].textContent = tr(item.label); navLinks[index].href = safeUrl(item.url); }
  });
  navLinks.slice((data.navigation || []).length).forEach(a => a.remove());

  const collectionRoot = $('.collections');
  if (collectionRoot) {
    collectionRoot.replaceChildren();
    (data.collections || []).forEach(item => {
      const a = el('a', 'collection'); a.href = safeUrl(item.url);
      const img = el('img'); setImage(img, item.image, item.alt); a.append(img);
      const title = el('span', '', tr(item.title));
      const small = el('small', '', tr(item.subtitle)); title.append(small); a.append(title);
      collectionRoot.append(a);
    });
  }
  setText('#collections .section-head .eyebrow', data.texts?.findOccasion);
  setText('#collections h2', data.texts?.collectionsTitle);
  setText('#collections .section-head p', data.texts?.collectionIntro);

  const grid = $('#productGrid');
  const controls = $$('.view-button');
  const carouselControls = $('#carouselControls');
  const prev = $('#carouselPrev');
  const next = $('#carouselNext');
  const position = $('#carouselPosition');
  const count = $('#count');
  const favoriteCount = $('#favoriteCount');
  const favoriteToggle = $('#favoriteToggle');
  const searchToggle = $('#searchToggle');
  const cartToggle = $('#cartToggle');
  const productModal = $('#productModal');
  const modalPanel = productModal?.querySelector('.product-detail');
  const modalImage = $('#modalImage');
  const modalTitle = $('#modalTitle');
  const modalDesc = $('#modalDescription');
  const modalPrice = $('#modalPrice');
  const modalSwatches = $('#modalSwatches');

  function updateCarousel() {
    if (!grid || !position) return;
    const cards = $$('.product', grid);
    if (!cards.length || currentView !== 'carousel') {
      position.textContent = cards.length ? `1 / ${cards.length}` : '0 / 0';
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }
    const step = cards[0].getBoundingClientRect().width + 18;
    const index = Math.max(0, Math.round(grid.scrollLeft / Math.max(step, 1)));
    position.textContent = `${Math.min(index + 1, cards.length)} / ${cards.length}`;
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= cards.length - 1;
  }

  function updateHeaderControls() {
    const amount = totalCartItems();
    if (count) { count.textContent = String(amount); count.hidden = amount === 0; }
    if (cartToggle) cartToggle.setAttribute('aria-label', `${label('cart')} (${amount})`);
    if (favoriteCount) { favoriteCount.textContent = String(favorites.size); favoriteCount.hidden = favorites.size === 0; }
    if (favoriteToggle) {
      favoriteToggle.setAttribute('aria-pressed', String(favoritesOnly));
      favoriteToggle.setAttribute('aria-label', `${label('favorites')} (${favorites.size})`);
      favoriteToggle.classList.toggle('is-active', favoritesOnly);
    }
  }

  function productCard(item) {
    const article = el('article', 'product');
    article.tabIndex = 0;
    article.setAttribute('role', 'group');
    article.setAttribute('aria-label', tr(item.name));
    article.dataset.productId = item.id;

    const photo = el('div', 'product-photo');
    const img = el('img'); setImage(img, item.image, item.alt || item.name); img.loading = 'lazy';
    photo.append(img);
    if (tr(item.badge)) photo.append(el('span', 'tag', tr(item.badge)));

    const heart = el('button', 'favorite-toggle');
    heart.type = 'button';
    heart.dataset.favoriteId = item.id;
    heart.setAttribute('aria-pressed', String(favorites.has(item.id)));
    heart.setAttribute('aria-label', favorites.has(item.id) ? label('favoriteRemove') : label('favoriteAdd'));
    const heartImg = el('img', 'heart-image');
    heartImg.src = getImageUrl('/media/icons/heart-card.png'); heartImg.alt = ''; heartImg.setAttribute('aria-hidden', 'true');
    heart.append(heartImg);
    if (favorites.has(item.id)) heart.classList.add('is-favorite');
    photo.append(heart);

    const quick = el('button', 'quick', tr(data.texts?.add) || label('add'));
    quick.type = 'button'; quick.dataset.addId = item.id;
    photo.append(quick);
    article.append(photo);

    const info = el('div', 'product-info');
    const head = el('div', 'product-heading');
    head.append(el('div', 'product-name', tr(item.name)), el('div', 'product-sub', tr(item.subtitle)));
    const price = el('div', 'price', formatPrice(item.price));
    const desc = el('div', 'product-description', tr(item.description));
    const options = el('div', 'product-options');
    options.append(el('div', 'palette-head', tr(data.texts?.palette) || (lang === 'pl' ? 'Paleta' : 'Palette')));
    const swatches = el('div', 'swatches');
    (item.palette || []).forEach(color => {
      const swatch = el('span', 'color-swatch');
      swatch.style.setProperty('--swatch', color.hex || '#ddd');
      swatch.title = tr(color.name); swatch.setAttribute('aria-label', tr(color.name));
      swatches.append(swatch);
    });
    options.append(swatches);
    info.append(head, price, desc, options);
    article.append(info);
    article._productData = item;
    return article;
  }

  const searchBar = el('div', 'catalog-search');
  searchBar.hidden = true;
  searchBar.innerHTML = `
    <label class="search-label" for="catalogSearchInput"></label>
    <div class="search-field-wrap">
      <input id="catalogSearchInput" type="search" autocomplete="off" />
      <button type="button" id="clearCatalogSearch" class="search-clear"></button>
    </div>
    <p class="search-meta" id="catalogSearchMeta" aria-live="polite"></p>`;
  const searchInput = $('#catalogSearchInput', searchBar);
  const clearSearch = $('#clearCatalogSearch', searchBar);
  const searchMeta = $('#catalogSearchMeta', searchBar);
  const searchLabel = $('.search-label', searchBar);
  if (grid) grid.before(searchBar);

  const emptyState = el('p', 'catalog-empty');
  emptyState.hidden = true;

  function getVisibleProducts() {
    const tokens = normalize(currentQuery).split(/\s+/).filter(Boolean);
    return products.filter(item => {
      if (favoritesOnly && !favorites.has(item.id)) return false;
      if (!tokens.length) return true;
      const haystack = productSearchText(item);
      return tokens.every(token => haystack.includes(token));
    });
  }

  function renderProducts() {
    if (!grid) return;
    const visible = getVisibleProducts();
    grid.replaceChildren();
    visible.forEach(item => grid.append(productCard(item)));
    grid.append(emptyState);
    emptyState.hidden = visible.length > 0;
    emptyState.textContent = favoritesOnly && favorites.size === 0
      ? label('noFavorites')
      : (currentQuery ? label('noResults') : label('noFavorites'));
    grid.classList.remove('view-list', 'view-carousel');
    if (currentView === 'list') grid.classList.add('view-list');
    if (currentView === 'carousel') grid.classList.add('view-carousel');
    if (searchMeta) {
      const prefix = currentQuery ? `${label('searchResults')}: ` : '';
      searchMeta.textContent = `${prefix}${visible.length} ${label('count')}`;
    }
    if (clearSearch) clearSearch.hidden = !currentQuery;
    updateHeaderControls();
    updateCarousel();
  }

  // Search controls live directly above the catalogue.
  function openSearch(open = true) {
    searchBar.hidden = !open;
    if (searchToggle) searchToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      $('#shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => searchInput?.focus(), 180);
    }
  }
  if (searchInput) searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    if (currentView === 'carousel') { currentView = 'grid'; controls.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'grid'))); if (carouselControls) carouselControls.style.display = 'none'; }
    renderProducts();
  });
  clearSearch?.addEventListener('click', () => {
    searchInput.value = ''; currentQuery = ''; renderProducts(); searchInput.focus();
  });
  searchToggle?.addEventListener('click', () => openSearch(searchBar.hidden));

  function toggleFavorite(id) {
    if (!productById.has(id)) return;
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    persistFavorites();
    renderProducts();
    showToast(favorites.has(id) ? label('favoriteAdded') : label('favoriteRemoved'));
  }
  favoriteToggle?.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    renderProducts();
    $('#shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Shared cart drawer: quantity, removal, subtotal and a copyable order summary.
  const cartOverlay = el('div', 'cart-overlay');
  cartOverlay.id = 'cartOverlay';
  cartOverlay.hidden = true;
  cartOverlay.innerHTML = `
    <div class="cart-backdrop" data-close-cart></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" tabindex="-1">
      <div class="cart-drawer-head"><div><span class="eyebrow">GENT FLOWERS</span><h2 id="cartTitle"></h2></div><button class="drawer-close" type="button" aria-label="Close" data-close-cart>×</button></div>
      <div class="cart-items" id="cartItems" aria-live="polite"></div>
      <div class="cart-empty" id="cartEmpty"></div>
      <div class="cart-footer" id="cartFooter">
        <div class="cart-total"><span id="cartSubtotalLabel"></span><strong id="cartSubtotal"></strong></div>
        <button type="button" class="button cart-copy-order" id="copyOrder"></button>
        <button type="button" class="cart-clear" id="clearCart"></button>
        <p id="cartHelp"></p>
      </div>
    </aside>`;
  document.body.append(cartOverlay);
  const cartItemsRoot = $('#cartItems', cartOverlay);
  const cartEmpty = $('#cartEmpty', cartOverlay);
  const cartFooter = $('#cartFooter', cartOverlay);
  const cartDrawer = $('.cart-drawer', cartOverlay);

  function renderCart() {
    if (!cartItemsRoot) return;
    cartItemsRoot.replaceChildren();
    const entries = Object.entries(cart).filter(([id, qty]) => productById.has(id) && qty > 0);
    entries.forEach(([id, qty]) => {
      const item = productById.get(id);
      const row = el('article', 'cart-item');
      const img = el('img', 'cart-item-image'); setImage(img, item.image, item.alt || item.name); img.loading = 'lazy';
      const body = el('div', 'cart-item-body');
      const name = el('div', 'cart-item-name', tr(item.name));
      const sub = el('div', 'cart-item-sub', tr(item.subtitle));
      const price = el('div', 'cart-item-price', `${formatPrice(item.price)} · ${formatPrice(item.price * qty)}`);
      const controls = el('div', 'cart-quantity');
      const minus = el('button', '', '−'); minus.type = 'button'; minus.dataset.cartAction = 'minus'; minus.dataset.id = id; minus.setAttribute('aria-label', label('decrease'));
      const quantity = el('span', 'cart-quantity-value', String(qty));
      const plus = el('button', '', '+'); plus.type = 'button'; plus.dataset.cartAction = 'plus'; plus.dataset.id = id; plus.setAttribute('aria-label', label('increase'));
      const remove = el('button', 'cart-remove', label('remove')); remove.type = 'button'; remove.dataset.cartAction = 'remove'; remove.dataset.id = id;
      controls.append(minus, quantity, plus, remove);
      body.append(name, sub, price, controls);
      row.append(img, body); cartItemsRoot.append(row);
    });
    const empty = entries.length === 0;
    cartEmpty.hidden = !empty;
    cartEmpty.textContent = empty ? `${label('emptyCart')} ${label('emptyHint')}` : '';
    cartFooter.hidden = empty;
    $('#cartTitle', cartOverlay).textContent = label('cartTitle');
    $('#cartSubtotalLabel', cartOverlay).textContent = label('subtotal');
    $('#cartSubtotal', cartOverlay).textContent = formatPrice(totalCartPrice());
    $('#copyOrder', cartOverlay).textContent = label('copyOrder');
    $('#clearCart', cartOverlay).textContent = label('clearCart');
    $('#cartHelp', cartOverlay).textContent = label('cartHelp');
    updateHeaderControls();
  }

  function showToast(message) {
    let toast = $('#storeToast');
    if (!toast) { toast = el('div', 'store-toast'); toast.id = 'storeToast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function addToCart(item, amount = 1) {
    if (!item?.id) return;
    cart[item.id] = Math.min(99, (cart[item.id] || 0) + amount);
    persistCart(); renderCart();
    showToast(`${tr(item.name)} — ${label('added')}`);
  }
  function setCartOpen(open) {
    cartOverlay.hidden = !open;
    document.body.classList.toggle('cart-open', open);
    if (open) { renderCart(); window.setTimeout(() => cartDrawer?.focus(), 30); }
  }
  cartToggle?.addEventListener('click', () => setCartOpen(cartOverlay.hidden));
  cartOverlay.addEventListener('click', event => {
    const target = event.target;
    if (target?.hasAttribute('data-close-cart')) { setCartOpen(false); return; }
    const actionButton = target?.closest('[data-cart-action]');
    if (!actionButton) return;
    const id = actionButton.dataset.id;
    if (!cart[id]) return;
    if (actionButton.dataset.cartAction === 'plus') cart[id] = Math.min(99, cart[id] + 1);
    if (actionButton.dataset.cartAction === 'minus') cart[id] -= 1;
    if (actionButton.dataset.cartAction === 'remove' || cart[id] <= 0) delete cart[id];
    persistCart(); renderCart();
  });
  $('#clearCart', cartOverlay)?.addEventListener('click', () => {
    Object.keys(cart).forEach(id => delete cart[id]); persistCart(); renderCart();
  });

  async function copyOrderSummary() {
    const rows = Object.entries(cart).filter(([id, qty]) => productById.has(id) && qty > 0);
    if (!rows.length) return;
    const lines = [label('orderHeading'), ''];
    rows.forEach(([id, qty]) => {
      const item = productById.get(id);
      lines.push(`${tr(item.name)} — ${qty} × ${formatPrice(item.price)} = ${formatPrice(item.price * qty)}`);
    });
    lines.push('', `${label('orderTotal')}: ${formatPrice(totalCartPrice())}`);
    lines.push('', lang === 'pl' ? 'Proszę o potwierdzenie dostępności, dostawy i sposobu płatności.' : 'Please confirm availability, delivery and payment method.');
    const text = lines.join('\n');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = el('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.append(textarea); textarea.select();
        const ok = document.execCommand('copy'); textarea.remove(); if (!ok) throw new Error('Clipboard unavailable');
      }
      showToast(label('copied'));
      const button = $('#copyOrder', cartOverlay); if (button) { const original = label('copyOrder'); button.textContent = label('copiedButton'); window.setTimeout(() => { button.textContent = original; }, 1800); }
    } catch (error) { showToast(label('copyFailed')); }
  }
  $('#copyOrder', cartOverlay)?.addEventListener('click', copyOrderSummary);

  function openProduct(item, card = null) {
    if (!productModal || !item) return;
    activeItem = item; activeCard = card;
    modalImage.src = getImageUrl(item.image); modalImage.alt = tr(item.alt || item.name);
    modalTitle.textContent = tr(item.name); modalDesc.textContent = tr(item.description);
    modalPrice.textContent = formatPrice(item.price);
    modalSwatches.replaceChildren();
    (item.palette || []).forEach((color, index) => {
      const button = el('button', 'color-swatch'); button.type = 'button'; button.style.setProperty('--swatch', color.hex || '#ddd');
      button.title = tr(color.name); button.setAttribute('aria-label', tr(color.name)); button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => $$('.color-swatch', modalSwatches).forEach(node => node.setAttribute('aria-pressed', String(node === button))));
      modalSwatches.append(button);
    });
    productModal.classList.add('is-open'); productModal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; modalPanel?.focus();
  }
  function closeProduct() {
    if (!productModal) return;
    productModal.classList.remove('is-open'); productModal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    if (activeCard?.isConnected) activeCard.focus();
  }
  grid?.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const favoriteButton = target.closest('[data-favorite-id]');
    if (favoriteButton) { event.preventDefault(); event.stopPropagation(); toggleFavorite(favoriteButton.dataset.favoriteId); return; }
    const addButton = target.closest('[data-add-id]');
    if (addButton) { event.preventDefault(); event.stopPropagation(); const item = productById.get(addButton.dataset.addId); if (item) addToCart(item); return; }
    const card = target.closest('.product');
    if (card?._productData) { event.preventDefault(); openProduct(card._productData, card); }
  });
  grid?.addEventListener('keydown', event => {
    const card = event.target.closest('.product');
    if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); openProduct(card._productData, card);
    }
  });
  $('#modalClose')?.addEventListener('click', closeProduct);
  productModal?.addEventListener('click', event => { if (event.target === productModal) closeProduct(); });
  $('#modalAdd')?.addEventListener('click', () => { if (activeItem) addToCart(activeItem); closeProduct(); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (productModal?.classList.contains('is-open')) closeProduct();
      if (!cartOverlay.hidden) setCartOpen(false);
      if (!searchBar.hidden) openSearch(false);
    }
  });

  // Language switching.
  const languageButtons = $$('[data-lang]');
  function setLanguage(next) {
    lang = next; document.documentElement.lang = lang;
    const fixed = {
      delivery: data.texts?.delivery, contact: data.texts?.contact, studio: data.texts?.studio,
      heroTitle: data.texts?.heroTitle, heroText: data.texts?.heroText, heroNote: data.texts?.heroNote,
      chooseBouquet: data.hero_button?.label, home: data.navigation?.[0]?.label,
      collections: data.navigation?.[1]?.label, bouquets: data.navigation?.[2]?.label, about: data.navigation?.[3]?.label,
      findOccasion: data.texts?.findOccasion, collectionIntro: data.texts?.collectionIntro,
      pickedForYou: data.texts?.pickedForYou, favoriteBouquets: data.texts?.favoriteBouquets,
      freshDaily: data.texts?.freshDaily, tile: data.texts?.tile, list: data.texts?.list, carousel: data.texts?.carousel,
      ourStudio: data.texts?.ourStudio, storyTitle: data.texts?.storyTitle, storyText: data.texts?.storyText,
      meetGent: data.texts?.meetGent, footerLine: data.texts?.footerLine, hours: data.texts?.hours,
      palette: data.texts?.palette, productDetails: data.texts?.productDetails, add: data.texts?.add
    };
    $$('[data-i18n]').forEach(node => { const key = node.dataset.i18n; if (fixed[key] !== undefined) node.textContent = tr(fixed[key]); });
    languageButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    if (searchLabel) searchLabel.textContent = label('search');
    if (searchInput) searchInput.placeholder = label('searchPlaceholder');
    if (clearSearch) clearSearch.textContent = label('clear');
    if (favoriteToggle) favoriteToggle.title = label('favorites');
    if (searchToggle) searchToggle.title = label('search');
    if (cartToggle) cartToggle.title = label('cart');
    if (favoriteToggle) favoriteToggle.setAttribute('aria-label', `${label('favorites')} (${favorites.size})`);
    renderProducts(); renderCart();
    localStorage.setItem('gent-language', lang);
  }
  languageButtons.forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.lang)));

  // Catalogue display options and carousel navigation.
  controls.forEach(button => button.addEventListener('click', () => {
    currentView = button.dataset.view || 'grid';
    controls.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (carouselControls) carouselControls.style.display = currentView === 'carousel' ? 'flex' : 'none';
    if (grid) grid.scrollTo({ left: 0, behavior: 'smooth' });
    renderProducts();
  }));
  prev?.addEventListener('click', () => grid?.scrollBy({ left: -grid.clientWidth * .58, behavior: 'smooth' }));
  next?.addEventListener('click', () => grid?.scrollBy({ left: grid.clientWidth * .58, behavior: 'smooth' }));
  grid?.addEventListener('scroll', updateCarousel);
  window.addEventListener('resize', updateCarousel);

  // Story, footer and optional CMS content.
  setImage($('#story > img'), data.story?.image, data.story?.alt);
  setText('#story .eyebrow', data.texts?.ourStudio);
  setText('#story h2', data.texts?.storyTitle);
  setText('#story p', data.texts?.storyText);
  const storyLink = $('#story .text-link');
  if (storyLink) { storyLink.textContent = tr(data.texts?.meetGent); storyLink.href = safeUrl(data.story?.button_url); }
  setText('.footer [data-i18n="footerLine"]', data.texts?.footerLine);
  setText('.footer [data-i18n="hours"]', data.texts?.hours);
  const footer = $('#footer');
  const extraRoot = el('div', 'cms-extra-root');
  (data.extra_blocks || []).forEach(block => {
    const section = el('section', 'cms-extra-section');
    if (block.type === 'text') { if (tr(block.title)) section.append(el('h2', '', tr(block.title))); if (tr(block.body)) section.append(el('p', '', tr(block.body))); }
    else if (block.type === 'image') { if (tr(block.title)) section.append(el('h2', '', tr(block.title))); const image = el('img'); setImage(image, block.image, block.alt); section.append(image); }
    else if (block.type === 'cta') { if (tr(block.title)) section.append(el('h2', '', tr(block.title))); if (tr(block.body)) section.append(el('p', '', tr(block.body))); const button = el('a', 'button', tr(block.button?.label)); button.href = safeUrl(block.button?.url); section.append(button); }
    extraRoot.append(section);
  });
  if (footer && extraRoot.childElementCount) footer.before(extraRoot);

  // Initial state.
  setLanguage(lang);
  renderProducts();
  renderCart();
  updateHeaderControls();

})().catch(error => console.error('Gent Flowers CMS:', error));
