// --- globals ---
let dados = {};
let mesoClassificacao = {};
let municipiosDoAlerta = []; // nomes "limpos" (sem '- PA (...)')

const versao = window.location.pathname.split("/").pop().replace(/\.[^/.]+$/, "");
const mapaSeveridade = {
  "Extreme": "Grande Perigo",
  "Severe": "Perigo",
  "Moderate": "Perigo Potencial"
};

const siglaSeveridadeMap = {
  "Grande Perigo": "PX",
  "Perigo": "P",
  "Perigo Potencial": "PP"
};


const mesorregioes = {
  "Marajó": ["Bagre","Gurupá","Melgaço","Portel","Afuá","Anajás","Breves",
    "Curralinho","São Sebastião da Boa Vista","Cachoeira do Arari",
    "Chaves","Muaná","Ponta de Pedras","Salvaterra","Santa Cruz do Arari","Soure"],
  "Metropolitana de Belém": ["Ananindeua","Barcarena","Belém","Benevides","Marituba",
    "Santa Bárbara do Pará","Bujaru","Castanhal","Inhangapi",
    "Santa Izabel do Pará","Santo Antônio do Tauá"],
  "Nordeste Paraense": ["Colares","Curuçá","Magalhães Barata","Maracanã","Marapanim",
    "Salinópolis","São Caetano de Odivelas","São João da Ponta","São João de Pirabas",
    "Terra Alta","Vigia","Augusto Corrêa","Bonito","Bragança","Capanema","Igarapé-Açu",
    "Nova Timboteua","Peixe-Boi","Primavera","Quatipuru","Santa Maria do Pará",
    "Santarém Novo","São Francisco do Pará","Tracuateua","Abaetetuba","Baião",
    "Cametá","Igarapé-Miri","Limoeiro do Ajuru","Mocajuba","Oeiras do Pará","Acará",
    "Concórdia do Pará","Moju","Tailândia","Tomé-Açu","Aurora do Pará","Cachoeira do Piriá",
    "Capitão Poço","Garrafão do Norte","Ipixuna do Pará","Irituia","Mãe do Rio",
    "Nova Esperança do Piriá","Ourém","Santa Luzia do Pará","São Domingos do Capim",
    "São Miguel do Guamá","Viseu"],
  "Sudoeste Paraense": ["Aveiro","Itaituba","Jacareacanga","Novo Progresso","Rurópolis",
    "Trairão","Altamira","Anapu","Brasil Novo","Medicilândia","Pacajá",
    "Senador José Porfírio","Uruará","Vitória do Xingu"],
  "Sudeste Paraense": ["Breu Branco","Itupiranga","Jacundá","Nova Ipixuna",
    "Novo Repartimento","Tucuruí","Abel Figueiredo","Bom Jesus do Tocantins",
    "Dom Eliseu","Goianésia do Pará","Paragominas","Rondon do Pará","Ulianópolis",
    "Bannach","Cumaru do Norte","Ourilândia do Norte","São Félix do Xingu","Tucumã",
    "Água Azul do Norte","Canaã dos Carajás","Curionópolis","Eldorado do Carajás",
    "Parauapebas","Brejo Grande do Araguaia","Marabá","Palestina do Pará",
    "São Domingos do Araguaia","São João do Araguaia","Pau D'Arco","Piçarra",
    "Redenção","Rio Maria","São Geraldo do Araguaia","Sapucaia","Xinguara",
    "Conceição do Araguaia","Floresta do Araguaia","Santa Maria das Barreiras",
    "Santana do Araguaia"],
  "Baixo Amazonas": ["Alenquer","Almeirim","Belterra","Curuá","Faro","Juruti",
    "Mojuí dos Campos","Monte Alegre","Oriximiná","Placas","Porto de Moz","Prainha",
    "Santarém","Terra Santa","Óbidos"]
};

