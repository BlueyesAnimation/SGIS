/**
 * Google Apps Script para o SGIS.
 *
 * Este script deve ser copiado para um projecto de Apps Script associado a um
 * Google Sheets.  Depois de implantar como Web App (Deploy → New deployment),
 * poderá comunicar com a aplicação web através das acções definidas abaixo.
 *
 * As folhas de cálculo devem conter duas folhas com os seguintes nomes e
 * cabeçalhos:
 *  - Produtos: Código | Nome | Categoria | Preço Unitário | Stock Atual | Última Entrada | Última Saída
 *  - Movimentos: Data | Tipo | Código | Quantidade | Utilizador
 */

// Substitua este valor pelo ID do seu Google Sheets
const SPREADSHEET_ID = 'REPLACE_WITH_SPREADSHEET_ID';

/** Obtém o Spreadsheet. */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** Obtém a folha pelo nome. */
function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/** Encontra a linha de um produto pelo código.  Retorna -1 se não existir. */
function findProductRow(code) {
  const sheet = getSheet('Produtos');
  const lastRow = sheet.getLastRow();
  const codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  for (let i = 0; i < codes.length; i++) {
    if (String(codes[i]) === String(code)) {
      return i + 2; // considerar cabeçalho na linha 1
    }
  }
  return -1;
}

/** Converte valores vazios para string vazia. */
function clean(val) {
  return val == null ? '' : val;
}

/** Cria um novo produto. */
function createProduct(code, name, price) {
  const sheet = getSheet('Produtos');
  const now = new Date();
  sheet.appendRow([code, name, '', parseFloat(price), 0, '', '']);
}

/** Regista um movimento de entrada. */
function registerEntrada(code, qty, name, price) {
  const produtos = getSheet('Produtos');
  const movimentos = getSheet('Movimentos');
  let row = findProductRow(code);
  // Se produto não existe, criar
  if (row === -1) {
    createProduct(code, name, price);
    row = findProductRow(code);
  }
  const now = new Date();
  // Actualizar stock e última entrada
  const stockCell = produtos.getRange(row, 5).getValue();
  const newStock = parseFloat(stockCell) + parseFloat(qty);
  produtos.getRange(row, 5).setValue(newStock);
  produtos.getRange(row, 6).setValue(now);
  // Se preço fornecido, actualizar
  if (price) {
    produtos.getRange(row, 4).setValue(parseFloat(price));
  }
  // Registar movimento
  movimentos.appendRow([now, 'Entrada', code, qty, 'anonimo']);
  return { status: 'OK', stock: newStock };
}

/** Regista um movimento de saída. */
function registerSaida(code, qty) {
  const produtos = getSheet('Produtos');
  const movimentos = getSheet('Movimentos');
  const row = findProductRow(code);
  if (row === -1) {
    return { status: 'NOT_FOUND' };
  }
  const now = new Date();
  const currentStock = parseFloat(produtos.getRange(row, 5).getValue());
  const newStock = currentStock - parseFloat(qty);
  produtos.getRange(row, 5).setValue(newStock);
  produtos.getRange(row, 7).setValue(now);
  movimentos.appendRow([now, 'Saída', code, qty, 'anonimo']);
  return { status: 'OK', stock: newStock };
}

/** Consulta um produto. */
function consultarProduto(code) {
  const produtos = getSheet('Produtos');
  const row = findProductRow(code);
  if (row === -1) {
    return { status: 'NOT_FOUND' };
  }
  const values = produtos.getRange(row, 1, 1, 7).getValues()[0];
  return {
    status: 'OK',
    code: values[0],
    name: values[1],
    category: values[2],
    price: values[3],
    stock: values[4],
    lastEntrada: values[5],
    lastSaida: values[6],
  };
}

/** Exporta o inventário para um ficheiro Excel e guarda na pasta "Inventário" no Drive. */
function exportInventory() {
  const produtosSheet = getSheet('Produtos');
  const folderIterator = DriveApp.getFoldersByName('Inventário');
  let folder;
  if (folderIterator.hasNext()) {
    folder = folderIterator.next();
  } else {
    folder = DriveApp.createFolder('Inventário');
  }
  // Criar novo spreadsheet temporário
  const tempSpreadsheet = SpreadsheetApp.create('Exportacao Inventario');
  const tempSheet = tempSpreadsheet.getSheets()[0];
  // Copiar dados e cabeçalhos
  const range = produtosSheet.getDataRange();
  const values = range.getValues();
  tempSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  // Exportar para Excel (xlsx)
  const blob = tempSpreadsheet.getBlob().setName('Inventario.xlsx');
  const file = folder.createFile(blob);
  // Eliminar o temporário
  DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true);
  return { status: 'OK', fileId: file.getId(), fileUrl: file.getUrl() };
}

/** Handler principal para pedidos GET. */
function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'entrada':
        result = registerEntrada(e.parameter.code, e.parameter.qty, e.parameter.name, e.parameter.price);
        break;
      case 'saida':
        result = registerSaida(e.parameter.code, e.parameter.qty);
        break;
      case 'consulta':
        result = consultarProduto(e.parameter.code);
        break;
      case 'export':
        result = exportInventory();
        break;
      default:
        result = { status: 'ERROR', message: 'Ação desconhecida' };
    }
  } catch (err) {
    result = { status: 'ERROR', message: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}