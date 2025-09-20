# Sistema de Gestão de Inventário Simples (SGIS)

Este projecto implementa um **Sistema de Gestão de Inventário Simples (SGIS)** conforme descrito no PRD e SPEC fornecidos.  O objectivo é fornecer uma solução leve e de baixo custo para pequenas empresas portuguesas controlarem o seu stock através de um telemóvel e gerar facilmente ficheiros de inventário compatíveis com os contabilistas.

O repositório contém duas componentes principais:

* **Aplicação Web (PWA)** – uma aplicação em HTML/JavaScript que corre no navegador do telemóvel.  É capaz de ler códigos de barras usando a câmara do dispositivo, registar entradas e saídas de stock, consultar produtos e exportar um ficheiro Excel/CSV.  A aplicação funciona offline e guarda as operações pendentes localmente quando não há ligação à Internet.  Quando a ligação é restabelecida, as operações são sincronizadas com o Google Sheets.
* **Google Apps Script** – um script que corre na conta Google do cliente.  Este script expõe um web‑service (através da funcionalidade *“Deploy as Web App”*), que recebe as operações da aplicação web e actualiza automaticamente as folhas de cálculo no Google Sheets.  Também trata de gerar o ficheiro Excel e guardá‑lo na pasta **Inventário** do Google Drive do cliente.

> **Nota:** A aplicação foi escrita de forma a não depender de um servidor central.  Todos os dados ficam armazenados na conta Google do próprio cliente (Sheets e Drive).  As credenciais e permissões do Google são geridas pelo cliente quando publicar o Apps Script.

## Como testar

1. **Crie uma cópia do Google Sheet:**
   - Crie um novo Google Sheets com duas folhas chamadas `Produtos` e `Movimentos`.
   - Na folha `Produtos` adicione cabeçalhos nas colunas A‑G, conforme o modelo de dados: `Código | Nome | Categoria | Preço Unitário | Stock Atual | Última Entrada | Última Saída`.
   - Na folha `Movimentos` adicione cabeçalhos: `Data | Tipo | Código | Quantidade | Utilizador`.

2. **Configure o Google Apps Script:**
   - Abra o menu **Extensões → Apps Script** no Google Sheets.
   - Copie o conteúdo de `gas_code.gs` para o editor de scripts.
   - Substitua `SPREADSHEET_ID` no topo do script pelo ID do seu Sheets.
   - Publique o script como um Web App: **Deploy → New deployment**
     - Escolha *Web app*.
     - Defina um nome (por exemplo `SGIS API`).
     - Defina o acesso como **Anyone** (para simplificar o MVP).  Pode restringir mais tarde.
     - Clique em **Deploy** e autorize o acesso às permissões solicitadas (Sheets e Drive).
   - Copie a URL do Web App (termina com `/exec`).  Esta URL será usada na aplicação web.

3. **Preparar a aplicação Web:**
   - Edite o ficheiro `app.js` e actualize a constante `SCRIPT_URL` com a URL do Web App obtida no passo anterior.
   - Abra `index.html` num navegador compatível (Chrome recente no telemóvel).  Autorize o acesso à câmara quando solicitado.

4. **Fluxo de utilização:**
   - **Entrada:** Clique em `Entrada de Stock` e faça scan do código de barras.  Introduza a quantidade e confirme.  Se o produto não existir, a aplicação pedirá nome e preço unitário.
   - **Saída:** Clique em `Saída de Stock`, faça scan e introduza a quantidade a retirar.
   - **Consulta:** Clique em `Consultar Stock`, faça scan e veja o stock actual e preço.
   - **Exportar:** Clique em `Exportar Inventário` para gerar um ficheiro Excel na pasta *Inventário* do seu Google Drive.

## Offline e sincronização

A aplicação tenta sempre contactar o Apps Script.  Se não houver ligação à Internet ou o pedido falhar, a operação fica guardada localmente (no `localStorage`) na lista *Pendentes*.  Quando voltar a estar online, clique em `Sincronizar Pendentes` para enviar estas operações para o Google Sheets.  Isto garante que as contagens feitas offline são preservadas e não se perdem.

## Considerações futuras

O projecto foi estruturado para permitir evoluções posteriores, conforme o SPEC:

* **Vários utilizadores:** a coluna `Utilizador` em `Movimentos` pode ser usada para distinguir quem registou a operação quando houver autenticação.
* **Relatórios:** podem ser implementados no próprio Google Sheets ou em Apps Script.
* **App nativa:** a base de código pode servir de referência quando a versão Flutter com base de dados local for desenvolvida.
