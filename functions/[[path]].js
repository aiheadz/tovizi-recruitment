const COOKIE = 'tr_admin';
const SESSION_TTL = 60 * 60 * 12;

function json(data, status=200, extraHeaders={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store'
    }, extraHeaders)
  });
}

function adminCookie(value, maxAge=SESSION_TTL) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const p = part.trim();
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i) === name) return p.slice(i + 1);
  }
  return null;
}

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function fromB64url(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign','verify']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
}

async function makeSession(secret) {
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is missing');
  const payload = `${Date.now()}:${crypto.randomUUID()}`;
  const sig = b64url(await hmac(secret, payload));
  return `${b64url(new TextEncoder().encode(payload))}.${sig}`;
}

async function validSession(request, env) {
  const token = getCookie(request, COOKIE);
  if (!token || !env.ADMIN_SESSION_SECRET) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  let payload;
  try {
    payload = new TextDecoder().decode(fromB64url(parts[0]));
    const pieces = payload.split(':');
    const issued = Number(pieces[0]);
    if (!Number.isFinite(issued) || Date.now() - issued > SESSION_TTL * 1000) return false;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.ADMIN_SESSION_SECRET),
      {name:'HMAC',hash:'SHA-256'},
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(parts[1]),
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

const ADMIN_HTML = "<!doctype html>\n<html lang=\"hu\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Tóvizi Recruitment – Admin</title>\n<style>\n*{box-sizing:border-box}body{margin:0;background:#f5f6f2;color:#111315;font-family:Arial,Helvetica,sans-serif}\n.wrap{max-width:1240px;margin:0 auto;padding:34px 24px}.brand{font-size:25px;font-weight:800;letter-spacing:-.04em}.brand span{font-weight:500}\n.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}\n.muted{color:#69706b}.panel,.stat{background:#fff;border:1px solid #e4e7e1;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.05)}\n.panel{padding:24px}.login{max-width:460px;margin:12vh auto;padding:34px}\nh1,h2{margin:0 0 10px;letter-spacing:-.035em}h1{font-size:34px}h2{font-size:24px}\n.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}.stat{padding:20px;color:#69706b}.stat b{display:block;color:#111315;font-size:34px;margin-top:7px}\n.tabs{display:flex;gap:8px;margin:18px 0}.tab,.btn{border:0;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer}\n.tab{background:#e9ece6;color:#3d433f}.tab.active,.btn{background:#b8ff3d;color:#111315}.btn.light{background:#edf0eb}.btn.red{background:#ffddd8}.btn.small{padding:7px 10px;font-size:12px}\ninput,textarea,select{width:100%;border:1px solid #d9ded7;border-radius:10px;padding:11px 12px;font:inherit;background:#fff}\n.form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.full{grid-column:1/-1}label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}\ntable{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #ecefea;vertical-align:top}th{font-size:12px;color:#69706b}\n.actions{display:flex;flex-wrap:wrap;gap:6px}.pill{display:inline-block;padding:5px 8px;border-radius:999px;background:#edf0eb;font-size:12px;font-weight:700}.pill.unread{background:#fff2bd}.pill.progress{background:#dff0ff}.pill.closed{background:#e7e9e6}\n.modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:20}.hidden{display:none!important}.modalbox{background:#fff;border-radius:18px;padding:24px;max-width:700px;width:100%;max-height:90vh;overflow:auto}\n.error{min-height:20px;color:#b42318;margin:10px 0}.generated-link{margin-top:16px;padding:14px;border:1px solid #dfe5db;border-radius:12px;background:#f8faf6}.generated-row{display:flex;gap:8px;margin-top:8px}.empty{padding:30px;text-align:center;color:#69706b}\ncode{font-size:12px;word-break:break-all}\n@media(max-width:850px){.grid{grid-template-columns:repeat(2,1fr)}table{display:block;overflow:auto}.form{grid-template-columns:1fr}}\n@media(max-width:520px){.wrap{padding:16px}.grid{grid-template-columns:1fr}.top{align-items:flex-start}.generated-row{flex-direction:column}}\n</style>\n</head>\n<body>\n<div id=\"app\"></div>\n<div id=\"modal\" class=\"hidden\"></div>\n<script>\n(function(){\n'use strict';\nvar app=document.getElementById('app');\nvar modal=document.getElementById('modal');\n\nasync function api(url,opt){\n  opt=opt||{};\n  var headers=Object.assign({'content-type':'application/json'},opt.headers||{});\n  var r=await fetch(url,Object.assign({},opt,{headers:headers}));\n  var text=await r.text();\n  var d={};\n  try{d=text?JSON.parse(text):{};}catch(e){throw new Error('A szerver nem JSON választ adott.');}\n  if(r.status===401){showLogin('');throw new Error('unauthorized');}\n  if(!r.ok)throw new Error(d.error||'Hiba történt.');\n  return d;\n}\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[m];});}\nfunction showLogin(msg){\n  app.innerHTML='<div class=\"login panel\"><div class=\"brand\">Tóvizi <span>Recruitment</span></div><h1>Admin belépés</h1><p class=\"muted\">A weboldal üzenetei és személyre szabott linkjei innen kezelhetők.</p><div class=\"error\">'+esc(msg||'')+'</div><input id=\"pw\" type=\"password\" placeholder=\"Admin jelszó\"><button id=\"loginBtn\" class=\"btn\" style=\"width:100%;margin-top:12px\">Belépés</button></div>';\n  document.getElementById('loginBtn').addEventListener('click',login);\n  document.getElementById('pw').addEventListener('keydown',function(e){if(e.key==='Enter')login();});\n}\nasync function login(){\n  try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});await load();}\n  catch(e){if(e.message!=='unauthorized')showLogin('Hibás jelszó.');}\n}\nasync function load(){\n  try{var s=await api('/api/admin/stats');render(s);}\n  catch(e){if(e.message!=='unauthorized')showLogin(e.message);}\n}\nfunction render(s){\n  app.innerHTML='<div class=\"wrap\"><div class=\"top\"><div><div class=\"brand\">Tóvizi <span>Recruitment</span></div><div class=\"muted\">Admin felület</div></div><button id=\"logoutBtn\" class=\"btn light\">Kilépés</button></div><div class=\"grid\"><div class=\"stat\">Összes üzenet<b>'+Number(s.stats.total||0)+'</b></div><div class=\"stat\">Olvasatlan<b>'+Number(s.stats.unread||0)+'</b></div><div class=\"stat\">Kezelés alatt<b>'+Number(s.stats.progress||0)+'</b></div><div class=\"stat\">Aktív link<b>'+Number(s.stats.links||0)+'</b></div></div><div class=\"tabs\"><button id=\"tabMessages\" class=\"tab active\">📩 Üzenetek</button><button id=\"tabLinks\" class=\"tab\">🔗 Személyre szabott linkek</button></div><section id=\"messages\" class=\"panel\"><div class=\"top\"><div><h2>Beérkezett üzenetek</h2><div class=\"muted\">Az űrlapról érkező megkeresések kezelése.</div></div><select id=\"filter\" style=\"max-width:190px\"><option value=\"all\">Összes</option><option value=\"unread\">Olvasatlan</option><option value=\"progress\">Kezelés alatt</option><option value=\"closed\">Lezárt</option></select></div><div id=\"messageList\"></div></section><section id=\"links\" class=\"panel hidden\"><div class=\"top\"><div><h2>Személyre szabott linkek</h2><div class=\"muted\">Névhez kötött, 6 számjegyű oldalak kezelése.</div></div><button id=\"newLinkBtn\" class=\"btn\">+ Új link</button></div><div id=\"linkList\"></div></section></div>';\n  document.getElementById('logoutBtn').addEventListener('click',logout);\n  document.getElementById('tabMessages').addEventListener('click',function(){switchTab('messages');});\n  document.getElementById('tabLinks').addEventListener('click',function(){switchTab('links');});\n  document.getElementById('filter').addEventListener('change',loadMessages);\n  document.getElementById('newLinkBtn').addEventListener('click',newLink);\n  loadMessages();\n}\nfunction switchTab(name){\n  document.getElementById('messages').classList.toggle('hidden',name!=='messages');\n  document.getElementById('links').classList.toggle('hidden',name!=='links');\n  document.getElementById('tabMessages').classList.toggle('active',name==='messages');\n  document.getElementById('tabLinks').classList.toggle('active',name==='links');\n  if(name==='links')loadLinks();\n}\nfunction statusHu(s){return s==='unread'?'Olvasatlan':s==='progress'?'Kezelés alatt':'Lezárt';}\nasync function loadMessages(){\n  var d=await api('/api/admin/messages?status='+encodeURIComponent(document.getElementById('filter').value));\n  var box=document.getElementById('messageList');\n  if(!d.items.length){box.innerHTML='<div class=\"empty\">Nincs ilyen üzenet.</div>';return;}\n  box.innerHTML='<table><thead><tr><th>Dátum</th><th>Érdeklődő</th><th>Elérhetőség</th><th>Üzenet</th><th>Státusz</th><th>Műveletek</th></tr></thead><tbody>'+d.items.map(function(x){\n    return '<tr><td>'+esc(x.created_at)+'</td><td><b>'+esc(x.name)+'</b><br><span class=\"muted\">'+esc(x.company||'')+'</span></td><td>'+esc(x.contact)+'</td><td>'+esc(x.message||'').slice(0,180)+'</td><td><span class=\"pill '+esc(x.status)+'\">'+statusHu(x.status)+'</span></td><td><div class=\"actions\"><button class=\"btn light small\" data-action=\"view\" data-id=\"'+x.id+'\">Megnyitás</button><button class=\"btn light small\" data-action=\"progress\" data-id=\"'+x.id+'\">Kezelés</button><button class=\"btn light small\" data-action=\"closed\" data-id=\"'+x.id+'\">Lezárás</button><button class=\"btn red small\" data-action=\"delete\" data-id=\"'+x.id+'\">Törlés</button></div></td></tr>';\n  }).join('')+'</tbody></table>';\n  box.querySelectorAll('button[data-action]').forEach(function(btn){\n    btn.addEventListener('click',function(){\n      var id=Number(btn.getAttribute('data-id')),a=btn.getAttribute('data-action');\n      if(a==='view')viewMsg(id); else if(a==='delete')delMsg(id); else setMsg(id,a);\n    });\n  });\n}\nasync function setMsg(id,status){await api('/api/admin/messages/'+id,{method:'PATCH',body:JSON.stringify({status:status})});await loadMessages();refreshStats();}\nasync function delMsg(id){if(!confirm('Biztosan törlöd ezt az üzenetet?'))return;await api('/api/admin/messages/'+id,{method:'DELETE'});await loadMessages();refreshStats();}\nasync function viewMsg(id){\n  var d=await api('/api/admin/messages/'+id),x=d.item;\n  modal.className='modal';\n  modal.innerHTML='<div class=\"modalbox\"><div class=\"top\"><h2>'+esc(x.name)+'</h2><button id=\"closeModalBtn\" class=\"btn light\">Bezárás</button></div><p><b>Cég:</b> '+esc(x.company||'—')+'</p><p><b>Elérhetőség:</b> '+esc(x.contact)+'</p><p><b>Érkezett:</b> '+esc(x.created_at)+'</p><p><b>Forrás:</b> '+esc(x.source_code?location.origin+'/'+x.source_code:'Normál oldal')+'</p><hr><p style=\"white-space:pre-wrap\">'+esc(x.message||'—')+'</p></div>';\n  document.getElementById('closeModalBtn').addEventListener('click',closeModal);\n  if(x.status==='unread')setMsg(id,'progress');\n}\nfunction closeModal(){modal.className='hidden';modal.innerHTML='';}\nfunction newLink(){\n  modal.className='modal';\n  modal.innerHTML='<div class=\"modalbox\"><div class=\"top\"><h2>Új személyre szabott link</h2><button id=\"closeNewLink\" class=\"btn light\">Bezárás</button></div><div class=\"form\"><div class=\"full\"><label>Teljes név</label><input id=\"fullName\" placeholder=\"Gipsz Jakab\"></div><div class=\"full\"><label>Megszólítás / keresztnév</label><input id=\"firstName\" placeholder=\"Jakab\"></div></div><button id=\"createLinkBtn\" class=\"btn\" style=\"margin-top:14px\">Link generálása</button><div id=\"generatedLink\" class=\"hidden\"></div></div>';\n  document.getElementById('closeNewLink').addEventListener('click',closeModal);\n  document.getElementById('createLinkBtn').addEventListener('click',createLink);\n}\nasync function createLink(){\n  var full_name=document.getElementById('fullName').value.trim(),first_name=document.getElementById('firstName').value.trim();\n  if(!full_name||!first_name){alert('A teljes név és a keresztnév is szükséges.');return;}\n  var d=await api('/api/admin/links',{method:'POST',body:JSON.stringify({full_name:full_name,first_name:first_name})});\n  await loadLinks();\n  var link=location.origin+'/'+d.code,box=document.getElementById('generatedLink');\n  box.className='generated-link';\n  box.innerHTML='<div><b>Elkészült a személyre szabott link</b></div><div class=\"generated-row\"><input id=\"generatedUrl\" value=\"'+esc(link)+'\" readonly><button id=\"copyGenerated\" class=\"btn\">Link másolása</button></div>';\n  document.getElementById('copyGenerated').addEventListener('click',function(){copyLink(d.code);});\n}\nasync function loadLinks(){\n  var d=await api('/api/admin/links'),box=document.getElementById('linkList');\n  if(!d.items.length){box.innerHTML='<div class=\"empty\">Még nincs személyre szabott link.</div>';return;}\n  box.innerHTML='<table><thead><tr><th>Név</th><th>Link</th><th>Megnyitás</th><th>Utolsó megnyitás</th><th>Státusz</th><th>Műveletek</th></tr></thead><tbody>'+d.items.map(function(x){\n    return '<tr><td><b>'+esc(x.full_name)+'</b><br><span class=\"muted\">'+esc(x.first_name)+'</span></td><td><code>'+esc(location.origin+'/'+x.code)+'</code></td><td>'+Number(x.visit_count||0)+'</td><td>'+esc(x.last_visit||'—')+'</td><td><span class=\"pill\">'+(x.active?'Aktív':'Deaktivált')+'</span></td><td><div class=\"actions\"><button class=\"btn light small\" data-action=\"copy\" data-id=\"'+x.code+'\">Link másolása</button><button class=\"btn light small\" data-action=\"toggle\" data-id=\"'+x.id+'\" data-active=\"'+(x.active?0:1)+'\">'+(x.active?'Deaktiválás':'Aktiválás')+'</button><button class=\"btn red small\" data-action=\"delete\" data-id=\"'+x.id+'\">Törlés</button></div></td></tr>';\n  }).join('')+'</tbody></table>';\n  box.querySelectorAll('button[data-action]').forEach(function(btn){\n    btn.addEventListener('click',function(){\n      var a=btn.getAttribute('data-action');\n      if(a==='copy')copyLink(btn.getAttribute('data-id'));\n      else if(a==='toggle')toggleLink(Number(btn.getAttribute('data-id')),Number(btn.getAttribute('data-active')));\n      else delLink(Number(btn.getAttribute('data-id')));\n    });\n  });\n}\nasync function toggleLink(id,active){await api('/api/admin/links/'+id,{method:'PATCH',body:JSON.stringify({active:!!active})});await loadLinks();refreshStats();}\nasync function delLink(id){if(!confirm('Biztosan törlöd ezt a személyre szabott linket?'))return;await api('/api/admin/links/'+id,{method:'DELETE'});await loadLinks();refreshStats();}\nasync function copyLink(code){try{await navigator.clipboard.writeText(location.origin+'/'+code);alert('Link kimásolva.');}catch(e){alert(location.origin+'/'+code);}}\nasync function logout(){await api('/api/admin/logout',{method:'POST'});showLogin('');}\nasync function refreshStats(){try{var s=await api('/api/admin/stats');var stats=document.querySelectorAll('.stat b');if(stats.length===4){stats[0].textContent=Number(s.stats.total||0);stats[1].textContent=Number(s.stats.unread||0);stats[2].textContent=Number(s.stats.progress||0);stats[3].textContent=Number(s.stats.links||0);}}catch(e){}}\nload();\n})();\n</script>\n</body>\n</html>";

async function apiHandler(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
    if (!env.ADMIN_PASSWORD || data.password !== env.ADMIN_PASSWORD) {
      return json({error:'Unauthorized'},401);
    }
    const session = await makeSession(env.ADMIN_SESSION_SECRET);
    return json({ok:true},200,{'set-cookie':adminCookie(session)});
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ok:true},200,{'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
  }

  if (!(await validSession(request, env))) return json({error:'Unauthorized'},401);

  if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
    const [stats, links] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) total, SUM(CASE WHEN status='unread' THEN 1 ELSE 0 END) unread, SUM(CASE WHEN status='progress' THEN 1 ELSE 0 END) progress FROM contacts"
      ).first(),
      env.DB.prepare("SELECT COUNT(*) links FROM personalized_links WHERE active=1").first()
    ]);
    return json({stats:{
      total:Number(stats?.total||0),
      unread:Number(stats?.unread||0),
      progress:Number(stats?.progress||0),
      links:Number(links?.links||0)
    }});
  }

  if (url.pathname === '/api/admin/messages' && request.method === 'GET') {
    const status = url.searchParams.get('status') || 'all';
    const q = status === 'all'
      ? env.DB.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 300')
      : env.DB.prepare('SELECT * FROM contacts WHERE status=? ORDER BY id DESC LIMIT 300').bind(status);
    return json({items:(await q.all()).results});
  }

  const msgMatch = url.pathname.match(/^\/api\/admin\/messages\/(\d+)$/);
  if (msgMatch) {
    const id = Number(msgMatch[1]);
    if (request.method === 'GET') {
      return json({item:await env.DB.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first()});
    }
    if (request.method === 'PATCH') {
      let data;
      try { data = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
      if (!['unread','progress','closed'].includes(data.status)) return json({error:'Invalid status'},400);
      await env.DB.prepare('UPDATE contacts SET status=? WHERE id=?').bind(data.status,id).run();
      return json({ok:true});
    }
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM contacts WHERE id=?').bind(id).run();
      return json({ok:true});
    }
  }

  if (url.pathname === '/api/admin/links' && request.method === 'GET') {
    return json({items:(await env.DB.prepare('SELECT * FROM personalized_links ORDER BY id DESC').all()).results});
  }

  if (url.pathname === '/api/admin/links' && request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
    const full_name = String(data.full_name||'').trim().slice(0,200);
    const first_name = String(data.first_name||'').trim().slice(0,100);
    if (!full_name || !first_name) return json({error:'Missing name'},400);

    let code = '';
    for (let i=0;i<50;i++) {
      const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
      const candidate = String(n).padStart(6,'0');
      const exists = await env.DB.prepare('SELECT id FROM personalized_links WHERE code=?').bind(candidate).first();
      if (!exists) { code = candidate; break; }
    }
    if (!code) return json({error:'Could not generate code'},500);

    await env.DB.prepare(
      'INSERT INTO personalized_links(code,full_name,first_name) VALUES(?,?,?)'
    ).bind(code,full_name,first_name).run();
    return json({ok:true,code});
  }

  const linkMatch = url.pathname.match(/^\/api\/admin\/links\/(\d+)$/);
  if (linkMatch) {
    const id = Number(linkMatch[1]);
    if (request.method === 'PATCH') {
      let data;
      try { data = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
      await env.DB.prepare('UPDATE personalized_links SET active=? WHERE id=?').bind(data.active?1:0,id).run();
      return json({ok:true});
    }
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM personalized_links WHERE id=?').bind(id).run();
      return json({ok:true});
    }
  }

  return json({error:'Not found'},404);
}

