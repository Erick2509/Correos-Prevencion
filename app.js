const $ = id => document.getElementById(id);
const DEFAULT_QUERY = 'newer_than:1y';
let allItems = [], filteredItems = [], page = 1, nextPageToken = null, loadingMore = false;
const PAGE_SIZE = 10;
let deferredInstallPrompt = null;

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function esc(v=''){ const d=document.createElement('div'); d.textContent=String(v); return d.innerHTML; }
function fmtDate(iso){ if(!iso)return '—'; return new Date(iso).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtTime(iso){ if(!iso)return '—'; return new Date(iso).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }


function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isAndroid(){return /android/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true}
function setupPWA(){
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  const installBtn=$('installBtn');
  if(isStandalone())return;
  if(isIOS()){show(installBtn);installBtn.onclick=showInstallHelp;}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;show(installBtn);installBtn.onclick=installPWA;});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;hide(installBtn);});
}
async function installPWA(){
  if(!deferredInstallPrompt){showInstallHelp();return;}
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(()=>{});
  deferredInstallPrompt=null;
  hide($('installBtn'));
}
function showInstallHelp(){
  const c=$('installHelpContent');
  if(isIOS())c.innerHTML='<p>En iPhone/iPad abre esta web en <b>Safari</b>, toca <b>Compartir</b> y elige <b>Agregar a pantalla de inicio</b>.</p><p>Después se abrirá como una app independiente.</p>';
  else c.innerHTML='<p>Abre el menú del navegador y selecciona <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</p>';
  show($('installHelp'));document.body.classList.add('no-scroll');
}
function closeInstallHelp(){hide($('installHelp'));document.body.classList.remove('no-scroll');}
function gmailWebUrl(x){return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(x.threadId||x.id)}`;}
function openGmailMessage(x){
  const web=gmailWebUrl(x);
  if(isAndroid()){
    const fallback=encodeURIComponent(web);
    location.href=`intent://mail.google.com/mail/u/0/#all/${encodeURIComponent(x.threadId||x.id)}#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${fallback};end`;
    return;
  }
  // En iOS no existe un esquema público documentado para abrir un hilo específico.
  // Abrimos el enlace del hilo: si Gmail está asociado lo toma la app; si no, abre Gmail web en ese mensaje.
  location.href=web;
}

async function init(){
  const r=await fetch('/api/session'); const d=await r.json();
  if(d.connected){ show($('dashboard')); hide($('gate')); $('authArea').innerHTML='<button id="logoutBtn" class="btn btn-ghost">Desconectar</button>'; $('logoutBtn').onclick=logout; $('queryInput').value=localStorage.getItem('gmailQuery')||DEFAULT_QUERY; loadEmails(false); }
  else { show($('gate')); hide($('dashboard')); }
}
async function logout(){ await fetch('/api/logout',{method:'POST'}); location.reload(); }
$('connectBtn').onclick=()=>location.href='/api/auth-url';
$('reloadBtn').onclick=()=>loadEmails(false);
$('searchBtn').onclick=()=>{ localStorage.setItem('gmailQuery',$('queryInput').value.trim()||DEFAULT_QUERY); loadEmails(false); };
$('moreBtn').onclick=()=>loadEmails(true);
$('clearBtn').onclick=()=>{ $('textFilter').value=''; $('dateFrom').value=''; $('dateTo').value=''; $('shiftFilter').value=''; $('companyFilter').value=''; applyFilters(); };
['textFilter','dateFrom','dateTo','shiftFilter','companyFilter'].forEach(id=>$(id).addEventListener(id==='textFilter'?'input':'change',applyFilters));
$('prevBtn').onclick=()=>{ if(page>1){page--;renderPage();} };
$('nextBtn').onclick=()=>{ if(page*PAGE_SIZE<filteredItems.length){page++;renderPage();} };
$('closeModal').onclick=closeModal; $('modal').onclick=e=>{if(e.target===$('modal'))closeModal();}; $('closeInstallHelp').onclick=closeInstallHelp; $('installHelp').onclick=e=>{if(e.target===$('installHelp'))closeInstallHelp();}; document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeInstallHelp();}});

