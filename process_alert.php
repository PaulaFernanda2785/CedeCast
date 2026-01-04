<?php

// Verificar se as dependências estão instaladas
if (!file_exists('vendor/autoload.php')) {
    die('Erro: Execute "composer install" para instalar as dependências do projeto.');
}

require_once 'vendor/autoload.php';

// Verificar se as classes do Google API estão disponíveis
if (!class_exists('Google\Client') || !class_exists('Google\Service\Sheets')) {
    die('Erro: Bibliotecas do Google API não encontradas. Certifique-se de que o composer install foi executado corretamente.');
}

use Google\Client;
use Google\Service\Sheets;

// Configurações - SUBSTITUA PELOS SEUS VALORES
$spreadsheetId = '1AXV8IFTqIscYkXZ1D9XU12wC9UFV-pS07AtXe2Z43w8'; // ID da planilha do Google Sheets (apenas o ID, não a URL completa)
$sheetName = 'ALERTA'; // Nome da aba
$credentialsPath = 'credentials.json'; // Caminho para credentials.json
$googleMapsApiKey = 'AIzaSyDLIlR8xQvzQGWGMRYixCJiMXcogRapD_E'; // API Key do Google Maps

// Mesorregiões do Pará (igual ao JS)
$mesorregioes = [
    "Marajó" => ["Bagre","Gurupá","Melgaço","Portel","Afuá","Anajás","Breves","Curralinho","São Sebastião da Boa Vista","Cachoeira do Arari","Chaves","Muaná","Ponta de Pedras","Salvaterra","Santa Cruz do Arari","Soure"],
    "Metropolitana de Belém" => ["Ananindeua","Barcarena","Belém","Benevides","Marituba","Santa Bárbara do Pará","Bujaru","Castanhal","Inhangapi","Santa Izabel do Pará","Santo Antônio do Tauá"],
    "Nordeste Paraense" => ["Colares","Curuçá","Magalhães Barata","Maracanã","Marapanim","Salinópolis","São Caetano de Odivelas","São João da Ponta","São João de Pirabas","Terra Alta","Vigia","Augusto Corrêa","Bonito","Bragança","Capanema","Igarapé-Açu","Nova Timboteua","Peixe-Boi","Primavera","Quatipuru","Santa Maria do Pará","Santarém Novo","São Francisco do Pará","Tracuateua","Abaetetuba","Baião","Cametá","Igarapé-Miri","Limoeiro do Ajuru","Mocajuba","Oeiras do Pará","Acará","Concórdia do Pará","Moju","Tailândia","Tomé-Açu","Aurora do Pará","Cachoeira do Piriá","Capitão Poço","Garrafão do Norte","Ipixuna do Pará","Irituia","Mãe do Rio","Nova Esperança do Piriá","Ourém","Santa Luzia do Pará","São Domingos do Capim","São Miguel do Guamá","Viseu"],
    "Sudoeste Paraense" => ["Aveiro","Itaituba","Jacareacanga","Novo Progresso","Rurópolis","Trairão","Altamira","Anapu","Brasil Novo","Medicilândia","Pacajá","Senador José Porfírio","Uruará","Vitória do Xingu"],
    "Sudeste Paraense" => ["Breu Branco","Itupiranga","Jacundá","Nova Ipixuna","Novo Repartimento","Tucuruí","Abel Figueiredo","Bom Jesus do Tocantins","Dom Eliseu","Goianésia do Pará","Paragominas","Rondon do Pará","Ulianópolis","Bannach","Cumaru do Norte","Ourilândia do Norte","São Félix do Xingu","Tucumã","Água Azul do Norte","Canaã dos Carajás","Curionópolis","Eldorado do Carajás","Parauapebas","Brejo Grande do Araguaia","Marabá","Palestina do Pará","São Domingos do Araguaia","São João do Araguaia","Pau D'Arco","Piçarra","Redenção","Rio Maria","São Geraldo do Araguaia","Sapucaia","Xinguara","Conceição do Araguaia","Floresta do Araguaia","Santa Maria das Barreiras","Santana do Araguaia"],
    "Baixo Amazonas" => ["Alenquer","Almeirim","Belterra","Curuá","Faro","Juruti","Mojuí dos Campos","Monte Alegre","Oriximiná","Placas","Porto de Moz","Prainha","Santarém","Terra Santa","Óbidos"]
];