async function personalizedPage(request, env, code) {
  const row = await env.DB.prepare(
    'SELECT * FROM personalized_links WHERE code=? AND active=1'
  ).bind(code).first();

  if (!row) {
    return new Response('A keresett oldal nem található.',{
      status:404,
      headers:{'content-type':'text/plain; charset=UTF-8'}
    });
  }

  await env.DB.prepare(
    "UPDATE personalized_links SET visit_count=visit_count+1,last_visit=datetime('now') WHERE id=?"
  ).bind(row.id).run();

  const root = new URL('/',request.url);
  const original = await env.ASSETS.fetch(new Request(root.toString(),{method:'GET'}));
  if (!original.ok) return original;

  let html = await original.text();
  const first = String(row.first_name).replace(/[&<>"']/g,function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });

  const block = `<div class="personal-greeting"><span>${first},</span><strong>nézzük meg, hogyan segíthetünk.</strong></div>`;
  const css = `<style>.personal-greeting{display:flex;flex-direction:column;gap:2px;margin:0 0 22px;font-family:Manrope,Arial,sans-serif;line-height:1.04;letter-spacing:-.025em}.personal-greeting span{font-size:clamp(30px,4vw,52px);font-weight:800;color:#b8ff3d}.personal-greeting strong{font-size:clamp(25px,3vw,40px);font-weight:500;color:#111315}@media(max-width:760px){.personal-greeting{margin-bottom:18px}}</style>`;
  html = html.replace('<div class="eyebrow">Célzott recruitment</div>',block+'<div class="eyebrow">Célzott recruitment</div>');
  html = html.replace('</head>',css+'</head>');
  html = html.replace('</body>',`<script>window.__TR_PERSONALIZED__=true;window.__TR_CODE__='${code}';</script></body>`);

  return new Response(html,{
    headers:{
      'content-type':'text/html; charset=UTF-8',
      'cache-control':'no-store'
    }
  });
}

export async function onRequest(context) {
  const {request,env} = context;
  const url = new URL(request.url);

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    return new Response(ADMIN_HTML,{
      headers:{
        'content-type':'text/html; charset=UTF-8',
        'cache-control':'no-store'
      }
    });
  }

  if (url.pathname.startsWith('/api/')) return apiHandler(request,env);

  const m = url.pathname.match(/^\/(\d{6})\/?$/);
  if (m && request.method === 'GET') return personalizedPage(request,env,m[1]);

  if (request.method === 'GET' && url.pathname === '/') {
    const original = await env.ASSETS.fetch(request);
    if (!original.ok) return original;
    let html = await original.text();

    const injected = `<script>(function(){const f=document.getElementById('contactForm');if(!f)return;f.addEventListener('submit',async function(e){e.preventDefault();const inputs=f.querySelectorAll('input'),ta=f.querySelector('textarea');const payload={name:inputs[0]?.value||'',company:inputs[1]?.value||'',contact:inputs[2]?.value||'',message:ta?.value||'',source_code:window.__TR_CODE__||null};const b=f.querySelector('button');if(b)b.disabled=true;try{const r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error();const thanks=document.getElementById('thanks');if(thanks)thanks.hidden=false;f.reset()}catch(err){alert('Az üzenetet most nem sikerült elküldeni. Kérjük, próbáld újra.')}finally{if(b)b.disabled=false}})})();</script>`;
    html = html.replace('</body>',injected+'</body>');
    return new Response(html,{
      headers:{
        'content-type':'text/html; charset=UTF-8',
        'cache-control':'no-store'
      }
    });
  }

  if (url.pathname === '/api/contact' && request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
    if (!data.name || !data.contact) return json({error:'Missing required fields'},400);
    await env.DB.prepare(
      'INSERT INTO contacts(name,company,contact,message,source_code) VALUES(?,?,?,?,?)'
    ).bind(
      String(data.name).slice(0,200),
      String(data.company||'').slice(0,200),
      String(data.contact).slice(0,300),
      String(data.message||'').slice(0,5000),
      data.source_code ? String(data.source_code).slice(0,20) : null
    ).run();
    return json({ok:true});
  }

  return env.ASSETS.fetch(request);
}