async function loadEmails(more=false){
  if(loadingMore)return; loadingMore=true;
  hide($('errorState'));
  if(!more){ allItems=[]; nextPageToken=null; $('list').innerHTML=''; hide($('emptyState')); hide($('pager')); hide($('moreWrap')); show($('loadingState')); $('countLabel').textContent=''; }
  else { $('moreBtn').disabled=true; $('moreBtn').textContent='Cargando…'; }
  try{
    const q=$('queryInput').value.trim()||DEFAULT_QUERY;
    const params=new URLSearchParams({q,already:String(allItems.length)});
    if(more&&nextPageToken)params.set('pageToken',nextPageToken);
    const r=await fetch(`/api/emails?${params.toString()}`);
    if(r.status===401){location.reload();return;}
    const d=await r.json(); if(!r.ok)throw new Error(d.error||`Error ${r.status}`);
    const seen=new Set(allItems.map(x=>x.id));
    allItems=[...allItems,...(d.items||[]).filter(x=>!seen.has(x.id))].sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
    nextPageToken=d.nextPageToken||null;
    fillCompanies(); updateSummary(); applyFilters();
    nextPageToken?show($('moreWrap')):hide($('moreWrap'));
  }catch(e){ hide($('loadingState')); $('errorText').textContent=e.message||'No se pudieron cargar los correos.'; show($('errorState')); if(allItems.length)applyFilters(); }
  finally{ loadingMore=false; $('moreBtn').disabled=false; $('moreBtn').textContent='Cargar más correos de Gmail'; }
}
function fillCompanies(){ const current=$('companyFilter').value; const names=[...new Set(allItems.map(x=>x.empresa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')); $('companyFilter').innerHTML='<option value="">Todas</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(''); if(names.includes(current))$('companyFilter').value=current; }
function updateSummary(){ $('totalCount').textContent=allItems.length; $('dayCount').textContent=allItems.filter(x=>x.turno==='Día').length; $('nightCount').textContent=allItems.filter(x=>x.turno==='Noche').length; $('companyCount').textContent=new Set(allItems.map(x=>x.empresa).filter(Boolean)).size; }
function applyFilters(){
  const text=$('textFilter').value.trim().toLowerCase(), from=$('dateFrom').value, to=$('dateTo').value, shift=$('shiftFilter').value, company=$('companyFilter').value;
  filteredItems=allItems.filter(x=>{ const hay=`${x.empresa||''} ${x.subject||''} ${x.detalle||''} ${x.from||''}`.toLowerCase(); const day=(x.receivedAt||'').slice(0,10); return (!text||hay.includes(text))&&(!from||day>=from)&&(!to||day<=to)&&(!shift||x.turno===shift)&&(!company||x.empresa===company); }); page=1; renderPage();
}
function renderPage(){
  hide($('loadingState')); $('countLabel').textContent=`${filteredItems.length} de ${allItems.length} correos cargados`;
  if(!filteredItems.length){$('list').innerHTML='';show($('emptyState'));hide($('pager'));return;} hide($('emptyState'));
  const start=(page-1)*PAGE_SIZE, slice=filteredItems.slice(start,start+PAGE_SIZE);
  $('list').innerHTML=slice.map(x=>`<article class="mail-card" data-id="${esc(x.id)}"><div class="mail-main"><div class="mail-top"><span class="badge ${x.turno==='Noche'?'night':''}">${esc(x.turno)}</span><span class="mail-date">${fmtDate(x.receivedAt)} · ${fmtTime(x.receivedAt)}</span></div><div class="card-summary"><div class="summary-row work-row"><span class="summary-label">Trabajo / solicitud</span><strong>${esc(x.trabajo||x.detalle||x.subject||'No detectado')}</strong></div><div class="summary-meta"><div><span class="summary-label">Empresa</span><span>${esc(x.empresa||'No detectada')}</span></div><div><span class="summary-label">Local</span><span>${esc(x.local||'No detectado')}</span></div></div></div><p class="subject"><b>Asunto:</b> ${esc(x.subject)}</p></div><button class="btn btn-ghost detail-btn">Ver detalle</button></article>`).join('');
  document.querySelectorAll('.mail-card').forEach(card=>card.querySelector('.detail-btn').onclick=()=>openModal(card.dataset.id));
  const pages=Math.ceil(filteredItems.length/PAGE_SIZE); $('pageLabel').textContent=`Página ${page} de ${pages}`; $('prevBtn').disabled=page===1; $('nextBtn').disabled=page===pages; pages>1?show($('pager')):hide($('pager'));
}
function openModal(id){ const x=allItems.find(i=>i.id===id); if(!x)return; $('modalShift').textContent=x.turno; $('modalShift').className='badge '+(x.turno==='Noche'?'night':''); $('modalCompany').textContent=x.empresa||'Empresa no detectada'; $('modalContent').innerHTML=`<div class="detail-grid"><div><label>Fecha</label><p>${fmtDate(x.receivedAt)}</p></div><div><label>Hora</label><p>${fmtTime(x.receivedAt)}</p></div><div><label>Remitente</label><p>${esc(x.from)}</p></div><div><label>Estado</label><p>${esc(x.status||'Sin clasificar')}</p></div></div><div class="detail-section"><label>Asunto</label><p>${esc(x.subject)}</p></div><div class="detail-section highlight"><label>Trabajo / solicitud</label><p>${esc(x.trabajo||x.detalle||'No se pudo identificar automáticamente.')}</p></div><div class="detail-grid"><div><label>Empresa</label><p>${esc(x.empresa||'No detectada')}</p></div><div><label>Local</label><p>${esc(x.local||'No detectado')}</p></div></div>${x.fechaSolicitud?`<div class="detail-section"><label>Fecha mencionada en la solicitud</label><p>${esc(x.fechaSolicitud)}</p></div>`:''}${x.local?`<div class="detail-section"><label>Local / ubicación mencionada</label><p>${esc(x.local)}</p></div>`:''}<div class="detail-section"><label>Contenido del correo</label><pre>${esc(x.body||'Sin contenido disponible')}</pre></div>${x.attachments?.length?`<div class="detail-section"><label>Adjuntos</label><p>${x.attachments.map(a=>esc(a)).join('<br>')}</p></div>`:''}<button id="openGmailBtn" class="btn btn-primary gmail-link">Abrir mensaje en Gmail</button>`; show($('modal')); document.body.classList.add('no-scroll'); const g=$('openGmailBtn'); if(g)g.onclick=()=>openGmailMessage(x); }
function closeModal(){hide($('modal'));document.body.classList.remove('no-scroll');}
setupPWA();
init();