// Mapeamento de severidade
$mapaSeveridade = [
    "Extreme" => "Grande Perigo",
    "Severe" => "Perigo",
    "Moderate" => "Perigo Potencial"
];

// Função para obter o próximo n_alerta
function getNextNAlerta() {
    $file = 'last_n_alerta.json';
    $currentYear = date('Y');
    $data = ['year' => $currentYear, 'n' => 1];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if ($data['year'] != $currentYear) {
            $data['year'] = $currentYear;
            $data['n'] = 1;
        } else {
            $data['n']++;
        }
    }
    file_put_contents($file, json_encode($data));
    return $data['n'] . '/' . $data['year'];
}

// Função para gerar ID único
function generateID() {
    return uniqid('alert_', true);
}

// Função para normalizar texto (remover acentos e lower)
function normalizeText($s) {
    if (!$s) return "";
    $s = iconv('UTF-8', 'ASCII//TRANSLIT', $s);
    return strtolower(preg_replace('/\s+/', '', $s));
}

// Função para classificar municípios por mesorregião
function classificarPorMesorregiao($municipios, $mesorregioes) {
    $resultado = [];
    foreach ($municipios as $mun) {
        $nomeLimpo = preg_replace('/- PA.*/', '', $mun);
        $nomeNorm = normalizeText($nomeLimpo);
        foreach ($mesorregioes as $meso => $lista) {
            foreach ($lista as $item) {
                if (normalizeText($item) === $nomeNorm) {
                    if (!isset($resultado[$meso])) $resultado[$meso] = [];
                    $resultado[$meso][] = $nomeLimpo;
                    break 2;
                }
            }
        }
    }
    return $resultado;
}

