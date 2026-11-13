(() => {
  const API = "https://gent-flowers-orders.zeritdet.workers.dev";
  const form = document.querySelector("#trackingForm");
  const button = document.querySelector("#trackButton");
  const message = document.querySelector("#trackingMessage");
  const result = document.querySelector("#trackingResult");
  const labels = {NEW:"Заказ принят",CONFIRMED:"Заказ подтверждён",PREPARING:"Букет готовится",DELIVERING:"Передан курьеру",COMPLETED:"Доставлен",CANCELLED:"Заказ отменён"};
  const flow = ["NEW","CONFIRMED","PREPARING","DELIVERING","COMPLETED"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    result.hidden = true; result.innerHTML = ""; message.textContent = "";
    const data = new FormData(form);
    const orderId = String(data.get("orderId") || "").trim().toUpperCase();
    const phone = String(data.get("phone") || "").trim();
    if (!orderId || !phone) { message.textContent = "Wypełnij oba pola."; return; }
    button.disabled = true; button.textContent = "Sprawdzanie…";
    try {
      const url = new URL(API + "/api/track");
      url.searchParams.set("orderId",orderId); url.searchParams.set("phone",phone);
      const response = await fetch(url,{cache:"no-store"});
      const payload = await response.json().catch(()=>({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Nie udało się znaleźć zamówienia.");
      const order = payload.order;
      const current = order.status;
      const isCancelled = current === "CANCELLED";
      const currentIndex = flow.indexOf(current);
      const timeline = (order.history || []).map(item => `<li class="done"><strong>${esc(labels[item.new_status] || item.new_status)}</strong><time>${esc(item.changed_at || "")}</time></li>`).join("");
      result.innerHTML = `<div class="result-head"><h2>${esc(order.id)}</h2><span class="status-pill">${esc(labels[current] || current)}</span></div><p class="result-meta">Planowana dostawa: <strong>${esc(order.deliveryDate || "—")}</strong> · ${esc(order.deliveryTime || "")}</p>${isCancelled ? '<p>To zamówienie zostało anulowane. Skontaktuj się z nami, jeśli potrzebujesz pomocy.</p>' : `<ol class="timeline">${flow.map((status,index)=>`<li class="${index <= currentIndex ? "done" : ""}"><strong>${esc(labels[status])}</strong></li>`).join("")}</ol>`}<details><summary>Historia zmian statusu</summary><ol class="timeline">${timeline || "<li>Brak historii statusów.</li>"}</ol></details>`;
      result.hidden = false;
    } catch(error) { message.textContent = error.message || "Błąd połączenia. Spróbuj ponownie."; }
    finally { button.disabled = false; button.innerHTML = 'Sprawdź status <span>→</span>'; }
  });
})();
