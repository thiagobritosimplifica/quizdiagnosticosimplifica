/**
 * Diagnóstico do Atendimento Comercial — Simplifica
 * API da planilha (Google Apps Script)
 *
 * Esta planilha é o banco de dados do quiz. O site grava e lê os leads aqui.
 *
 * ---------------------------------------------------------------
 * COMO INSTALAR
 * ---------------------------------------------------------------
 * 1. Abra a planilha > menu Extensões > Apps Script.
 * 2. Apague o conteúdo do arquivo Código.gs e cole TODO este arquivo.
 * 3. Troque o valor de SEGREDO abaixo por uma senha sua (qualquer texto longo).
 * 4. Salve (ícone de disquete).
 * 5. Clique em Implantar > Nova implantação.
 *      Tipo: App da Web
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 * 6. Autorize o acesso quando o Google pedir.
 * 7. Copie a URL gerada (termina em /exec) e coloque no .env.local do site:
 *      SHEETS_WEBAPP_URL=<a URL copiada>
 *      SHEETS_SECRET=<o mesmo SEGREDO daqui>
 *
 * Alterou este código depois? Implantar > Gerenciar implantações > editar
 * (ícone de lápis) > Versão: Nova versão > Implantar. A URL continua a mesma.
 * ---------------------------------------------------------------
 */

/*
 * ATENÇÃO: preencha com o mesmo valor de SHEETS_SECRET do .env.local.
 * O valor real NÃO fica neste arquivo porque o repositório é público —
 * ele vive apenas no .env.local do site e neste script já publicado.
 * Se os dois não baterem, toda chamada volta "Segredo inválido".
 */
var SEGREDO = "COLE_AQUI_O_MESMO_SHEETS_SECRET_DO_ENV_LOCAL";

/** Nome da aba usada. Deixe em branco para usar a primeira aba da planilha. */
var ABA = "";

/**
 * Só é necessário se o script NÃO estiver vinculado à planilha.
 * É o trecho da URL entre /d/ e /edit:
 * docs.google.com/spreadsheets/d/AQUI_O_ID/edit
 */
var ID_PLANILHA = "";

var COLUNAS_FIXAS = [
  "ID",
  "Data",
  "Horário",
  "Nome",
  "WhatsApp",
  "E-mail",
  "Instagram",
  "Cargo",
  "Faturamento mensal",
  "Pontuação",
  "Resultado",
];

var COLUNAS_FINAIS = [
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "UTM Term",
  "UTM Content",
  "Referrer",
  "created_at",
  "_dados",
];

var FUSO = "America/Sao_Paulo";

function documento() {
  // Script vinculado à planilha (Extensões > Apps Script): usa a planilha ativa.
  var ativo = SpreadsheetApp.getActiveSpreadsheet();
  if (ativo) return ativo;

  // Script avulso: precisa do ID da planilha preenchido em ID_PLANILHA.
  if (!ID_PLANILHA) {
    throw new Error(
      "Script não está vinculado a nenhuma planilha. Preencha ID_PLANILHA " +
        "ou recrie o script pelo menu Extensões > Apps Script da planilha."
    );
  }
  return SpreadsheetApp.openById(ID_PLANILHA);
}

function planilha() {
  var doc = documento();
  var aba = ABA ? doc.getSheetByName(ABA) : null;
  return aba || doc.getSheets()[0];
}

function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  return resposta({
    ok: true,
    data: "API da planilha ativa. O site envia os dados por POST.",
  });
}

function doPost(e) {
  try {
    var corpo = JSON.parse(e.postData.contents);

    if (SEGREDO && corpo.secret !== SEGREDO) {
      return resposta({ ok: false, error: "Segredo inválido." });
    }

    if (corpo.action === "insert") return inserir(corpo.lead);
    if (corpo.action === "list") return listar();
    if (corpo.action === "diag") return diagnostico();
    if (corpo.action === "arrumar-cabecalho") return arrumarCabecalho();
    if (corpo.action === "limpar") return limpar(corpo.confirmar);

    return resposta({ ok: false, error: "Ação desconhecida: " + corpo.action });
  } catch (erro) {
    return resposta({ ok: false, error: String(erro) });
  }
}

