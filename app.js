// SGIS – Cliente com logs e fallback
// Substitua pela sua URL do Web App (termina em /exec)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEyD2zw7envIdAikxLz1Dzz-TI9ry4W1mFvcaLampoJq9JSKsOvIwp3eCaAWyG9zx-/exec';

const $ = (s)=>document.querySelector(s);
const log = (m)=>{ const el = $('#message'); el.textContent = m; console.log(m); };

function netFail(err){
  console.error(err);
  log('⚠️ Falha de ligação ao servidor: '+ (err && err.message ? err.message : err));
}

async function api(path, body){
  const res = await fetch(SCRIPT_URL + (path||''), {
    method: body? 'POST':'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body? JSON.stringify(body): undefined,
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { throw new Error('Resposta não-JSON: '+txt); }
}

async function ping(){
  try {
    const u = new URL(SCRIPT_URL);
    u.searchParams.set('action','ping');
    const res = await fetch(u.toString(), { method:'GET' });
    const txt = await res.text();
    log('Ping: '+txt);
  } catch(e){ netFail(e); }
}

async function entradaSaida(tipo){
  try {
    const code = prompt('Código de barras (teste)');
    if(!code) return;
    const qty = Number(prompt('Quantidade'));
    const price = tipo==='entrada' ? Number(prompt('Preço unitário (opcional)')||'') : undefined;
    log('A enviar…');
    const out = await api('', { action: tipo, code, qty, price });
    log('OK: '+ JSON.stringify(out));
  } catch(e){ netFail(e); }
}

async function consulta(){
  try {
    const code = prompt('Código a consultar');
    if(!code) return;
    const out = await api('', { action:'consulta', code });
    log('Consulta: '+ JSON.stringify(out));
  } catch(e){ netFail(e); }
}

async function exportar(){
  try {
    const out = await api('', { action:'exportar' });
    if(out && out.url) window.open(out.url, '_blank');
    log('Export: '+ JSON.stringify(out));
  } catch(e){ netFail(e); }
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#btnEntrada').addEventListener('click', ()=> entradaSaida('entrada'));
  $('#btnSaida').addEventListener('click', ()=> entradaSaida('saida'));
  $('#btnConsulta').addEventListener('click', ()=> consulta());
  $('#btnExportar').addEventListener('click', ()=> exportar());
  $('#btnPing').addEventListener('click', ()=> ping());
  log('Pronto. Clique em "Ping" para testar a ligação.');
});