// --- util: normaliza (remove acentos + lower) ---
function normalizeText(s) {
  if (!s) return "";
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatarDataISO(isoStringOuDate) {
  if (!isoStringOuDate) return "";
  const d = isoStringOuDate instanceof Date ? isoStringOuDate : new Date(isoStringOuDate);


  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();

  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${hora}h${min}min`;
}

// --- CLASSIFICADOR ---
function classificarPorMesorregiao(municipios) {
  const resultado = {};
  municipios.forEach(m => {
    const nomeLimpo = m.replace(/- PA.*/, "").trim();
    const nomeNorm = normalizeText(nomeLimpo);
    let encontrado = false;
    for (const [meso, lista] of Object.entries(mesorregioes)) {
      for (const item of lista) {
        if (normalizeText(item) === nomeNorm) {
          if (!resultado[meso]) resultado[meso] = [];
          resultado[meso].push(nomeLimpo);
          encontrado = true;
          break;
        }
      }
      if (encontrado) break;
    }
    // se não encontrado, não adicionamos (será contado no relatório)
  });
  return resultado;
}

// --- BUSCA DO ALERTA ---
// --- helper: tenta buscar direto, se falhar usa AllOrigins como fallback ---
async function fetchWithCorsFallback(origUrl) {
  // tenta buscar direto
  try {
    const resp = await fetch(origUrl);
    if (resp.ok) {
      return await resp.text();
    }
    // se não ok, passa pro proxy
    console.warn('Resposta direta não OK, status:', resp.status);
  } catch (err) {
    // provavelmente CORS ou erro de rede — vamos tentar o proxy
    console.warn('Erro no fetch direto (provável CORS):', err);
  }

  // fallback: AllOrigins (retorna o conteúdo bruto)
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(origUrl)}`;
  const proxResp = await fetch(proxy);
  if (!proxResp.ok) throw new Error('Proxy CORS retornou status ' + proxResp.status);
  return await proxResp.text();
}

// --- buscarAlerta usando fetchWithCorsFallback ---
async function buscarAlerta() {
  const urlInput = document.getElementById("alertUrl").value.trim();
  if (!urlInput) { alert("Informe a URL do alerta."); return; }
  const id = urlInput.split("/").pop();
  const origUrl = `https://apiprevmet3.inmet.gov.br/avisos/rss/${id}`;

  try {
    const text = await fetchWithCorsFallback(origUrl);

    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");

    const alert = xml.querySelector("alert");
    if (!alert) throw new Error("Nenhum alerta encontrado no XML");
    const info = alert.querySelector("info");

    // pega o polígono do XML
    const polygonNode = alert.querySelector("polygon");
    if (polygonNode) {
      const coordsText = polygonNode.textContent.trim();
      const latlngs = coordsText.split(" ").map(pair => {
        const [lat, lon] = pair.split(",").map(Number);
        return [lat, lon];
      });
      exibirPoligono(latlngs);
    }

    // campos principais
    dados = {
      "Evento": info.querySelector("event")?.textContent || "",
      "Severidade": mapaSeveridade[info.querySelector("severity")?.textContent] || info.querySelector("severity")?.textContent || "",
      "Início": formatarDataISO(info.querySelector("onset")?.textContent),
      "Fim": formatarDataISO(info.querySelector("expires")?.textContent),
      "Descrição": info.querySelector("description")?.textContent || "",
      "Estados": ""
    };

    // parâmetros extras -> municípios
    municipiosDoAlerta = [];
    info.querySelectorAll("parameter").forEach(p => {
      const nome = p.querySelector("valueName")?.textContent;
      const valor = p.querySelector("value")?.textContent || "";
      if (nome === "Estados") dados["Estados"] = valor;
      if (nome === "Municipios") {
        const municipios = valor.split(",").map(m => m.trim());
        const municipiosPA = municipios.filter(m => /- PA \(\d+\)$/.test(m));
        municipiosDoAlerta = municipiosPA.map(m => m.replace(/- PA.*/, "").trim());
      }
    });

    // classifica e preenche
    mesoClassificacao = classificarPorMesorregiao(municipiosDoAlerta);
    preencherTabela();
  } catch (e) {
    console.error(e);
    alert("Erro ao buscar/parsear alerta: " + e.message);
  }
}

let mapa, camadaPoligono;

function inicializarMapa() {
  if (!mapa) {
    mapa = L.map("map").setView([-5, -52], 5); // centro inicial aproximado Pará
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(mapa);
  }
}

function exibirPoligono(latlngs) {
  inicializarMapa();
  // remove polígono anterior se existir
  if (camadaPoligono) {
    mapa.removeLayer(camadaPoligono);
  }
  camadaPoligono = L.polygon(latlngs, { color: "red", weight: 2 }).addTo(mapa);
  mapa.fitBounds(camadaPoligono.getBounds());
}

// --- PREENCHER TABELA ---
function preencherTabela() {
  const tabela = document.getElementById("tabela");
  const tbody = tabela.querySelector("tbody");
  tbody.innerHTML = "";

  // campos básicos
  Object.entries(dados).forEach(([campo, valor]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><b>${campo}</b></td><td>${valor}</td>`;
    tbody.appendChild(tr);
  });

  // mesorregiões (cada uma em sua linha + botão copiar)
  Object.entries(mesoClassificacao).forEach(([meso, munis]) => {
    const tr = document.createElement("tr");
    const tdMeso = document.createElement("td");
    tdMeso.innerHTML = `<b>${meso}</b>`;

    const tdMunis = document.createElement("td");
    tdMunis.textContent = munis.join(", ");

    const btn = document.createElement("button");
    btn.textContent = "📋 Copiar";
    btn.style.marginLeft = "8px";
    btn.addEventListener("click", () => copiarTexto(munis.join(", ")));
    tdMunis.appendChild(btn);

    tr.appendChild(tdMeso);
    tr.appendChild(tdMunis);
    tbody.appendChild(tr);
  });

  tabela.style.display = "table";

  // gerar relatório ao final
  gerarRelatorio();
}

// --- EXPORTAR EXCEL ---
function exportarExcel() {
  if (!Object.keys(dados).length) {
    alert("Nenhum dado para exportar!");
    return;
  }

  const linhas = [];
  Object.entries(dados).forEach(([campo, valor]) => {
    linhas.push({ Campo: campo, Valor: valor });
  });
  Object.entries(mesoClassificacao).forEach(([meso, munis]) => {
    linhas.push({ Campo: meso, Valor: munis.join(", ") });
  });

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alerta");
  XLSX.writeFile(wb, "alerta_inmet.xlsx");
}

// --- COPIAR (com fallback) ---
function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => {
      alert("Copiado para o clipboard!");
    }).catch(() => {
      fallbackCopy(texto);
    });
  } else {
    fallbackCopy(texto);
  }
}
function fallbackCopy(texto) {
  const ta = document.createElement("textarea");
  ta.value = texto;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    alert('Copiado (fallback)!');
  } catch (e) {
    alert('Não foi possível copiar automaticamente. Copie manualmente:\n\n' + texto);
  } finally {
    document.body.removeChild(ta);
  }
}

// --- BAIXAR KML ---
function baixarKML() {
  if (!camadaPoligono) {
    alert("Nenhum polígono carregado no mapa!");
    return;
  }

  // --- Nome do evento e severidade ---
  let nomeEvento = dados["Evento"] || "alerta";
  nomeEvento = normalizeText(nomeEvento).replace(/\s+/g, "");
  const severidade = dados["Severidade"] || "";
  const inicio = dados["Início"] || "";
  const sigla = siglaSeveridadeMap[severidade] || "X";
  const dataMatch = inicio.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const dataCompacta = dataMatch ? `${dataMatch[3]}${dataMatch[2]}${dataMatch[1]}` : "00000000";
  const nomeArquivo = `${dataCompacta}_${nomeEvento}_${sigla}.kml`;

   const latlngs = camadaPoligono.getLatLngs()[0];
   const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${nomeEvento}</name>
    <Placemark>
      <name>${nomeEvento}</name>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>2</width>
        </LineStyle>
        <PolyStyle>
          <color>7dff0000</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>`;

  const coordsText = "\n" + latlngs.map(pt => `${pt.lng},${pt.lat},0`).join("\n") + "\n";

  const kmlFooter = `          </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

  const kmlContent = kmlHeader + coordsText + kmlFooter;

  // --- Download automático ---
  const blob = new Blob([kmlContent], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Listener para o botão Baixar KML ---
document.getElementById("btnBaixarKML").addEventListener("click", baixarKML);

// --- GERAR RELATÓRIO ---
function gerarRelatorio() {
  let rel = `AUTOSIMD (${versao}) - Relatório de Alertas INMET (CBMPA E DEFESA CIVIL)\n`;
  rel += "-------------------------------------------------------------------\n";
  rel += "Dados Gerais do Alerta\n";
  rel += "--------------------------------------------------\n";
  rel += `Aviso de::: ${dados["Evento"] || ""}\n`;
  rel += `Grau de severidade::: ${dados["Severidade"] || ""}\n`;
  rel += `Riscos Potenciais::: ${dados["Descrição"] || ""}\n\n`;
  rel += "Lista dos Municípios Afetados Pelo Alerta\n";
  rel += "--------------------------------------------------\n";
  let total = 0;
  Object.entries(mesoClassificacao).forEach(([meso, munis]) => {
    rel += `Mesorregião: ${meso}\n`;
    rel += `${munis.join(", ")}\n\n`;
    total += munis.length;
  });

  rel += `Total de municípios afetados: ${total}\n`;

  const agora = new Date();
  const dataFormatada = formatarDataISO(agora);
  rel += `Hora da coleta: ${dataFormatada}\n`;

  const ta = document.getElementById("relatorio");
  if (ta) ta.value = rel;
}

// --- COPIAR RELATÓRIO (botão) ---
function copiarRelatorio() {
  const ta = document.getElementById("relatorio");
  if (!ta) return alert("Relatório não encontrado.");
  copiarTexto(ta.value);
}
// --- listeners (botão e Enter) ---
document.getElementById("btnBuscar").addEventListener("click", buscarAlerta);
document.getElementById("btnCopiarRelatorio").addEventListener("click", copiarRelatorio);
document.getElementById("alertUrl").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarAlerta();
  }
});