const getAllowedOrigins = (env) => {
  const configured = [env.ALLOWED_ORIGIN || "", env.ALLOWED_ORIGINS || ""];
  const defaults = ["https://zeritdet.github.io","https://fl-ow-eerr.pages.dev","https://gentflowers.com","https://www.gentflowers.com"];
  return new Set([...configured, ...defaults].flatMap(v => v.split(",")).map(v => v.trim().replace(/\/$/, "")).filter(Boolean));
};
const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin");
  const headers = {"Vary":"Origin","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Credentials":"true"};
  if (origin && getAllowedOrigins(env).has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};
const json = (data,status=200,request,env) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...corsHeaders(request,env)}});
const clean = (v,max=500) => String(v ?? "").trim().slice(0,max);
const escapeHtml = v => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cookieName = "gf_admin_session";
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function sign(value,secret) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
}
async function makeSession(secret) {
  const payload=b64(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));
  return `${payload}.${await sign(payload,secret)}`;
}
async function validSession(request,secret) {
  const raw=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1);
  if(!raw||!secret)return false;
  const [payload,sig]=raw.split(".");
  if(!payload||!sig)return false;
  const expected=await sign(payload,secret);
  if(sig.length!==expected.length)return false;
  let same=true; for(let i=0;i<sig.length;i++) if(sig.charCodeAt(i)!==expected.charCodeAt(i))same=false;
  if(!same)return false;
  try{return JSON.parse(new TextDecoder().decode(fromB64(payload))).exp>Date.now()}catch{return false}
}
const sessionCookie = value => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=28800`;
const clearCookie = () => `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
async function admin(request,env,url) {
  if(!env.DB)return json({success:false,error:"Database binding DB is missing."},503,request,env);
  if(url.pathname==="/api/admin/login"&&request.method==="POST"){
    if(!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return json({success:false,error:"Admin secrets are not configured."},503,request,env);
    const body=await request.json().catch(()=>({}));
    if(clean(body.username,80)!==(env.ADMIN_USERNAME||"gentflower!")||String(body.password||"")!==env.ADMIN_PASSWORD)return json({success:false,error:"Nieprawidłowy login lub hasło."},401,request,env);
    const token=await makeSession(env.ADMIN_SESSION_SECRET);
    return new Response(JSON.stringify({success:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...corsHeaders(request,env),"Set-Cookie":sessionCookie(token)}});
  }
  if(url.pathname==="/api/admin/logout"&&request.method==="POST"){
    return new Response(JSON.stringify({success:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...corsHeaders(request,env),"Set-Cookie":clearCookie()}});
  }
  if(!await validSession(request,env.ADMIN_SESSION_SECRET))return json({success:false,error:"Unauthorized"},401,request,env);
  if(url.pathname==="/api/admin/me"&&request.method==="GET")return json({success:true,username:env.ADMIN_USERNAME||"gentflower!"},200,request,env);
  if(url.pathname==="/api/admin/orders"&&request.method==="GET"){
    const limit=Math.min(Math.max(Number(url.searchParams.get("limit"))||100,1),200);
    const {results=[]}=await env.DB.prepare("SELECT id, customer_name, phone, address, delivery_date, delivery_time, notes, items_json, total, language, status, ordered_at FROM orders ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return json({success:true,orders:results.map(r=>({...r,items:JSON.parse(r.items_json||"[]")}))},200,request,env);
  }
  const match=url.pathname.match(/^\/api\/admin\/orders\/([A-Za-z0-9-]+)\/status$/);
  if(match&&request.method==="PATCH"){
    const body=await request.json().catch(()=>({}));
    const allowed=["NEW","CONFIRMED","PREPARING","DELIVERING","COMPLETED","CANCELLED"];
    if(!allowed.includes(body.status))return json({success:false,error:"Invalid status"},400,request,env);
    const result=await env.DB.prepare("UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.status,match[1]).run();
    if(!result.meta?.changes)return json({success:false,error:"Order not found"},404,request,env);
    return json({success:true},200,request,env);
  }
  return json({success:false,error:"Not found"},404,request,env);
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS"){
   const origin=request.headers.get("Origin");
   if(origin&&!getAllowedOrigins(env).has(origin))return new Response(null,{status:403,headers:corsHeaders(request,env)});
   return new Response(null,{status:204,headers:corsHeaders(request,env)});
  }
  if(url.pathname.startsWith("/api/admin/")) {
   const origin=request.headers.get("Origin");
   if(origin&&!getAllowedOrigins(env).has(origin))return json({success:false,error:"Origin not allowed"},403,request,env);
   try{return await admin(request,env,url)}catch(e){console.error("Admin API:",e?.message||e);return json({success:false,error:"Admin request failed"},500,request,env)}
  }
  if(url.pathname!=="/api/orders"||request.method!=="POST")return json({success:false,error:"Not found"},404,request,env);
  const origin=request.headers.get("Origin");
  if(origin&&!getAllowedOrigins(env).has(origin))return json({success:false,error:"Origin not allowed"},403,request,env);
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID||!env.SITE_JSON_URL)return json({success:false,error:"Order service is not configured yet. Check Worker variables."},503,request,env);
  try{
   const body=await request.json(),customer=body.customer||{};
   const name=clean(customer.name,100),phone=clean(customer.phone,30),address=clean(customer.address,200),deliveryDate=clean(customer.deliveryDate,10),deliveryTime=clean(customer.deliveryTime,30),notes=clean(customer.notes,500);
   if(name.length<2||phone.length<6||address.length<5||!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)||!["09:00–12:00","12:00–15:00","15:00–18:00","18:00–21:00"].includes(deliveryTime))return json({success:false,error:"Please complete all required delivery fields."},400,request,env);
   if(!Array.isArray(body.items)||body.items.length<1||body.items.length>30)return json({success:false,error:"The basket is empty or invalid."},400,request,env);
   const cr=await fetch(env.SITE_JSON_URL,{cf:{cacheTtl:60,cacheEverything:true}});if(!cr.ok)throw new Error("Could not verify product catalog");
   const catalog=await cr.json(),language=body.language==="en"?"en":"pl",verifiedItems=[];
   for(const item of body.items){
    const submittedName=clean(item.name,120),quantity=Number(item.quantity);
    const product=(catalog.products||[]).find(p=>clean(p.name?.pl,120)===submittedName||clean(p.name?.en,120)===submittedName);
    if(!product||!Number.isInteger(quantity)||quantity<1||quantity>50)return json({success:false,error:"One or more basket items could not be verified."},400,request,env);
    verifiedItems.push({name:clean(product.name?.[language]||product.name?.pl||product.name?.en,120),quantity,price:Number(product.price)});
   }
   const total=verifiedItems.reduce((s,i)=>s+i.price*i.quantity,0);if(!Number.isFinite(total)||total<=0)throw new Error("Invalid order total");
   const orderId=`GF-${Date.now().toString(36).toUpperCase()}`;
   const orderedAt=new Intl.DateTimeFormat("pl-PL",{timeZone:"Europe/Warsaw",dateStyle:"short",timeStyle:"short"}).format(new Date());
   const itemLines=verifiedItems.map(i=>`• ${escapeHtml(i.name)} — ${i.quantity} × ${i.price} zł = ${i.quantity*i.price} zł`).join("\n");
   const message=["🌸 <b>NOWE ZAMÓWIENIE — GENT FLOWERS</b>",`<b>Numer:</b> ${escapeHtml(orderId)}`,`<b>Data i godzina zamówienia:</b> ${escapeHtml(orderedAt)}`,"","<b>BUKIETY:</b>",itemLines,"",`<b>RAZEM: ${total} zł</b>`,"","<b>DOSTAWA:</b>",`<b>Imię i nazwisko:</b> ${escapeHtml(name)}`,`<b>Telefon:</b> ${escapeHtml(phone)}`,`<b>Adres:</b> ${escapeHtml(address)}`,`<b>Data:</b> ${escapeHtml(deliveryDate)}`,`<b>Godzina:</b> ${escapeHtml(deliveryTime)}`,notes?`<b>Uwagi:</b> ${escapeHtml(notes)}`:""].filter(Boolean).join("\n");
   if(env.DB)await env.DB.prepare("INSERT INTO orders (id,customer_name,phone,address,delivery_date,delivery_time,notes,items_json,total,language,status,ordered_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId,name,phone,address,deliveryDate,deliveryTime,notes,JSON.stringify(verifiedItems),total,language,"NEW",orderedAt).run();
   const tr=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message,parse_mode:"HTML"})});
   const telegramResult=await tr.json();if(!tr.ok||!telegramResult.ok)throw new Error("Telegram delivery failed");
   return json({success:true,orderId},200,request,env);
  }catch(error){console.error("Order processing failed:",error?.message||error);return json({success:false,error:"The order could not be sent. Please try again."},502,request,env)}
 }
};
