const COOKIE = 'tr_admin_session';
const CODE_RE = /^\/[0-9]{6}\/?$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store'
    }
  });
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function makeSession(secret) {
  const payload = `${Date.now()}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

async function validSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));

  if (!m || !env.ADMIN_SESSION_SECRET) return false;

  const [ts, sig] = m[1].split('.');

  if (
    !ts ||
    !sig ||
    Date.now() - Number(ts) > 1000 * 60 * 60 * 24 * 7
  ) {
    return false;
  }

  return sig === await hmac(env.ADMIN_SESSION_SECRET, ts);
}

function adminCookie(value) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function noStore(res) {
  const h = new Headers(res.headers);
  h.set('cache-control', 'no-store');
  return new Response(res.body, {
    status: res.status,
    headers: h
  });
}

const ADMIN_HTML = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tóvizi Recruitment — Admin</title><style>
:root{--ink:#111315;--muted:#697177;--paper:#f5f6f2;--white:#fff;--line:#e1e3de;--accent:#b8ff3d;--red:#e55353}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,sans-serif}
.wrap{max-width:1180px;margin:auto;padding:28px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.brand{font-weight:800;font-size:22px}
.brand span{color:#7ea914}
.btn{border:1px solid var(--ink);background:var(--ink);color:white;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700}
.btn.light{background:white;color:var(--ink)}
.btn.red{background:var(--red);border-color:var(--red)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.stat,.panel{background:white;border:1px solid var(--line);border-radius:16px;padding:20px}
.stat b{display:block;font-size:30px;margin-top:8px}
.muted{color:var(--muted)}
.tabs{display:flex;gap:8px;margin:24px 0}
.tab{padding:10px 14px;border:1px solid var(--line);background:white;border-radius:10px;cursor:pointer}
.tab.active{background:var(--ink);color:white}
.hidden{display:none!important}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;color:var(--muted)}
.pill{display:inline-block;padding:5px 9px;border-radius:999px;background:#eef0eb;font-size:12px;font-weight:700}
.pill.unread{background:#eaffbd}
.actions{display:flex;gap:7px;flex-wrap:wrap}
.small{padding:7px 9px;font-size:12px}
.form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form .full{grid-column:1/-1}
input,textarea,select{width:100%;padding:12px;border:1px solid #d5d9d3;border-radius:9px;font:inherit;background:white}
textarea{min-height:100px}
.empty{padding:30px;text-align:center;color:var(--muted)}
.login{max-width:420px;margin:12vh auto}
.error{color:#b42318;margin:10px 0}
.modal{position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;padding:20px}
.modalbox{background:white;max-width:720px;width:100%;border-radius:18px;padding:24px;max-height:85vh;overflow:auto}
@media(max-width:800px){
.grid{grid-template-columns:1fr 1fr}
.form{grid-template-columns:1fr}
th:nth-child(3),td:nth-child(3){display:none}
}
@media(max-width:520px){
.grid{grid-template-columns:1fr}
.wrap{padding:16px}
.top{align-items:flex-start;gap:10px}
}
.generated-link{margin-top:18px;padding:16px;border:1px solid #d5d9d3;border-radius:12px;background:#f5f6f2}
.generated-title{font-weight:800;margin-bottom:10px}
.generated-row{display:flex;gap:8px;align-items:center}
.generated-row input{flex:1}
@media(max-width:520px){
.generated-row{flex-direction:column;align-items:stretch}
}
</style></head><body><div id="app"></div><script>
const app=document.getElementById('app');

async function api(url,opt={}){
  const r=await fetch(url,{
    headers:{
      'content-type':'application/json',
      ...(opt.headers||{})
    },
    ...opt
  });

  if(r.status===401){
    showLogin();
    throw new Error('unauthorized');
  }

  const d=await r.json();

  if(!r.ok)throw new Error(d.error||'Hiba');

  return d;
}

function showLogin(msg=''){
  app.innerHTML='<div class="login panel"><div class="brand">Tóvizi <span>Recruitment</span></div><h1>Admin belépés</h1><p class="muted">A weboldal üzenetei és személyre szabott linkjei innen kezelhetők.</p><div class="error">'+msg+'</div><input id="pw" type="password" placeholder="Admin jelszó"><button class="btn" style="width:100%;margin-top:12px" onclick="login()">Belépés</button></div>';

  document.getElementById('pw').addEventListener('keydown',e=>{
    if(e.key==='Enter')login()
  });
}

async function login(){
  try{
    await api('/api/admin/login',{
      method:'POST',
      body:JSON.stringify({
        password:document.getElementById('pw').value
      })
    });

    load();
  }catch(e){
    showLogin('Hibás jelszó.')
  }
}

async function load(){
  try{
    const s=await api('/api/admin/stats');
    render(s)
  }catch(e){
    showLogin()
  }
}

function render(s){
  app.innerHTML='<div class="wrap"><div class="top"><div><div class="brand">Tóvizi <span>Recruitment</span></div><div class="muted">Admin felület</div></div><button class="btn light" onclick="logout()">Kilépés</button></div><div class="grid"><div class="stat">Összes üzenet<b>'+s.stats.total+'</b></div><div class="stat">Olvasatlan<b>'+s.stats.unread+'</b></div><div class="stat">Kezelés alatt<b>'+s.stats.progress+'</b></div><div class="stat">Aktív link<b>'+s.stats.links+'</b></div></div><div class="tabs"><button class="tab active" onclick="tab(this,&quot;messages&quot;)">📩 Üzenetek</button><button class="tab" onclick="tab(this,&quot;links&quot;)">🔗 Személyre szabott linkek</button></div><section id="messages" class="panel"><div class="top"><div><h2>Beérkezett üzenetek</h2><div class="muted">Az űrlapról érkező megkeresések kezelése.</div></div><select id="filter" onchange="loadMessages()"><option value="all">Minden státusz</option><option value="unread">Olvasatlan</option><option value="progress">Kezelés alatt</option><option value="closed">Lezárt</option></select></div><div id="messageList"></div></section><section id="links" class="panel hidden"><div class="top"><div><h2>Személyre szabott linkek</h2><div class="muted">6 számjegyű, egyedi URL-ek.</div></div><button class="btn" onclick="newLink()">+ Új személy</button></div><div id="linkList"></div></section></div><div id="modal" class="hidden"></div>';

  loadMessages();
  loadLinks();
}

function tab(btn,id){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('#messages,#links').forEach(x=>x.classList.add('hidden'));

  document.getElementById(id).classList.remove('hidden');
}

async function loadMessages(){
  const status=document.getElementById('filter')?.value||'all';

  const d=await api('/api/admin/messages?status='+status);

  document.getElementById('messageList').innerHTML=d.items.length?
  '<table><thead><tr><th>Dátum</th><th>Érdeklődő</th><th>Elérhetőség</th><th>Üzenet</th><th>Státusz</th><th>Műveletek</th></tr></thead><tbody>'+
  d.items.map(x=>
    '<tr><td>'+esc(x.created_at)+'</td><td><b>'+esc(x.name)+'</b><br><span class="muted">'+esc(x.company||'')+'</span></td><td>'+esc(x.contact)+'</td><td>'+esc(x.message||'').slice(0,180)+'</td><td><span class="pill '+x.status+'">'+statusHu(x.status)+'</span></td><td><div class="actions"><button class="btn light small" onclick="viewMsg('+x.id+')">Megnyitás</button><button class="btn light small" onclick="setMsg('+x.id+,&quot;progress&quot;)">Kezelés</button><button class="btn light small" onclick="setMsg('+x.id+,&quot;closed&quot;)">Lezárás</button><button class="btn red small" onclick="delMsg('+x.id+')">Törlés</button></div></td></tr>'
  ).join('')+
  '</tbody></table>':
  '<div class="empty">Nincs ilyen üzenet.</div>';
}

async function loadLinks(){
  const d=await api('/api/admin/links');

  document.getElementById('linkList').innerHTML=d.items.length?
  '<table><thead><tr><th>Név</th><th>Link</th><th>Megnyitás</th><th>Utolsó megnyitás</th><th>Státusz</th><th>Műveletek</th></tr></thead><tbody>'+
  d.items.map(x=>
    '<tr><td><b>'+esc(x.full_name)+'</b><br><span class="muted">'+esc(x.first_name)+'</span></td><td><code>'+location.origin+'/'+x.code+'</code></td><td>'+x.visit_count+'</td><td>'+esc(x.last_visit||'—')+'</td><td><span class="pill">'+(x.active?'Aktív':'Deaktivált')+'</span></td><td><div class="actions"><button class="btn light small" onclick="copyLink(\''+x.code+'\')">Link másolása</button><button class="btn light small" onclick="toggleLink('+x.id+','+(x.active?0:1)+')">'+(x.active?'Deaktiválás':'Aktiválás')+'</button><button class="btn red small" onclick="delLink('+x.id+')">Törlés</button></div></td></tr>'
  ).join('')+
  '</tbody></table>':
  '<div class="empty">Még nincs személyre szabott link.</div>';
}

function statusHu(s){
  return s==='unread'?'Olvasatlan':
         s==='progress'?'Kezelés alatt':
         'Lezárt';
}

function esc(v){
  return String(v??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}

async function setMsg(id,status){
  await api('/api/admin/messages/'+id,{
    method:'PATCH',
    body:JSON.stringify({status})
  });

  loadMessages();
}

async function delMsg(id){
  if(!confirm('Biztosan törlöd ezt az üzenetet?'))return;

  await api('/api/admin/messages/'+id,{
    method:'DELETE'
  });

  loadMessages();
}

async function viewMsg(id){
  const d=await api('/api/admin/messages/'+id);
  const x=d.item;

  document.getElementById('modal').className='modal';

  document.getElementById('modal').innerHTML='<div class="modalbox"><div class="top"><h2>'+esc(x.name)+'</h2><button class="btn light" onclick="closeModal()">Bezárás</button></div><p><b>Cég:</b> '+esc(x.company||'—')+'</p><p><b>Elérhetőség:</b> '+esc(x.contact)+'</p><p><b>Érkezett:</b> '+esc(x.created_at)+'</p><p><b>Forrás:</b> '+esc(x.source_code?location.origin+'/'+x.source_code:'Normál oldal')+'</p><hr><p style="white-space:pre-wrap">'+esc(x.message||'—')+'</p></div>';

  if(x.status==='unread')setMsg(id,'progress');
}

function closeModal(){
  document.getElementById('modal').className='hidden';
}

function newLink(){
  document.getElementById('modal').className='modal';

  document.getElementById('modal').innerHTML='<div class="modalbox"><div class="top"><h2>Új személyre szabott link</h2><button class="btn light" onclick="closeModal()">Bezárás</button></div><div class="form"><div class="full"><label>Teljes név</label><input id="fullName" placeholder="Gipsz Jakab"></div><div class="full"><label>Megszólítás / keresztnév</label><input id="firstName" placeholder="Levente"></div></div><button class="btn" style="margin-top:14px" onclick="createLink()">Link generálása</button><div id="generatedLink" class="hidden"></div></div>';
}

async function createLink(){
  const full_name=document.getElementById('fullName').value.trim();
  const first_name=document.getElementById('firstName').value.trim();

  if(!full_name||!first_name)
    return alert('A teljes név és a keresztnév is szükséges.');

  const d=await api('/api/admin/links',{
    method:'POST',
    body:JSON.stringify({
      full_name,
      first_name
    })
  });

  await loadLinks();

  const link=location.origin+'/'+d.code;
  const box=document.getElementById('generatedLink');

  box.className='generated-link';

  box.innerHTML='<div class="generated-title">Elkészült a személyre szabott link</div><div class="generated-row"><input id="generatedUrl" value="'+link+'" readonly><button class="btn" onclick="copyLink(\''+d.code+'\')">Link másolása</button></div>';
}

async function toggleLink(id,active){
  await api('/api/admin/links/'+id,{
    method:'PATCH',
    body:JSON.stringify({
      active:!!active
    })
  });

  loadLinks();
}

async function delLink(id){
  if(!confirm('Biztosan törlöd ezt a linket?'))return;

  await api('/api/admin/links/'+id,{
    method:'DELETE'
  });

  loadLinks();
}

async function copyLink(code){
  await navigator.clipboard.writeText(location.origin+'/'+code);
  alert('Link kimásolva.');
}

async function logout(){
  await api('/api/admin/logout',{
    method:'POST'
  });

  showLogin();
}

load();
</script></body></html>`;

async function apiHandler(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    const { password } = await request.json();

    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const session = await makeSession(env.ADMIN_SESSION_SECRET);

    return new Response(
      JSON.stringify({ ok: true }),
      {
        headers: {
          'content-type':'application/json',
          'set-cookie': adminCookie(session),
          'cache-control':'no-store'
        }
      }
    );
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    return new Response(
      JSON.stringify({ ok:true }),
      {
        headers:{
          'content-type':'application/json',
          'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
        }
      }
    );
  }

  if (!(await validSession(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (url.pathname === '/api/admin/stats') {
    const [stats, links] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) total, SUM(CASE WHEN status='unread' THEN 1 ELSE 0 END) unread, SUM(CASE WHEN status='progress' THEN 1 ELSE 0 END) progress FROM contacts"
      ).first(),

      env.DB.prepare(
        "SELECT COUNT(*) links FROM personalized_links WHERE active=1"
      ).first()
    ]);

    return json({
      stats:{
        ...stats,
        ...links
      }
    });
  }

  if (url.pathname === '/api/admin/messages' && request.method === 'GET') {
    const status = url.searchParams.get('status') || 'all';

    const q =
      status === 'all'
        ? env.DB.prepare(
            'SELECT * FROM contacts ORDER BY id DESC LIMIT 300'
          )
        : env.DB.prepare(
            'SELECT * FROM contacts WHERE status=? ORDER BY id DESC LIMIT 300'
          ).bind(status);

    return json({
      items:(await q.all()).results
    });
  }

  const msgMatch = url.pathname.match(/^\/api\/admin\/messages\/(\d+)$/);

  if (msgMatch) {
    const id = Number(msgMatch[1]);

    if (request.method === 'GET') {
      return json({
        item:await env.DB.prepare(
          'SELECT * FROM contacts WHERE id=?'
        ).bind(id).first()
      });
    }

    if (request.method === 'PATCH') {
      const {status}=await request.json();

      if(!['unread','progress','closed'].includes(status)) {
        return json({
          error:'Invalid status'
        },400);
      }

      await env.DB.prepare(
        'UPDATE contacts SET status=? WHERE id=?'
      ).bind(status,id).run();

      return json({
        ok:true
      });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare(
        'DELETE FROM contacts WHERE id=?'
      ).bind(id).run();

      return json({
        ok:true
      });
    }
  }

  if (
    url.pathname === '/api/admin/links' &&
    request.method === 'GET'
  ) {
    return json({
      items:(await env.DB.prepare(
        'SELECT * FROM personalized_links ORDER BY id DESC'
      ).all()).results
    });
  }

  if (
    url.pathname === '/api/admin/links' &&
    request.method === 'POST'
  ) {
    const {full_name,first_name}=await request.json();

    if(!full_name||!first_name) {
      return json({
        error:'Missing name'
      },400);
    }

    let code='';

    for(let i=0;i<30;i++){
      const n=crypto.getRandomValues(
        new Uint32Array(1)
      )[0]%1000000;

      const c=String(n).padStart(6,'0');

      const exists=await env.DB.prepare(
        'SELECT id FROM personalized_links WHERE code=?'
      ).bind(c).first();

      if(!exists){
        code=c;
        break;
      }
    }

    if(!code){
      return json({
        error:'Could not generate code'
      },500);
    }

    await env.DB.prepare(
      'INSERT INTO personalized_links(code,full_name,first_name) VALUES(?,?,?)'
    ).bind(
      code,
      full_name,
      first_name
    ).run();

    return json({
      ok:true,
      code
    });
  }

  const linkMatch=url.pathname.match(
    /^\/api\/admin\/links\/(\d+)$/
  );

  if(linkMatch){
    const id=Number(linkMatch[1]);

    if(request.method==='PATCH'){
      const {active}=await request.json();

      await env.DB.prepare(
        'UPDATE personalized_links SET active=? WHERE id=?'
      ).bind(
        active?1:0,
        id
      ).run();

      return json({
        ok:true
      });
    }

    if(request.method==='DELETE'){
      await env.DB.prepare(
        'DELETE FROM personalized_links WHERE id=?'
      ).bind(id).run();

      return json({
        ok:true
      });
    }
  }

  return json({
    error:'Not found'
  },404);
}

