const COOKIE='tr_admin_session';

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store',...headers}});
}
async function hmac(secret,value){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function makeSession(secret){const ts=String(Date.now());return `${ts}.${await hmac(secret,ts)}`;}
async function validSession(request,env){
  const m=(request.headers.get('Cookie')||'').match(new RegExp(`${COOKIE}=([^;]+)`));
  if(!m||!env.ADMIN_SESSION_SECRET)return false;
  const [ts,sig]=m[1].split('.');
  const age=Date.now()-Number(ts);
  if(!ts||!sig||!Number.isFinite(age)||age<0||age>604800000)return false;
  return sig===await hmac(env.ADMIN_SESSION_SECRET,ts);
}
const sessionCookie=v=>`${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

async function adminApi(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){
    let body={};try{body=await request.json()}catch{}
    if(!env.ADMIN_PASSWORD||body.password!==env.ADMIN_PASSWORD)return json({error:'Unauthorized'},401);
    if(!env.ADMIN_SESSION_SECRET)return json({error:'ADMIN_SESSION_SECRET hiányzik.'},500);
    return json({ok:true},200,{'set-cookie':sessionCookie(await makeSession(env.ADMIN_SESSION_SECRET))});
  }
  if(url.pathname==='/api/admin/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':clearCookie()});
  if(!(await validSession(request,env)))return json({error:'Unauthorized'},401);

  if(url.pathname==='/api/admin/stats'){
    const [s,l]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status='unread' THEN 1 ELSE 0 END),0) unread,COALESCE(SUM(CASE WHEN status='progress' THEN 1 ELSE 0 END),0) progress FROM contacts`).first(),
      env.DB.prepare('SELECT COUNT(*) links FROM personalized_links WHERE active=1').first()
    ]);
    return json({stats:{total:Number(s?.total||0),unread:Number(s?.unread||0),progress:Number(s?.progress||0),links:Number(l?.links||0)}});
  }

  if(url.pathname==='/api/admin/messages'&&request.method==='GET'){
    const status=url.searchParams.get('status')||'all';
    const r=status==='all'
      ? await env.DB.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 300').all()
      : await env.DB.prepare('SELECT * FROM contacts WHERE status=? ORDER BY id DESC LIMIT 300').bind(status).all();
    return json({items:r.results||[]});
  }

  let m=url.pathname.match(/^\/api\/admin\/messages\/(\d+)$/);
  if(m){
    const id=Number(m[1]);
    if(request.method==='GET'){
      const item=await env.DB.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first();
      return item?json({item}):json({error:'Not found'},404);
    }
    if(request.method==='PATCH'){
      let b={};try{b=await request.json()}catch{}
      if(!['unread','progress','closed'].includes(b.status))return json({error:'Invalid status'},400);
      await env.DB.prepare('UPDATE contacts SET status=? WHERE id=?').bind(b.status,id).run();
      return json({ok:true});
    }
    if(request.method==='DELETE'){
      await env.DB.prepare('DELETE FROM contacts WHERE id=?').bind(id).run();
      return json({ok:true});
    }
  }

  if(url.pathname==='/api/admin/links'&&request.method==='GET'){
    const r=await env.DB.prepare('SELECT * FROM personalized_links ORDER BY id DESC').all();
    return json({items:r.results||[]});
  }

  if(url.pathname==='/api/admin/links'&&request.method==='POST'){
    let b={};try{b=await request.json()}catch{}
    const full=String(b.full_name||'').trim().slice(0,200), first=String(b.first_name||'').trim().slice(0,100);
    if(!full||!first)return json({error:'A teljes név és a keresztnév szükséges.'},400);
    let code=null;
    for(let i=0;i<50;i++){
      const c=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
      if(!(await env.DB.prepare('SELECT id FROM personalized_links WHERE code=?').bind(c).first())){code=c;break;}
    }
    if(!code)return json({error:'Nem sikerült egyedi linket generálni.'},500);
    await env.DB.prepare('INSERT INTO personalized_links(code,full_name,first_name) VALUES(?,?,?)').bind(code,full,first).run();
    return json({ok:true,code});
  }

  m=url.pathname.match(/^\/api\/admin\/links\/(\d+)$/);
  if(m){
    const id=Number(m[1]);
    if(request.method==='PATCH'){
      let b={};try{b=await request.json()}catch{}
      await env.DB.prepare('UPDATE personalized_links SET active=? WHERE id=?').bind(b.active?1:0,id).run();
      return json({ok:true});
    }
    if(request.method==='DELETE'){
      await env.DB.prepare('DELETE FROM personalized_links WHERE id=?').bind(id).run();
      return json({ok:true});
    }
  }
  return json({error:'Not found'},404);
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function personalizedPage(request,env,code){
  const row=await env.DB.prepare('SELECT * FROM personalized_links WHERE code=? AND active=1').bind(code).first();
  if(!row)return new Response('A keresett oldal nem található.',{status:404,headers:{'content-type':'text/plain; charset=UTF-8'}});
  await env.DB.prepare("UPDATE personalized_links SET visit_count=visit_count+1,last_visit=datetime('now') WHERE id=?").bind(row.id).run();
  const original=await env.ASSETS.fetch(new Request(new URL('/',request.url).toString(),request));
  if(!original.ok)return original;
  let html=await original.text();
  const greeting=`<div class="personal-greeting"><span>${esc(row.first_name)},</span><strong>nézzük meg, hogyan segíthetünk.</strong></div>`;
  const css=`<style>.personal-greeting{display:flex;flex-direction:column;gap:2px;margin:0 0 22px;font-family:Manrope,Arial,sans-serif;line-height:1.04;letter-spacing:-.025em}.personal-greeting span{font-size:clamp(30px,4vw,52px);font-weight:800;color:#b8ff3d}.personal-greeting strong{font-size:clamp(25px,3vw,40px);font-weight:500;color:#111315}@media(max-width:760px){.personal-greeting{margin-bottom:18px}}</style>`;
  html=html.replace('<div class="eyebrow">Célzott recruitment</div>',greeting+'<div class="eyebrow">Célzott recruitment</div>').replace('</head>',css+'</head>').replace('</body>',`<script>window.__TR_CODE__='${code}';</script></body>`);
  return new Response(html,{headers:{'content-type':'text/html; charset=UTF-8','cache-control':'no-store'}});
}

