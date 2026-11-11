const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname !== "/api/orders" || request.method !== "POST") {
      return json({ success: false, error: "Not found" }, 404);
    }
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ success: false, error: "Origin not allowed" }, 403);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.SITE_JSON_URL) {
      return json({ success: false, error: "Order service is not configured yet." }, 503);
    }

    try {
      const body = await request.json();
      const customer = body.customer || {};
      const name = clean(customer.name, 100);
      const phone = clean(customer.phone, 30);
      const address = clean(customer.address, 200);
      const deliveryDate = clean(customer.deliveryDate, 10);
      const deliveryTime = clean(customer.deliveryTime, 30);
      const notes = clean(customer.notes, 500);
      if (name.length < 2 || phone.length < 6 || address.length < 5 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
          !["09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–21:00"].includes(deliveryTime)) {
        return json({ success: false, error: "Please complete all required delivery fields." }, 400);
      }
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
        return json({ success: false, error: "The basket is empty or invalid." }, 400);
      }

      // Re-read current catalog prices from the public site data; never trust browser-submitted prices.
      const catalogResponse = await fetch(env.SITE_JSON_URL, { cf: { cacheTtl: 60, cacheEverything: true } });
      if (!catalogResponse.ok) throw new Error("Could not verify product catalog");
      const catalog = await catalogResponse.json();
      const language = body.language === "en" ? "en" : "pl";
      const verifiedItems = [];
      for (const item of body.items) {
        const submittedName = clean(item.name, 120);
        const quantity = Number(item.quantity);
        const product = (catalog.products || []).find(p =>
          clean(p.name?.pl, 120) === submittedName || clean(p.name?.en, 120) === submittedName
        );
        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
          return json({ success: false, error: "One or more basket items could not be verified." }, 400);
        }
        verifiedItems.push({
          name: clean(product.name?.[language] || product.name?.pl || product.name?.en, 120),
          quantity,
          price: Number(product.price)
        });
      }
      const total = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid order total");

      const orderId = `GF-${Date.now().toString(36).toUpperCase()}`;
      const orderedAt = new Intl.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short"
      }).format(new Date());
      const itemLines = verifiedItems.map(item =>
        `• ${escapeHtml(item.name)} — ${item.quantity} × ${item.price} zł = ${item.quantity * item.price} zł`
      ).join("\n");
      const message = [
        "🌸 <b>NOWE ZAMÓWIENIE — GENT FLOWERS</b>",
        `<b>Numer:</b> ${escapeHtml(orderId)}`,
        `<b>Data i godzina zamówienia:</b> ${escapeHtml(orderedAt)}`,
        "",
        "<b>BUKIETY:</b>",
        itemLines,
        "",
        `<b>RAZEM: ${total} zł</b>`,
        "",
        "<b>DOSTAWA:</b>",
        `<b>Imię i nazwisko:</b> ${escapeHtml(name)}`,
        `<b>Telefon:</b> ${escapeHtml(phone)}`,
        `<b>Adres:</b> ${escapeHtml(address)}`,
        `<b>Data:</b> ${escapeHtml(deliveryDate)}`,
        `<b>Godzina:</b> ${escapeHtml(deliveryTime)}`,
        notes ? `<b>Uwagi:</b> ${escapeHtml(notes)}` : ""
      ].filter(Boolean).join("\n");

      const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML"
        })
      });
      const telegramResult = await telegramResponse.json();
      if (!telegramResponse.ok || !telegramResult.ok) {
        throw new Error("Telegram delivery failed");
      }
      return json({ success: true, orderId });
    } catch (error) {
      return json({ success: false, error: "The order could not be sent. Please try again." }, 502);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