/** Mostra em qual planilha e aba o script está realmente mexendo. */
function diagnostico() {
  var doc = documento();
  var aba = planilha();
  var abas = doc.getSheets().map(function (s) {
    return s.getName() + " (" + s.getLastRow() + " linhas)";
  });

  return resposta({
    ok: true,
    data: {
      vinculado: SpreadsheetApp.getActiveSpreadsheet() !== null,
      planilha: doc.getName(),
      planilhaId: doc.getId(),
      url: doc.getUrl(),
      abaUsada: aba.getName(),
      ultimaLinha: aba.getLastRow(),
      ultimaColuna: aba.getLastColumn(),
      abas: abas,
    },
  });
}

/**
 * Apaga TODAS as linhas de lead, preservando o cabeçalho.
 * Serve para zerar os dados de teste antes de colocar no ar.
 * Exige confirmar: "APAGAR TUDO" para não disparar sem querer.
 */
function limpar(confirmar) {
  if (confirmar !== "APAGAR TUDO") {
    return resposta({
      ok: false,
      error: 'Para limpar, envie confirmar: "APAGAR TUDO".',
    });
  }

  var aba = planilha();
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 2) return resposta({ ok: true, data: { apagadas: 0 } });

  var valores = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();

  // Apaga de baixo para cima para os índices não escorregarem.
  var apagadas = 0;
  for (var i = valores.length - 1; i >= 0; i--) {
    if (acharDados(valores[i])) {
      aba.deleteRow(i + 1);
      apagadas++;
    }
  }
  SpreadsheetApp.flush();

  return resposta({ ok: true, data: { apagadas: apagadas } });
}

/** Monta o cabeçalho usando os pilares das perguntas do próprio lead. */
function cabecalho(lead) {
  var linha = COLUNAS_FIXAS.slice();
  var respostas = lead.answers || [];
  for (var i = 0; i < respostas.length; i++) {
    linha.push("P" + respostas[i].question_id + " — " + respostas[i].pillar);
  }
  return linha.concat(COLUNAS_FINAIS);
}

