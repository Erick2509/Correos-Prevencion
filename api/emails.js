const {getValidAccessToken,gmailFetch,extractBody,getHeader,attachments,heuristicParse,aiParse,turnoFor,isPromotionalEmail,cleanBody}=require('./_lib');

// Lee Gmail por bloques pequeños para no agotar la cuota por usuario.
// Cada actualización trae PAGE_SIZE correos; el navegador puede pedir el siguiente bloque.
const PAGE_SIZE=Math.max(5,Math.min(Number(process.env.GMAIL_PAGE_SIZE||20),30));
const MAX_LOADED=Math.max(PAGE_SIZE,Math.min(Number(process.env.MAX_EMAILS||200),1000));

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function mapLimit(arr,limit,fn){
  const out=new Array(arr.length); let i=0;
  async function worker(){while(true){const n=i++;if(n>=arr.length)return;out[n]=await fn(arr[n],n)}}
  await Promise.all(Array.from({length:Math.min(limit,arr.length||1)},()=>worker()));
  return out;
}

module.exports=async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  let token;
  try{token=await getValidAccessToken(req,res)}catch{}
  if(!token){res.statusCode=401;return res.end(JSON.stringify({error:'No autenticado'}))}

  const url=new URL(req.url,`https://${req.headers.host}`);
  const q=url.searchParams.get('q')||process.env.DEFAULT_GMAIL_QUERY||'newer_than:1y';
  const pageToken=url.searchParams.get('pageToken')||'';
  const already=Math.max(0,Number(url.searchParams.get('already')||0));
  if(already>=MAX_LOADED)return res.end(JSON.stringify({items:[],total:0,query:q,nextPageToken:null,hasMore:false,maxLoaded:MAX_LOADED}));

  try{
    const maxResults=Math.min(PAGE_SIZE,MAX_LOADED-already);
    let path=`messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;
    if(pageToken)path+=`&pageToken=${encodeURIComponent(pageToken)}`;
    const listing=await gmailFetch(path,token);
    const ids=listing.messages||[];

    // Concurrencia baja + pequeña separación: evita ráfagas contra Gmail API.
    const items=await mapLimit(ids,2,async(m,n)=>{
      if(n>0)await sleep(90);
      const full=await gmailFetch(`messages/${m.id}?format=full`,token,{retries:3});
      const h=full.payload?.headers||[];
      const subject=getHeader(h,'Subject')||'(sin asunto)';
      const from=getHeader(h,'From')||'';
      const date=getHeader(h,'Date');
      const body=extractBody(full.payload)||full.snippet||'';
      const receivedAt=date?new Date(date).toISOString():new Date(Number(full.internalDate)||Date.now()).toISOString();
      let parsed=await aiParse(subject,from,body).catch(()=>null);
      if(!parsed)parsed=heuristicParse(subject,from,body);
      if(isPromotionalEmail(subject,from,body))return null;
      return {id:m.id,subject,from,receivedAt,turno:turnoFor(receivedAt,subject,body),empresa:parsed.empresa||'',trabajo:parsed.trabajo||parsed.detalle||subject,detalle:parsed.detalle||'',local:parsed.local||null,fechaSolicitud:parsed.fechaSolicitud||null,status:parsed.status||'Sin clasificar',body:cleanBody(body),attachments:attachments(full.payload)};
    });

    const filteredItems=items.filter(Boolean);
    filteredItems.sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
    const next=(already+ids.length<MAX_LOADED)?(listing.nextPageToken||null):null;
    res.end(JSON.stringify({items:filteredItems,total:filteredItems.length,query:q,nextPageToken:next,hasMore:!!next,maxLoaded:MAX_LOADED,pageSize:PAGE_SIZE}));
  }catch(e){
    const msg=e.message||'Error leyendo Gmail';
    const quota=/quota|rate limit|user-rate|429|403/i.test(msg);
    res.statusCode=quota?429:500;
    res.end(JSON.stringify({error:quota?'Gmail alcanzó temporalmente el límite de consultas. Espera unos segundos y vuelve a intentar. Los correos ya cargados no se perderán.':msg,quota}));
  }
};
