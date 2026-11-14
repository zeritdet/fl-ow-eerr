(() => {
  const API = "https://gent-flowers-orders.zeritdet.workers.dev";
  const $ = s => document.querySelector(s);
  let orders = [], filter = "ALL", catalogProducts = [], adminTurnstileId = null;
  function renderAdminTurnstile() {
    const node = $("#adminTurnstile");
    if (!node || !window.turnstile || adminTurnstileId !== null) return;
    adminTurnstileId = window.turnstile.render(node, {
      sitekey: "0x4AAAAAAGAydmEpIY0_5ffE",
      theme: "auto"
    });
  }
  const turnstileReady = () => {
    if (window.turnstile) renderAdminTurnstile();
    else setTimeout(turnstileReady, 250);
  };
  turnstileReady();
  const labels = { NEW:"Nowe", CONFIRMED:"Potwierdzone", PREPARING:"W przygotowaniu", DELIVERING:"W dostawie", COMPLETED:"Dostarczone", CANCELLED:"Anulowane" };
  async function api(path, options = {}) {
    const response = await fetch(API + path, { ...options, credentials:"include", headers:{ "Content-Type":"application/json", ...(options.headers||{}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Błąd połączenia z serwerem.");
    return data;
  }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function showLogin() { $("#login").hidden = false; $("#dashboard").hidden = true; }
  function showDashboard() { $("#login").hidden = true; $("#dashboard").hidden = false; }
  function renderStats() {
    const active = orders.filter(o => o.status !== "CANCELLED");
    const revenue = active.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const today = new Date(); today.setHours(0,0,0,0);
    const todayOrders = orders.filter(o => { const d = new Date(o.created_at || o.ordered_at || 0); return !Number.isNaN(d.getTime()) && d >= today; }).length;
    const newOrders = orders.filter(o => o.status === "NEW").length;
    const completed = orders.filter(o => o.status === "COMPLETED").length;
    const stats = [
      ["Всего заказов", orders.length], ["Новые заказы", newOrders],
      ["Заказы сегодня", todayOrders], ["Доставлено", completed],
      ["Выручка по заказам", `${revenue.toLocaleString("pl-PL", {minimumFractionDigits:2, maximumFractionDigits:2})} zł`]
    ];
    const node = $("#statsGrid");
    if (node) node.innerHTML = stats.map(([label,value]) => `<article class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
  }
  function renderProducts() {
    const node = $("#adminProducts");
    if (!node) return;
    node.innerHTML = catalogProducts.length ? catalogProducts.map(p => `<article class="admin-product"><img src="${esc(p.image || "")}" alt=""><div><strong>${esc(p.name?.pl || p.name?.en || "Товар")}</strong><span>${esc(p.name?.en || "")}</span></div><b>${Number(p.price || 0).toLocaleString("pl-PL")} zł</b></article>`).join("") : '<p class="muted">Не удалось загрузить товары. Открой Pages CMS для редактирования каталога.</p>';
  }
  async function loadCatalog() {
    try { const response = await fetch("./data/site.json", {cache:"no-store"}); if (!response.ok) throw new Error("catalog"); const data = await response.json(); catalogProducts = Array.isArray(data.products) ? data.products : []; renderProducts(); }
    catch { catalogProducts = []; renderProducts(); }
  }
  function render() {
    renderStats();
    const visible = orders.filter(o => filter === "ALL" || (filter === "IN_PROGRESS" ? ["CONFIRMED","PREPARING","DELIVERING"].includes(o.status) : filter === "COMPLETED" ? ["COMPLETED","CANCELLED"].includes(o.status) : o.status === filter));
    $("#count").textContent = `Всего заказов: ${orders.length} · Показано: ${visible.length}`;
    $("#orders").innerHTML = visible.length ? visible.map(o => `<article class="order"><div class="order-top"><div><h2>${esc(o.id)}</h2><div class="muted">${esc(o.ordered_at || o.created_at || "")}</div></div><strong>${Number(o.total).toFixed(2)} zł</strong></div><div class="order-grid"><p><b>Клиент:</b> ${esc(o.customer_name)}<br><b>Телефон:</b> <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></p><p><b>Адрес:</b> ${esc(o.customer_address)}<br><b>Доставка:</b> ${esc(o.delivery_date)} · ${esc(o.delivery_time)}</p></div><b>Товары:</b><ul>${(o.items || []).map(i => `<li>${esc(i.name)} — ${Number(i.quantity)} × ${Number(i.price).toFixed(2)} zł</li>`).join("")}</ul>${o.notes ? `<p><b>Комментарий:</b> ${esc(o.notes)}</p>` : ""}<div class="order-bottom"><label class="status-label">Статус<select class="status" data-id="${esc(o.id)}">${Object.entries(labels).map(([v,l]) => `<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><div class="order-actions"><button class="secondary history-toggle" data-id="${esc(o.id)}">История статусов</button><button class="danger delete-order" data-id="${esc(o.id)}" type="button">Удалить заказ</button></div></div><div class="history" id="history-${esc(o.id)}" hidden></div></article>`).join("") : '<div class="panel">Заказов в этой категории пока нет.</div>';
  }
  async function load() { $("#notice").textContent = "Загружаем заказы…"; const data = await api("/api/admin/orders"); orders = data.orders || []; render(); $("#notice").textContent = ""; await loadCatalog(); }
  $("#login-form").addEventListener("submit", async event => { event.preventDefault(); $("#login-error").textContent = ""; const form = new FormData(event.currentTarget); try { const token = form.get("cf-turnstile-response");
      if (!token) throw new Error("Пройдите проверку безопасности.");
      await api("/api/admin/login", { method:"POST", body:JSON.stringify({ username:form.get("username"), password:form.get("password"), turnstileToken:token }) });
      if (window.turnstile && adminTurnstileId !== null) window.turnstile.reset(adminTurnstileId);
      showDashboard(); await load(); } catch (error) { $("#login-error").textContent = error.message; if (window.turnstile && adminTurnstileId !== null) window.turnstile.reset(adminTurnstileId); } });
  $("#logout").addEventListener("click", async () => { try { await api("/api/admin/logout", {method:"POST"}); } finally { showLogin(); } });
  $("#refresh").addEventListener("click", () => load().catch(e => $("#notice").textContent = e.message));
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button)); render(); }));
  $("#orders").addEventListener("change", async event => { if (!event.target.matches("select[data-id]")) return; const select = event.target; select.disabled = true; try { await api(`/api/admin/orders/${encodeURIComponent(select.dataset.id)}/status`, {method:"PATCH", body:JSON.stringify({status:select.value})}); const order = orders.find(o => o.id === select.dataset.id); if (order) order.status = select.value; $("#notice").textContent = "Статус заказа обновлён."; render(); } catch (error) { $("#notice").textContent = error.message; await load(); } });
  $("#orders").addEventListener("click", async event => {
    const deleteButton = event.target.closest(".delete-order");
    if (deleteButton) {
      const id = deleteButton.dataset.id;
      if (!confirm(`Удалить заказ ${id}? Это действие нельзя отменить.`)) return;
      deleteButton.disabled = true;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(id)}`, { method:"DELETE" });
        orders = orders.filter(order => order.id !== id);
        render();
        $("#notice").textContent = `Заказ ${id} удалён.`;
      } catch (error) {
        $("#notice").textContent = error.message;
        deleteButton.disabled = false;
      }
      return;
    }
    const button = event.target.closest(".history-toggle"); if (!button) return; const target = document.getElementById(`history-${button.dataset.id}`); if (!target.hidden) { target.hidden = true; return; } target.hidden = false; target.textContent = "Загружаем историю…"; try { const data = await api(`/api/admin/orders/${encodeURIComponent(button.dataset.id)}/history`); target.innerHTML = data.history.length ? `<ul>${data.history.map(h => `<li>${esc(labels[h.new_status] || h.new_status)} <span class="muted">${esc(h.changed_at)}</span></li>`).join("")}</ul>` : "История пока пуста."; } catch (error) { target.textContent = error.message; } });
  api("/api/admin/me").then(() => { showDashboard(); return load(); }).catch(showLogin);
})();