// Função para buscar e parsear o alerta
function fetchAlertData($url, $mesorregioes, $mapaSeveridade) {
    $id = basename($url);
    $apiUrl = "https://apiprevmet3.inmet.gov.br/avisos/rss/{$id}";

    $context = stream_context_create([
        "http" => [
            "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        ]
    ]);

    $xmlContent = file_get_contents($apiUrl, false, $context);
    if (!$xmlContent) {
        throw new Exception("Erro ao buscar o XML do alerta.");
    }

    $xml = simplexml_load_string($xmlContent);
    if (!$xml) {
        throw new Exception("Erro ao parsear o XML.");
    }

    // Assumindo estrutura: rss > channel > item > alert > info
    $alert = $xml->channel->item->alert;
    if (!$alert) {
        throw new Exception("Nenhum alerta encontrado no XML.");
    }

    $info = $alert->info;
    if (!$info) {
        throw new Exception("Informações do alerta não encontradas.");
    }

    // Extrair dados
    $evento = (string)$info->event;
    $severidade = $mapaSeveridade[(string)$info->severity] ?? (string)$info->severity;
    $onset = (string)$info->onset;
    $expires = (string)$info->expires;
    $descricao = (string)$info->description;

    // Municípios
    $municipios = [];
    foreach ($info->parameter as $param) {
        $nome = (string)$param->valueName;
        $valor = (string)$param->value;
        if ($nome === "Municipios") {
            $municipios = array_map('trim', explode(",", $valor));
            $municipios = array_filter($municipios, function($m) {
                return preg_match('/- PA \(\d+\)$/', $m);
            });
            $municipios = array_map(function($m) {
                return preg_replace('/- PA.*/', '', $m);
            }, $municipios);
            break;
        }
    }

    // Classificar
    $mesoClassificacao = classificarPorMesorregiao($municipios, $mesorregioes);

    // Polígono
    $polygon = [];
    $polygonNode = $alert->polygon;
    if ($polygonNode) {
        $coordsText = (string)$polygonNode;
        $coords = explode(" ", trim($coordsText));
        foreach ($coords as $pair) {
            $polygon[] = explode(",", $pair);
        }
    }

    return [
        'evento' => $evento,
        'severidade' => $severidade,
        'onset' => $onset,
        'expires' => $expires,
        'descricao' => $descricao,
        'municipios' => $municipios,
        'mesorregioes' => $mesoClassificacao,
        'polygon' => $polygon
    ];
}

// Função para gerar imagem do mapa
function generateMapImage($polygon, $apiKey) {
    if (empty($polygon)) return '';

    $path = 'color:0xFF0000FF|weight:2|';
    $coords = [];
    foreach ($polygon as $point) {
        $coords[] = $point[1] . ',' . $point[0]; // lat,lng
    }
    $path .= implode('|', $coords);

    $url = "https://maps.googleapis.com/maps/api/staticmap?center=-5,-52&zoom=5&size=600x400&maptype=roadmap&path={$path}&key={$apiKey}";
    return $url;
}

// Função para enviar para Google Sheets
function sendToSheets($data, $spreadsheetId, $sheetName, $credentialsPath) {
    $client = new Client();
    $client->setApplicationName('AUTOSIMD');
    $client->setScopes([Sheets::SPREADSHEETS]);
    $client->setAuthConfig($credentialsPath);
    $client->setAccessType('offline');

    $service = new Sheets($client);

    $regioes = implode('; ', array_keys($data['area_afetada_regiao']));
    $municipios = implode('; ', array_merge(...array_values($data['area_afetada_regiao'])));

    $values = [
        [
            $data['n_alerta'],
            $data['data_alerta'],
            $data['tipo_evento'],
            $data['nivel_gravidade'],
            $data['data_inicial'],
            $data['data_final'],
            $data['imagem'],
            $data['riscos_potenciais'],
            $data['recomendacoes'],
            $regioes,
            $municipios,
            $data['fonte'],
            $data['id']
        ]
    ];

    $body = new Google_Service_Sheets_ValueRange([
        'values' => $values
    ]);

    $range = $sheetName . '!A:M';

    $params = [
        'valueInputOption' => 'RAW'
    ];

    $service->spreadsheets_values->append($spreadsheetId, $range, $body, $params);
}

// Main
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $url = $_POST['url'] ?? '';
    if (!$url) {
        echo json_encode(['error' => 'URL não fornecida']);
        exit;
    }

    try {
        $alertData = fetchAlertData($url, $mesorregioes, $mapaSeveridade);

        $n_alerta = getNextNAlerta();
        $id = generateID();
        $data_alerta = date('d/m/Y H:i');
        $tipo_evento = $alertData['evento'];
        $nivel_gravidade = $alertData['severidade'];
        $data_inicial = $alertData['onset'];
        $data_final = $alertData['expires'];
        $imagem = generateMapImage($alertData['polygon'], $googleMapsApiKey);
        $riscos_potenciais = $alertData['descricao'];
        $recomendacoes = ''; // Não especificado
        $area_afetada_regiao = $alertData['mesorregioes'];
        $fonte = 'INMET';

        $data = [
            'n_alerta' => $n_alerta,
            'data_alerta' => $data_alerta,
            'tipo_evento' => $tipo_evento,
            'nivel_gravidade' => $nivel_gravidade,
            'data_inicial' => $data_inicial,
            'data_final' => $data_final,
            'imagem' => $imagem,
            'riscos_potenciais' => $riscos_potenciais,
            'recomendacoes' => $recomendacoes,
            'area_afetada_regiao' => $area_afetada_regiao,
            'fonte' => $fonte,
            'id' => $id
        ];

        sendToSheets($data, $spreadsheetId, $sheetName, $credentialsPath);

        echo json_encode(['success' => 'Dados enviados para a planilha', 'id' => $id]);

    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    echo 'Método não permitido';
}

?>