export async function onRequest(context){
  const {request,env}=context,url=new URL(request.url);
  if(url.pathname==='/admin'||url.pathname==='/admin/'){
    return env.ASSETS.fetch(new Request(new URL('/admin/index.html',request.url).toString(),request));
  }
  if(url.pathname.startsWith('/api/admin/'))return adminApi(request,env);
  const p=url.pathname.match(/^\/(\d{6})\/?$/);
  if(p&&request.method==='GET')return personalizedPage(request,env,p[1]);

  if(url.pathname==='/api/contact'&&request.method==='POST'){
    let d={};try{d=await request.json()}catch{}
    if(!d.name||!d.contact)return json({error:'Missing required fields'},400);
    await env.DB.prepare('INSERT INTO contacts(name,company,contact,message,source_code) VALUES(?,?,?,?,?)').bind(String(d.name).slice(0,200),String(d.company||'').slice(0,200),String(d.contact).slice(0,300),String(d.message||'').slice(0,5000),d.source_code||null).run();
    return json({ok:true});
  }

  if(url.pathname==='/'&&request.method==='GET'){
    const original=await env.ASSETS.fetch(request);if(!original.ok)return original;
    let html=await original.text();
    const injected=`<script>(function(){const f=document.getElementById('contactForm');if(!f)return;f.addEventListener('submit',async function(e){e.preventDefault();const i=f.querySelectorAll('input'),t=f.querySelector('textarea'),p={name:i[0]?.value||'',company:i[1]?.value||'',contact:i[2]?.value||'',message:t?.value||'',source_code:window.__TR_CODE__||null},b=f.querySelector('button');if(b)b.disabled=true;try{const r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw new Error();const x=document.getElementById('thanks');if(x)x.hidden=false;f.reset()}catch(e){alert('Az üzenetet most nem sikerült elküldeni. Kérjük, próbáld újra.')}finally{if(b)b.disabled=false}})})();</script>`;
    return new Response(html.replace('</body>',injected+'</body>'),{headers:{'content-type':'text/html; charset=UTF-8','cache-control':'no-store'}});
  }
  return env.ASSETS.fetch(request);
}