async function personalizedPage(request, env, code) {
  const row = await env.DB.prepare(
    'SELECT * FROM personalized_links WHERE code=? AND active=1'
  ).bind(code).first();

  if (!row) {
    return new Response(
      'A keresett oldal nem található.',
      {
        status:404,
        headers:{
          'content-type':'text/plain; charset=UTF-8'
        }
      }
    );
  }

  await env.DB.prepare(
    "UPDATE personalized_links SET visit_count=visit_count+1,last_visit=datetime('now') WHERE id=?"
  ).bind(row.id).run();

  const root = new URL('/', request.url);

  const original = await env.ASSETS.fetch(
    new Request(root.toString(), request)
  );

  if (!original.ok) return original;

  let html = await original.text();

  const first = row.first_name.replace(
    /[&<>"']/g,
    m=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m])
  );

  const block =
    `<div class="personal-greeting"><span>${first},</span><strong>nézzük meg, hogyan segíthetünk.</strong></div>`;

  const css =
    `<style>.personal-greeting{display:flex;flex-direction:column;gap:2px;margin:0 0 22px;font-family:Manrope,Arial,sans-serif;line-height:1.04;letter-spacing:-.025em}.personal-greeting span{font-size:clamp(30px,4vw,52px);font-weight:800;color:#b8ff3d}.personal-greeting strong{font-size:clamp(25px,3vw,40px);font-weight:500;color:#111315}.hero.has-personal{align-items:center}@media(max-width:760px){.personal-greeting{margin-bottom:18px}}</style>`;

  html = html.replace(
    '<div class="eyebrow">Célzott recruitment</div>',
    block + '<div class="eyebrow">Célzott recruitment</div>'
  );

  html = html.replace(
    '</head>',
    css + '</head>'
  );

  html = html.replace(
    '</body>',
    `<script>window.__TR_PERSONALIZED__=true;window.__TR_CODE__='${code}';</script></body>`
  );

  return new Response(
    html,
    {
      headers:{
        'content-type':'text/html; charset=UTF-8',
        'cache-control':'no-store'
      }
    }
  );
}

