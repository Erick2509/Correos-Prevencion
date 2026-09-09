const $ = id => document.getElementById(id);
const DEFAULT_QUERY = 'newer_than:1y';
let allItems = [], filteredItems = [], page = 1, nextPageToken = null, loadingMore = false;
const PAGE_SIZE = 10;

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function esc(v=''){ const d=document.createElement('div'); d.textContent=String(v); return d.innerHTML; }
function fmtDate(iso){ if(!iso)return '—'; return new Date(iso).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtTime(iso){ if(!iso)return '—'; return new Date(iso).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }

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
$('closeModal').onclick=closeModal; $('modal').onclick=e=>{if(e.target===$('modal'))closeModal();}; document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

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
function openModal(id){ const x=allItems.find(i=>i.id===id); if(!x)return; $('modalShift').textContent=x.turno; $('modalShift').className='badge '+(x.turno==='Noche'?'night':''); $('modalCompany').textContent=x.empresa||'Empresa no detectada'; $('modalContent').innerHTML=`<div class="detail-grid"><div><label>Fecha</label><p>${fmtDate(x.receivedAt)}</p></div><div><label>Hora</label><p>${fmtTime(x.receivedAt)}</p></div><div><label>Remitente</label><p>${esc(x.from)}</p></div><div><label>Estado</label><p>${esc(x.status||'Sin clasificar')}</p></div></div><div class="detail-section"><label>Asunto</label><p>${esc(x.subject)}</p></div><div class="detail-section highlight"><label>Trabajo / solicitud</label><p>${esc(x.trabajo||x.detalle||'No se pudo identificar automáticamente.')}</p></div><div class="detail-grid"><div><label>Empresa</label><p>${esc(x.empresa||'No detectada')}</p></div><div><label>Local</label><p>${esc(x.local||'No detectado')}</p></div></div>${x.fechaSolicitud?`<div class="detail-section"><label>Fecha mencionada en la solicitud</label><p>${esc(x.fechaSolicitud)}</p></div>`:''}${x.local?`<div class="detail-section"><label>Local / ubicación mencionada</label><p>${esc(x.local)}</p></div>`:''}<div class="detail-section"><label>Contenido del correo</label><pre>${esc(x.body||'Sin contenido disponible')}</pre></div>${x.attachments?.length?`<div class="detail-section"><label>Adjuntos</label><p>${x.attachments.map(a=>esc(a)).join('<br>')}</p></div>`:''}<a class="btn btn-primary gmail-link" href="https://mail.google.com/mail/u/0/#all/${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Abrir correo en Gmail</a>`; show($('modal')); document.body.classList.add('no-scroll'); }
function closeModal(){hide($('modal'));document.body.classList.remove('no-scroll');}
init();
