(() => {
  const API = "https://gent-flowers-orders.zeritdet.workers.dev";
  const $ = s => document.querySelector(s);
  let orders = [], filter = "ALL";
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
  function render() {
    const visible = orders.filter(o => filter === "ALL" || (filter === "IN_PROGRESS" ? ["CONFIRMED","PREPARING","DELIVERING"].includes(o.status) : filter === "COMPLETED" ? ["COMPLETED","CANCELLED"].includes(o.status) : o.status === filter));
    $("#count").textContent = `Всего заказов: ${orders.length} · Показано: ${visible.length}`;
    $("#orders").innerHTML = visible.length ? visible.map(o => `<article class="order"><div class="order-top"><div><h2>${esc(o.id)}</h2><div class="muted">${esc(o.ordered_at || o.created_at || "")}</div></div><strong>${Number(o.total).toFixed(2)} zł</strong></div><div class="order-grid"><p><b>Клиент:</b> ${esc(o.customer_name)}<br><b>Телефон:</b> <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></p><p><b>Адрес:</b> ${esc(o.customer_address)}<br><b>Доставка:</b> ${esc(o.delivery_date)} · ${esc(o.delivery_time)}</p></div><b>Товары:</b><ul>${(o.items || []).map(i => `<li>${esc(i.name)} — ${Number(i.quantity)} × ${Number(i.price).toFixed(2)} zł</li>`).join("")}</ul>${o.notes ? `<p><b>Комментарий:</b> ${esc(o.notes)}</p>` : ""}<div class="order-bottom"><label class="status-label">Статус<select class="status" data-id="${esc(o.id)}">${Object.entries(labels).map(([v,l]) => `<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><button class="secondary history-toggle" data-id="${esc(o.id)}">История статусов</button></div><div class="history" id="history-${esc(o.id)}" hidden></div></article>`).join("") : '<div class="panel">Заказов в этой категории пока нет.</div>';
  }
  async function load() { $("#notice").textContent = "Загружаем заказы…"; const data = await api("/api/admin/orders"); orders = data.orders || []; render(); $("#notice").textContent = ""; }
  $("#login-form").addEventListener("submit", async event => { event.preventDefault(); $("#login-error").textContent = ""; const form = new FormData(event.currentTarget); try { await api("/api/admin/login", { method:"POST", body:JSON.stringify({ username:form.get("username"), password:form.get("password") }) }); showDashboard(); await load(); } catch (error) { $("#login-error").textContent = error.message; } });
  $("#logout").addEventListener("click", async () => { try { await api("/api/admin/logout", {method:"POST"}); } finally { showLogin(); } });
  $("#refresh").addEventListener("click", () => load().catch(e => $("#notice").textContent = e.message));
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button)); render(); }));
  $("#orders").addEventListener("change", async event => { if (!event.target.matches("select[data-id]")) return; const select = event.target; select.disabled = true; try { await api(`/api/admin/orders/${encodeURIComponent(select.dataset.id)}/status`, {method:"PATCH", body:JSON.stringify({status:select.value})}); const order = orders.find(o => o.id === select.dataset.id); if (order) order.status = select.value; $("#notice").textContent = "Статус заказа обновлён."; render(); } catch (error) { $("#notice").textContent = error.message; await load(); } });
  $("#orders").addEventListener("click", async event => { const button = event.target.closest(".history-toggle"); if (!button) return; const target = document.getElementById(`history-${button.dataset.id}`); if (!target.hidden) { target.hidden = true; return; } target.hidden = false; target.textContent = "Загружаем историю…"; try { const data = await api(`/api/admin/orders/${encodeURIComponent(button.dataset.id)}/history`); target.innerHTML = data.history.length ? `<ul>${data.history.map(h => `<li>${esc(labels[h.new_status] || h.new_status)} <span class="muted">${esc(h.changed_at)}</span></li>`).join("")}</ul>` : "История пока пуста."; } catch (error) { target.textContent = error.message; } });
  api("/api/admin/me").then(() => { showDashboard(); return load(); }).catch(showLogin);
})();
