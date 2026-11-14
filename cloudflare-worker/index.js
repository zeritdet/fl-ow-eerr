const getAllowedOrigins = env => {
  const configured = [env.ALLOWED_ORIGIN || "", env.ALLOWED_ORIGINS || ""];
  const defaults = ["https://zeritdet.github.io", "https://fl-ow-eerr.pages.dev", "https://gentflowers.com", "https://www.gentflowers.com"];
  return new Set([...configured, ...defaults].flatMap(v => v.split(",")).map(v => v.trim().replace(/\/$/, "")).filter(Boolean));
};
const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin");
  const h = { Vary: "Origin", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true" };
  if (origin && getAllowedOrigins(env).has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
};
const json = (data, status = 200, request, env, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request, env), ...extra } });
const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const STATUSES = new Set(["NEW", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"]);
const COOKIE = "gf_admin_session";
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
async function sign(value, secret) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]); return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))); }
async function makeSession(env) { const payload = b64(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + 8*60*60*1000, nonce: crypto.randomUUID() }))); return `${payload}.${await sign(payload, env.ADMIN_SESSION_SECRET)}`; }
async function validSession(request, env) { try { const raw = (request.headers.get("Cookie") || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1); if(!raw || !env.ADMIN_SESSION_SECRET) return false; const [p,s] = raw.split("."); if(!p || !s || !(await sign(p,env.ADMIN_SESSION_SECRET) === s)) return false; const data=JSON.parse(new TextDecoder().decode(unb64(p))); return data.exp > Date.now(); } catch { return false; } }
const cookie = value => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=28800`;
const clearCookie = `${COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  try {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET_KEY);
    form.append("response", token);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) form.append("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method:"POST", body:form });
    const result = await response.json();
    return result.success === true && (!result.hostname || ["gentflowers.com","www.gentflowers.com"].includes(result.hostname));
  } catch { return false; }
}
function authError(req,env){ return json({success:false,error:"Необходима авторизация."},401,req,env); }
async function adminRoute(request, env, url) {
  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({error:"Авторизация не настроена."},503,request,env);
    const body=await request.json().catch(()=>({}));
    if (!(await verifyTurnstile(body.turnstileToken, request, env))) return json({error:"Проверка безопасности не пройдена. Обновите проверку и попробуйте снова."},403,request,env);
    if (clean(body.username,100)!==env.ADMIN_USERNAME || clean(body.password,500)!==env.ADMIN_PASSWORD) return json({error:"Неверный логин или пароль."},401,request,env);
    return json({success:true},200,request,env,{"Set-Cookie":cookie(await makeSession(env))});
  }
  if (request.method === "POST" && url.pathname === "/api/admin/logout") return json({success:true},200,request,env,{"Set-Cookie":clearCookie});
  if (!(await validSession(request,env))) return authError(request,env);
  if (request.method === "GET" && url.pathname === "/api/admin/me") return json({success:true},200,request,env);
  if (request.method === "GET" && url.pathname === "/api/admin/orders") {
    const {results=[]}=await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();
    return json({orders:results.map(o=>({...o,items:JSON.parse(o.items_json||"[]")}))},200,request,env);
  }
  const deleteMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1]);
    const order = await env.DB.prepare("SELECT id FROM orders WHERE id=?").bind(id).first();
    if (!order) return json({ error: "Заказ не найден." }, 404, request, env);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM order_status_history WHERE order_id=?").bind(id),
      env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id)
    ]);
    return json({ success: true, deletedId: id }, 200, request, env);
  }
  const match=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
  if (request.method === "PATCH" && match) {
    const id=decodeURIComponent(match[1]); const body=await request.json().catch(()=>({})); const status=clean(body.status,30);
    if(!STATUSES.has(status)) return json({error:"Недопустимый статус."},400,request,env);
    const order=await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(id).first();
    if(!order) return json({error:"Заказ не найден."},404,request,env);
    if(order.status!==status){ await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id),
      env.DB.prepare("INSERT INTO order_status_history(order_id,old_status,new_status) VALUES(?,?,?)").bind(id,order.status,status)
    ]); }
    return json({success:true,status},200,request,env);
  }
  const history=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/history$/);
  if(request.method === "GET" && history){ const id=decodeURIComponent(history[1]); const {results=[]}=await env.DB.prepare("SELECT old_status,new_status,changed_at FROM order_status_history WHERE order_id=? ORDER BY changed_at DESC,id DESC").bind(id).all(); return json({history:results},200,request,env); }
  return json({error:"Not found"},404,request,env);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS"){const origin=request.headers.get("Origin"); if(origin&&!getAllowedOrigins(env).has(origin)) return new Response(null,{status:403,headers:corsHeaders(request,env)}); return new Response(null,{status:204,headers:corsHeaders(request,env)});}
  const origin=request.headers.get("Origin"); if(origin&&!getAllowedOrigins(env).has(origin)) return json({success:false,error:"Origin not allowed"},403,request,env);
  if (request.method === "GET" && url.pathname === "/api/track") {
    try {
      const orderId = clean(url.searchParams.get("orderId"), 40).toUpperCase();
      const phone = clean(url.searchParams.get("phone"), 30).replace(/[^0-9]/g, "");
      if (!/^GF-[A-Z0-9]+$/.test(orderId) || phone.length < 6) {
        return json({ success:false, error:"Podaj poprawny numer zamówienia i telefon." },400,request,env);
      }
      const order = await env.DB.prepare(
        "SELECT id, customer_phone, status, ordered_at, delivery_date, delivery_time FROM orders WHERE id=?"
      ).bind(orderId).first();
      const storedPhone = String(order?.customer_phone || "").replace(/[^0-9]/g, "");
      if (!order || storedPhone !== phone) {
        return json({ success:false, error:"Nie znaleziono zamówienia. Sprawdź numer i telefon." },404,request,env);
      }
      const { results=[] } = await env.DB.prepare(
        "SELECT new_status, changed_at FROM order_status_history WHERE order_id=? ORDER BY changed_at ASC, id ASC"
      ).bind(orderId).all();
      return json({ success:true, order:{
        id:order.id, status:order.status, orderedAt:order.ordered_at,
        deliveryDate:order.delivery_date, deliveryTime:order.delivery_time,
        history:results
      }},200,request,env);
    } catch(error) {
      console.error("Order tracking failed:",error?.message||error);
      return json({success:false,error:"Nie udało się pobrać statusu zamówienia."},500,request,env);
    }
  }
  if(url.pathname.startsWith("/api/admin/")) { try{return await adminRoute(request,env,url);}catch(e){console.error("Admin API failed",e?.message||e);return json({error:"Ошибка административного API."},500,request,env);} }
  if(url.pathname!=="/api/orders"||request.method!=="POST") return json({success:false,error:"Not found"},404,request,env);
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID||!env.SITE_JSON_URL||!env.DB) return json({success:false,error:"Order service is not configured."},503,request,env);
  try{
   const body=await request.json();
   if (!(await verifyTurnstile(body.turnstileToken, request, env))) return json({success:false,error:"Проверка безопасности не пройдена. Обновите проверку и попробуйте снова."},403,request,env);
   const c=body.customer||{};
   const name=clean(c.name,100),phone=clean(c.phone,30),address=clean(c.address,200),deliveryDate=clean(c.deliveryDate,10),deliveryTime=clean(c.deliveryTime,30),notes=clean(c.notes,500);
   if(name.length<2||phone.length<6||address.length<5||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(deliveryDate)||!["09:00–12:00","12:00–15:00","15:00–18:00","18:00–21:00"].includes(deliveryTime)) return json({success:false,error:"Please complete all required delivery fields."},400,request,env);
   if(!Array.isArray(body.items)||body.items.length<1||body.items.length>30) return json({success:false,error:"The basket is empty or invalid."},400,request,env);
   const catalogResponse=await fetch(env.SITE_JSON_URL,{cf:{cacheTtl:60,cacheEverything:true}}); if(!catalogResponse.ok) throw new Error("Could not verify product catalog");
   const catalog=await catalogResponse.json(); const language=body.language==="en"?"en":"pl"; const verifiedItems=[];
   for(const item of body.items){const submittedName=clean(item.name,120),quantity=Number(item.quantity);const product=(catalog.products||[]).find(p=>clean(p.name?.pl,120)===submittedName||clean(p.name?.en,120)===submittedName);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>50)return json({success:false,error:"One or more basket items could not be verified."},400,request,env);const price=Number(product.price);if(!Number.isFinite(price)||price<=0)throw new Error("Invalid catalog price");const wrapNames = new Set(["Transparentny","Biały","Czarny","Różowy","Czerwony","Kremowy","Jasnoróżowy","Bez celofanu"]);
     const celofan = clean(item.celofan || "Transparentny",40);
     if (!wrapNames.has(celofan)) return json({success:false,error:"Invalid wrapping option."},400,request,env);
     const submittedColor = clean(item.bouquetColor || "", 60);
     const submittedHex = clean(item.bouquetColorHex || "", 10);
     let bouquetColor = "";
     if (submittedColor) {
       const palette = Array.isArray(product.palette) ? product.palette : [];
       const match = palette.find(c => clean(c.name?.[language] || c.name?.pl || c.name?.en, 60) === submittedColor && clean(c.hex || "", 10).toLowerCase() === submittedHex.toLowerCase());
       if (!match) return json({success:false,error:"Invalid bouquet color."},400,request,env);
       bouquetColor = clean(match.name?.[language] || match.name?.pl || match.name?.en,60);
     }
     verifiedItems.push({name:clean(product.name?.[language]||product.name?.pl||product.name?.en,120),quantity,price,celofan,bouquetColor});}
   const total=verifiedItems.reduce((s,i)=>s+i.price*i.quantity,0); if(!Number.isFinite(total)||total<=0)throw new Error("Invalid order total");
   const orderId=`GF-${Date.now().toString(36).toUpperCase()}`; const now=new Date(); const orderedAt=new Intl.DateTimeFormat("pl-PL",{timeZone:"Europe/Warsaw",dateStyle:"short",timeStyle:"short"}).format(now);
   // Persist before notification: a Telegram outage must not erase a customer's order.
   await env.DB.prepare("INSERT INTO orders (id,customer_name,customer_phone,customer_address,delivery_date,delivery_time,notes,language,items_json,total,status,ordered_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId,name,phone,address,deliveryDate,deliveryTime,notes,language,JSON.stringify(verifiedItems),total,"NEW",orderedAt).run();
   await env.DB.prepare("INSERT INTO order_status_history(order_id,old_status,new_status) VALUES(?,?,?)").bind(orderId,null,"NEW").run();
   const itemLines=verifiedItems.map(i=>`• ${esc(i.name)} — ${i.quantity} × ${i.price} zł = ${i.quantity*i.price} zł\n  <b>Kolor bukietu:</b> ${esc(i.bouquetColor || "Domyślny")}\n  <b>Celofan:</b> ${esc(i.celofan)}`).join("\n");
   const message=["🌸 <b>NOWE ZAMÓWIENIE — GENT FLOWERS</b>",`<b>Numer:</b> ${esc(orderId)}`,`<b>Data i godzina zamówienia:</b> ${esc(orderedAt)}`,"","<b>BUKIETY:</b>",itemLines,"",`<b>RAZEM: ${total} zł</b>`,"","<b>DOSTAWA:</b>",`<b>Imię i nazwisko:</b> ${esc(name)}`,`<b>Telefon:</b> ${esc(phone)}`,`<b>Adres:</b> ${esc(address)}`,`<b>Data:</b> ${esc(deliveryDate)}`,`<b>Godzina:</b> ${esc(deliveryTime)}`,notes?`<b>Uwagi:</b> ${esc(notes)}`:""].filter(Boolean).join("\n");
   const tg=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message,parse_mode:"HTML"})}); const result=await tg.json();
   if(!tg.ok||!result.ok){console.error("Telegram notification failed for saved order",orderId);return json({success:true,orderId,notificationPending:true},200,request,env);}
   return json({success:true,orderId},200,request,env);
  }catch(error){console.error("Order processing failed:",error?.message||error);return json({success:false,error:"The order could not be sent. Please try again."},502,request,env);}
 }
};