function inserir(lead) {
  if (!lead) return resposta({ ok: false, error: "Lead ausente." });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var aba = planilha();

    if (aba.getLastRow() === 0) {
      var titulos = cabecalho(lead);
      aba.appendRow(titulos);
      var faixa = aba.getRange(1, 1, 1, titulos.length);
      faixa.setFontWeight("bold");
      faixa.setBackground("#0b1124");
      faixa.setFontColor("#f2f5fc");
      aba.setFrozenRows(1);
    }

    var criado = new Date(lead.created_at);
    var linha = [
      lead.id,
      Utilities.formatDate(criado, FUSO, "dd/MM/yyyy"),
      Utilities.formatDate(criado, FUSO, "HH:mm:ss"),
      lead.name,
      lead.whatsapp,
      lead.email,
      lead.instagram || "",
      lead.cargo || "",
      lead.faturamento || "",
      lead.score,
      lead.tier_label,
    ];

    var respostas = lead.answers || [];
    for (var i = 0; i < respostas.length; i++) {
      var r = respostas[i];
      linha.push(r.answer_id + ") " + r.answer_label + " (" + r.points + " pts)");
    }

    linha.push(
      lead.utm_source || "",
      lead.utm_medium || "",
      lead.utm_campaign || "",
      lead.utm_term || "",
      lead.utm_content || "",
      lead.referrer || "",
      lead.created_at,
      JSON.stringify({ tier_id: lead.tier_id, answers: respostas })
    );

    aba.appendRow(linha);
    SpreadsheetApp.flush(); // garante a escrita antes de liberar o lock

    var primeiraCelula = String(aba.getRange(1, 1).getValue() || "").trim();

    return resposta({
      ok: true,
      data: {
        id: lead.id,
        planilha: aba.getParent().getName(),
        aba: aba.getName(),
        linha: aba.getLastRow(),
        // Alerta: a planilha tem um cabeçalho que não é o desta integração.
        cabecalhoEstranho: primeiraCelula !== "ID",
      },
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Localiza a coluna _dados (a última que contém um JSON com "answers").
 * É o que identifica uma linha como lead — assim a leitura não depende
 * de como está escrito o cabeçalho da planilha.
 */
function acharDados(linha) {
  for (var i = linha.length - 1; i >= 0; i--) {
    var valor = linha[i];
    if (typeof valor !== "string") continue;
    var texto = valor.trim();
    if (texto.charAt(0) !== "{") continue;
    try {
      var json = JSON.parse(texto);
      if (json && json.answers) return { indice: i, dados: json };
    } catch (erro) {
      // segue procurando
    }
  }
  return null;
}

function textoDe(linha, indice) {
  var valor = indice >= 0 && indice < linha.length ? linha[indice] : "";
  return valor === null || valor === undefined ? "" : String(valor);
}

function listar() {
  var aba = planilha();
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 1 || ultimaColuna < 1) return resposta({ ok: true, data: [] });

  var valores = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();
  var leads = [];

  for (var l = 0; l < valores.length; l++) {
    var linha = valores[l];
    var encontrado = acharDados(linha);
    if (!encontrado) continue; // cabeçalho, linha vazia ou linha estranha

    var d = encontrado.indice; // posição de _dados
    var criado = linha[d - 1];
    if (criado instanceof Date) criado = criado.toISOString();

    leads.push({
      id: textoDe(linha, 0),
      created_at: String(criado || ""),
      name: textoDe(linha, 3),
      whatsapp: textoDe(linha, 4),
      email: textoDe(linha, 5),
      instagram: textoDe(linha, 6),
      cargo: textoDe(linha, 7),
      faturamento: textoDe(linha, 8),
      score: Number(linha[9]) || 0,
      tier_label: textoDe(linha, 10),
      tier_id: encontrado.dados.tier_id || "",
      answers: encontrado.dados.answers || [],
      consent: true,
      // Contando de trás para frente a partir de _dados (d):
      // d-1 created_at, d-2 referrer, d-3 utm_content, d-4 utm_term,
      // d-5 utm_campaign, d-6 utm_medium, d-7 utm_source.
      utm_source: textoDe(linha, d - 7),
      utm_medium: textoDe(linha, d - 6),
      utm_campaign: textoDe(linha, d - 5),
      utm_term: textoDe(linha, d - 4),
      utm_content: textoDe(linha, d - 3),
      referrer: textoDe(linha, d - 2),
      user_agent: "",
    });
  }

  return resposta({ ok: true, data: leads });
}

/**
 * Reescreve a linha 1 com o cabeçalho correto, montado a partir das
 * perguntas do primeiro lead já gravado. Use quando a planilha tiver
 * um cabeçalho antigo ou desalinhado.
 */
function arrumarCabecalho() {
  var aba = planilha();
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 1) return resposta({ ok: false, error: "Planilha vazia." });

  var valores = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();

  var modelo = null;
  var linhaDoPrimeiroLead = 0;
  for (var i = 0; i < valores.length; i++) {
    var achado = acharDados(valores[i]);
    if (achado) {
      modelo = achado.dados;
      linhaDoPrimeiroLead = i + 1;
      break;
    }
  }
  if (!modelo) {
    return resposta({ ok: false, error: "Nenhum lead gravado para montar o cabeçalho." });
  }

  var titulos = cabecalho({ answers: modelo.answers });

  // Se a linha 1 já for um lead, abre espaço em vez de sobrescrever.
  if (linhaDoPrimeiroLead === 1) aba.insertRowBefore(1);

  var largura = Math.max(aba.getLastColumn(), titulos.length);
  aba.getRange(1, 1, 1, largura).clearContent();

  var faixa = aba.getRange(1, 1, 1, titulos.length);
  faixa.setValues([titulos]);
  faixa.setFontWeight("bold");
  faixa.setBackground("#0b1124");
  faixa.setFontColor("#f2f5fc");
  aba.setFrozenRows(1);
  SpreadsheetApp.flush();

  return resposta({ ok: true, data: { colunas: titulos.length, titulos: titulos } });
}
