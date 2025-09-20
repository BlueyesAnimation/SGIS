/*
 * SGIS – Sistema de Gestão de Inventário Simples
 *
 * Este ficheiro contém a lógica da aplicação web.  As operações de entrada,
 * saída, consulta e exportação comunicam com um Google Apps Script via HTTP.
 * Caso não exista ligação à Internet, as operações são guardadas localmente
 * e podem ser sincronizadas quando o utilizador voltar a estar online.
 */

// TODO: substitua este URL pela URL do seu Apps Script implantado (termina em /exec)
const SCRIPT_URL = 'REPLACE_WITH_YOUR_SCRIPT_URL';

const messageEl = document.getElementById('message');
const videoEl = document.getElementById('video');

// Obter referências aos botões
const btnEntrada = document.getElementById('btnEntrada');
const btnSaida = document.getElementById('btnSaida');
const btnConsulta = document.getElementById('btnConsulta');
const btnExportar = document.getElementById('btnExportar');
const btnSync = document.getElementById('btnSync');

// Carregar operações pendentes do armazenamento local
let pending = [];
try {
  pending = JSON.parse(localStorage.getItem('pendingUpdates')) || [];
} catch (err) {
  pending = [];
}

function savePending() {
  localStorage.setItem('pendingUpdates', JSON.stringify(pending));
}

/**
 * Mostra uma mensagem ao utilizador.
 * @param {string} msg Mensagem a mostrar
 * @param {('info'|'success'|'error')} type Tipo de mensagem (define cor)
 */
function showMessage(msg, type = 'info') {
  messageEl.textContent = msg;
  let color = '#2c3e50';
  if (type === 'success') color = '#27ae60';
  if (type === 'error') color = '#c0392b';
  messageEl.style.color = color;
}

/**
 * Envia uma requisição ao Apps Script.
 *
 * @param {string} action Ação a executar (entrada, saida, consulta, export)
 * @param {Object} params Parâmetros adicionais
 */
async function sendToApi(action, params = {}) {
  const urlParams = new URLSearchParams({ action, ...params });
  const url = `${SCRIPT_URL}?${urlParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao contactar API: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

/**
 * Tenta enviar para a API.  Se falhar, guarda na lista pendente.
 */
async function sendOrQueue(action, params) {
  try {
    const res = await sendToApi(action, params);
    return res;
  } catch (err) {
    // Falhou, guardar em pendentes
    pending.push({ action, params });
    savePending();
    throw new Error('Sem ligação. Operação guardada para sincronização.');
  }
}

/**
 * Sincroniza todas as operações pendentes com a API.
 */
async function syncPending() {
  if (pending.length === 0) {
    showMessage('Não há operações pendentes.', 'info');
    return;
  }
  showMessage('A sincronizar operações pendentes...', 'info');
  let i = 0;
  while (i < pending.length) {
    const item = pending[i];
    try {
      await sendToApi(item.action, item.params);
      pending.splice(i, 1);
    } catch (err) {
      // Ainda sem ligação, parar
      break;
    }
  }
  savePending();
  if (pending.length === 0) {
    showMessage('Sincronização concluída!', 'success');
  } else {
    showMessage(`Faltam ${pending.length} operações para sincronizar.`, 'error');
  }
}

/**
 * Lê um código de barras usando a câmara.  Se não suportado, pede input manual.
 * @returns {Promise<string|null>} Código lido ou null se cancelado
 */
async function scanBarcode() {
  // Se o browser não suporta BarcodeDetector, pedir manual
  if (!('BarcodeDetector' in window)) {
    return prompt('O seu dispositivo não suporta leitura. Introduza o código manualmente:');
  }
  // Pedir acesso à câmara do utilizador
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (err) {
    return prompt('Não foi possível aceder à câmara. Introduza o código manualmente:');
  }
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_e', 'upc_a'] });
  videoEl.srcObject = stream;
  videoEl.classList.remove('hidden');
  await videoEl.play();
  return new Promise((resolve) => {
    const scanInterval = setInterval(async () => {
      try {
        const bitmap = await createImageBitmap(videoEl);
        const barcodes = await detector.detect(bitmap);
        if (barcodes && barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          clearInterval(scanInterval);
          stream.getTracks().forEach((t) => t.stop());
          videoEl.classList.add('hidden');
          resolve(code);
        }
      } catch (err) {
        // Ignorar erros de detecção
      }
    }, 500);
  });
}

/**
 * Handler para entradas de stock.
 */
async function handleEntrada() {
  showMessage('A ler código de barras...', 'info');
  const code = await scanBarcode();
  if (!code) return;
  try {
    // Verificar se produto existe
    const consulta = await sendOrQueue('consulta', { code });
    let name = consulta.name;
    let price = consulta.price;
    if (consulta.status === 'NOT_FOUND') {
      // Pedido de informação adicional
      name = prompt('Produto não encontrado. Introduza o nome do produto:');
      if (!name) {
        showMessage('Entrada cancelada.', 'error');
        return;
      }
      price = prompt('Introduza o preço unitário do produto:');
      if (!price) {
        showMessage('Entrada cancelada.', 'error');
        return;
      }
    }
    const qtyStr = prompt('Quantidade a adicionar:', '1');
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      showMessage('Quantidade inválida.', 'error');
      return;
    }
    await sendOrQueue('entrada', { code, qty, name, price });
    showMessage('Entrada registada!', 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

/**
 * Handler para saídas de stock.
 */
async function handleSaida() {
  showMessage('A ler código de barras...', 'info');
  const code = await scanBarcode();
  if (!code) return;
  try {
    const consulta = await sendOrQueue('consulta', { code });
    if (consulta.status === 'NOT_FOUND') {
      showMessage('Produto não existe. Não é possível retirar stock.', 'error');
      return;
    }
    const qtyStr = prompt(`Stock actual: ${consulta.stock}. Quantidade a retirar:`, '1');
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      showMessage('Quantidade inválida.', 'error');
      return;
    }
    await sendOrQueue('saida', { code, qty });
    showMessage('Saída registada!', 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

/**
 * Handler para consulta de stock.
 */
async function handleConsulta() {
  showMessage('A ler código de barras...', 'info');
  const code = await scanBarcode();
  if (!code) return;
  try {
    const consulta = await sendOrQueue('consulta', { code });
    if (consulta.status === 'NOT_FOUND') {
      showMessage('Produto não encontrado.', 'error');
      return;
    }
    showMessage(`Código: ${code}\nNome: ${consulta.name}\nStock: ${consulta.stock}\nPreço: €${consulta.price}`, 'info');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

/**
 * Handler para exportação.
 */
async function handleExportar() {
  showMessage('A gerar ficheiro de inventário...', 'info');
  try {
    const res = await sendOrQueue('export', {});
    showMessage('Inventário exportado para a pasta "Inventário" do Google Drive!', 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// Ligar event listeners aos botões
btnEntrada.addEventListener('click', handleEntrada);
btnSaida.addEventListener('click', handleSaida);
btnConsulta.addEventListener('click', handleConsulta);
btnExportar.addEventListener('click', handleExportar);
btnSync.addEventListener('click', syncPending);