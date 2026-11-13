(() => {
  const API_URL = "https://gent-flowers-orders.zeritdet.workers.dev/api/track";
  const form = document.getElementById("trackingForm");
  const result = document.getElementById("trackingResult");
  const message = document.getElementById("trackingMessage");
  const button = document.getElementById("trackButton");
  const STATUS = { NEW:"Zamówienie przyjęte", CONFIRMED:"Zamówienie potwierdzone", PREPARING:"Bukiet jest przygotowywany", DELIVERING:"Przekazano kurierowi", COMPLETED:"Dostarczono", CANCELLED:"Zamówienie anulowane" };
  const FLOW = ["NEW","CONFIRMED","PREPARING","DELIVERING","COMPLETED"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const date = value => { if (!value) return ""; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("pl-PL",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Warsaw"}).format(d); };
  function render(order) {
    const status = String(order.status || "NEW").toUpperCase();
    const history = Array.isArray(order.history) ? order.history : [];
    const index = FLOW.indexOf(status);
    const steps = status === "CANCELLED" ? ["NEW","CANCELLED"] : FLOW;
    const timeline = steps.map((code,i) => {
      const event = history.find(item => item.new_status === code);
      const done = code === "CANCELLED" ? status === code : index >= 0 && i <= index;
      return `<li class="${done ? "done" : ""}"><strong>${esc(STATUS[code])}</strong>${event?.changed_at ? `<time>${esc(date(event.changed_at))}</time>` : ""}</li>`;
    }).join("");
    const historyItems = history.length ? [...history].reverse().map(item => `<li><strong>${esc(STATUS[item.new_status] || item.new_status)}</strong><time>${esc(date(item.changed_at))}</time></li>`).join("") : `<li>Brak wcześniejszych zmian statusu.</li>`;
    result.innerHTML = `<div class="result-head"><h2>${esc(order.id)}</h2><span class="status-pill">${esc(STATUS[status] || "Status zamówienia")}</span></div><p class="result-meta">Planowana dostawa: <strong>${esc(order.deliveryDate || "—")}</strong> · ${esc(order.deliveryTime || "")}</p><ol class="timeline">${timeline}</ol><details class="tracking-history"><summary>Historia zmian statusu</summary><ol class="timeline history-timeline">${historyItems}</ol></details>`;
    result.hidden = false;
  }
  form?.addEventListener("submit", async event => {
    event.preventDefault(); result.hidden = true; message.textContent = "";
    const orderId = form.elements.orderId.value.trim().toUpperCase();
    const phone = form.elements.phone.value.trim();
    if (!orderId || !phone) { message.textContent = "Wpisz numer zamówienia i numer telefonu."; return; }
    button.disabled = true; button.textContent = "Sprawdzanie…";
    try {
      const url = new URL(API_URL); url.searchParams.set("orderId",orderId); url.searchParams.set("phone",phone);
      const response = await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.success || !data.order) throw new Error(data.error || "Nie znaleziono zamówienia. Sprawdź numer i telefon.");
      render(data.order);
    } catch (error) { message.textContent = error.message || "Nie udało się pobrać statusu zamówienia. Spróbuj ponownie."; }
    finally { button.disabled = false; button.innerHTML = 'Sprawdź status <span>→</span>'; }
  });
})();
