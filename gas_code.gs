/**
 * SGIS – Google Apps Script (versão com CORS + ping)
 */

const SPREADSHEET_ID = '1ZL_kWXwotlHUcRk2BTD-anDS2LmyyqkdtGdy_XEhhuI';
const SHEET_PRODUTOS = 'Produtos';
const SHEET_MOVIMENTOS = 'Movimentos';

function _ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function _corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function doOptions() {
  const out = ContentService.createTextOutput('');
  Object.entries(_corsHeaders()).forEach(([k,v])=> out.setHeader(k,v));
  return out;
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (params.action === 'ping') {
      return _json({ok:true, time: new Date().toISOString()});
    }
    if (params.action === 'consulta' && params.code) {
      const produto = _findProduto(params.code);
      return _json({status: produto ? 'OK' : 'NOT_FOUND', produto});
    }
    return _json({error:'INVALID_ACTION'});
  } catch (err) {
    return _json({error:String(err), stack:(err && err.stack)||''}, 500);
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action;
    if (action === 'entrada' || action === 'saida') {
      if (!body.code || !body.qty) return _json({error:'MISSING_FIELDS'}, 400);
      const q = Number(body.qty);
      const p = body.price != null ? Number(body.price) : null;
      const res = _movimento(action, body.code, q, p, body.user||'mobile');
      return _json({status:'OK', result:res});
    }
    if (action === 'exportar') {
      const url = _exportarInventario();
      return _json({status:'OK', url});
    }
    if (action === 'consulta' && body.code) {
      const produto = _findProduto(body.code);
      return _json({status: produto ? 'OK' : 'NOT_FOUND', produto});
    }
    return _json({error:'INVALID_ACTION'}, 400);
  } catch (err) {
    return _json({error:String(err), stack:(err && err.stack)||''}, 500);
  }
}

function _json(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  Object.entries(_corsHeaders()).forEach(([k,v])=> out.setHeader(k,v));
  if (status) out.setHeader('X-Status', String(status));
  return out;
}

function _findProduto(code) {
  const sh = _ss().getSheetByName(SHEET_PRODUTOS);
  const vals = sh.getDataRange().getValues();
  const idx = vals.findIndex(r=>String(r[0])===String(code));
  if (idx <= 0) return null; // ignora cabeçalho
  const r = vals[idx];
  return {
    codigo: r[0],
    nome: r[1],
    categoria: r[2],
    preco: r[3],
    stock: r[4],
    ultimaEntrada: r[5],
    ultimaSaida: r[6]
  };
}

function _movimento(tipo, code, qty, price, user) {
  const ss = _ss();
  const shP = ss.getSheetByName(SHEET_PRODUTOS);
  const shM = ss.getSheetByName(SHEET_MOVIMENTOS);
  const vals = shP.getDataRange().getValues();
  let row = vals.findIndex(r=>String(r[0])===String(code));
  if (row < 0) {
    // novo produto
    row = shP.getLastRow()+1;
    shP.getRange(row,1,1,7).setValues([[code, '', '', price||0, 0, '', '']]);
  } else {
    row = row+1; // 1-based
  }
  const stockCell = shP.getRange(row,5);
  const precoCell = shP.getRange(row,4);
  const current = Number(stockCell.getValue()||0);
  const novo = tipo==='entrada' ? current+qty : current-qty;
  stockCell.setValue(novo);
  if (price!=null && !isNaN(price)) precoCell.setValue(price);
  const now = new Date();
  if (tipo==='entrada') shP.getRange(row,6).setValue(now);
  else shP.getRange(row,7).setValue(now);

  shM.appendRow([now, tipo==='entrada'?'Entrada':'Saída', code, qty, user]);
  return {code, stock: novo};
}

function _exportarInventario() {
  return 'https://docs.google.com/spreadsheets/d/'+ SPREADSHEET_ID;
}
