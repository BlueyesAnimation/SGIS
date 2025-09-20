/**
 * Google Apps Script for SGIS Inventory Management.
 *
 * This script receives inventory data via HTTP POST and writes it to a
 * Google Spreadsheet. It expects a JSON payload containing two arrays:
 *
 *     {
 *       "produtos": [[codigo, nome, precoUnitario, stockAtual], ...],
 *       "movimentos": [[data, tipo, codigo, quantidade, utilizador], ...]
 *     }
 *
 * The script will clear the contents of the "Produtos" and "Movimentos"
 * sheets before writing the new data. If either sheet does not exist,
 * it will be created automatically. The first row written contains
 * column headers.
 *
 * To deploy:
 * 1. Open the Apps Script editor (https://script.google.com) and create
 *    a new script bound to your spreadsheet or as a standalone project.
 * 2. Replace the contents of the default script file with this code.
 * 3. Set the SPREADSHEET_ID constant below to your sheet's ID (found in
 *    the URL of your Google Sheet). For example, in the URL
 *    https://docs.google.com/spreadsheets/d/abc123/edit, the ID is abc123.
 * 4. Save and deploy the script as a Web App (Deploy > New deployment).
 *    Choose Execute as: Me; Who has access: Anyone (or restrict to users
 *    in your domain). Copy the deployment URL; this will be the value of
 *    WEB_APP_URL in your client application.
 * 5. Optionally, re-deploy the script after changes to update the URL.
 */

// TODO: Replace this with your own spreadsheet ID.
var SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';

/**
 * Handles HTTP POST requests from the client. Parses the JSON payload,
 * writes products and movements to the spreadsheet, and returns a JSON
 * response. Supports CORS by setting appropriate headers.
 *
 * @param {Object} e Event parameter containing the POST data.
 * @return {TextOutput} JSON response with success status and message.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, message: 'No POST data' });
    }
    var payload = JSON.parse(e.postData.contents);
    var produtos = Array.isArray(payload.produtos) ? payload.produtos : [];
    var movimentos = Array.isArray(payload.movimentos) ? payload.movimentos : [];

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    // Handle Produtos sheet
    var produtosSheet = ss.getSheetByName('Produtos');
    if (!produtosSheet) {
      produtosSheet = ss.insertSheet('Produtos');
    }
    produtosSheet.clearContents();
    // Write header row
    var produtosHeader = ['Código', 'Nome', 'Preço Unitário', 'Stock Atual'];
    produtosSheet.getRange(1, 1, 1, produtosHeader.length).setValues([produtosHeader]);
    // Write data rows if available
    if (produtos.length > 0) {
      produtosSheet.getRange(2, 1, produtos.length, produtos[0].length).setValues(produtos);
    }

    // Handle Movimentos sheet
    var movimentosSheet = ss.getSheetByName('Movimentos');
    if (!movimentosSheet) {
      movimentosSheet = ss.insertSheet('Movimentos');
    }
    movimentosSheet.clearContents();
    var movimentosHeader = ['Data', 'Tipo', 'Código', 'Quantidade', 'Utilizador'];
    movimentosSheet.getRange(1, 1, 1, movimentosHeader.length).setValues([movimentosHeader]);
    if (movimentos.length > 0) {
      movimentosSheet.getRange(2, 1, movimentos.length, movimentos[0].length).setValues(movimentos);
    }

    return createJsonResponse({ success: true, message: 'Dados gravados com sucesso' });
  } catch (err) {
    return createJsonResponse({ success: false, message: err.message });
  }
}

/**
 * Alias to allow GET requests to use the same logic as POST. Useful for
 * debugging or simple fetch calls. Invokes doPost with the same event
 * parameter.
 *
 * @param {Object} e Event parameter for GET requests.
 * @return {TextOutput} JSON response.
 */
function doGet(e) {
  return doPost(e);
}

/**
 * Creates a TextOutput JSON response with CORS headers enabled.
 *
 * @param {Object} obj JavaScript object to return as JSON.
 * @return {TextOutput} Response with JSON and CORS headers.
 */
function createJsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // Allow all origins and specify allowed methods and headers. Adjust as
  // needed for your deployment. Be cautious when exposing data publicly.
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}