export async function onRequest(context) {
  const {request, env} = context;
  const url = new URL(request.url);

  if (
    url.pathname === '/admin' ||
    url.pathname === '/admin/'
  ) {
    return new Response(
      ADMIN_HTML,
      {
        headers:{
          'content-type':'text/html; charset=UTF-8',
          'cache-control':'no-store'
        }
      }
    );
  }

  if (url.pathname.startsWith('/api/')) {
    return apiHandler(request, env);
  }

  const m = url.pathname.match(/^\/(\d{6})\/?$/);

  if (
    m &&
    request.method === 'GET'
  ) {
    return personalizedPage(
      request,
      env,
      m[1]
    );
  }

  // Intercept the existing contact form without changing its visual design.
  if (
    request.method === 'GET' &&
    url.pathname === '/'
  ) {
    const original = await env.ASSETS.fetch(request);

    if (!original.ok) return original;

    let html = await original.text();

    const injected =
      `<script>(function(){const f=document.getElementById('contactForm');if(!f)return;f.addEventListener('submit',async function(e){e.preventDefault();const inputs=f.querySelectorAll('input'),ta=f.querySelector('textarea');const payload={name:inputs[0]?.value||'',company:inputs[1]?.value||'',contact:inputs[2]?.value||'',message:ta?.value||'',source_code:window.__TR_CODE__||null};const b=f.querySelector('button');if(b)b.disabled=true;try{const r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error();document.getElementById('thanks').hidden=false;f.reset()}catch(err){alert('Az üzenetet most nem sikerült elküldeni. Kérjük, próbáld újra.')}finally{if(b)b.disabled=false}})})();</script>`;

    html = html.replace(
      '</body>',
      injected + '</body>'
    );

    return new Response(
      html,
      {
        headers:{
          'content-type':'text/html; charset=UTF-8',
          'cache-control':'no-store'
        }
      }
    );
  }

  if (
    url.pathname === '/api/contact' &&
    request.method === 'POST'
  ) {
    const data = await request.json();

    if (!data.name || !data.contact) {
      return json({
        error:'Missing required fields'
      },400);
    }

    await env.DB.prepare(
      'INSERT INTO contacts(name,company,contact,message,source_code) VALUES(?,?,?,?,?)'
    ).bind(
      String(data.name).slice(0,200),
      String(data.company||'').slice(0,200),
      String(data.contact).slice(0,300),
      String(data.message||'').slice(0,5000),
      data.source_code||null
    ).run();

    return json({
      ok:true
    });
  }

  return env.ASSETS.fetch(request);
}
