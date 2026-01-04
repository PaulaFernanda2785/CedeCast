# AUTOSIMD - Processamento de Alertas INMET em PHP

Este script PHP processa links de alertas do INMET e envia os dados para uma planilha do Google Sheets.

## Configuração

1. Instale o Composer: https://getcomposer.org/

2. Execute `composer install` na raiz do projeto.

3. Configure a Google Sheets API:
   - Crie um projeto no Google Cloud Console.
   - Ative a Google Sheets API.
   - Crie credenciais de conta de serviço e baixe o `credentials.json`.
   - Coloque o `credentials.json` na raiz do projeto.

4. Obtenha uma API Key para Google Maps Static API.

5. Edite o `process_alert.php`:
   - Substitua `YOUR_SPREADSHEET_ID` pelo ID da sua planilha.
   - Substitua `YOUR_GOOGLE_MAPS_API_KEY` pela sua API Key.

6. Compartilhe a planilha com o email da conta de serviço.

## Uso

Envie uma requisição POST para `process_alert.php` com o parâmetro `url` contendo o link do alerta.

Exemplo:
```
curl -X POST -d "url=https://exemplo.com/alerta" http://localhost/process_alert.php
```

## Campos da Planilha

- n_alerta: Sequência numérica/ano
- data_alerta: Data e hora do processamento
- tipo_evento: Tipo do evento
- nivel_gravidade: Nível de gravidade
- data_inicial: Data inicial do alerta
- data_final: Data final do alerta
- imagem: URL da imagem do mapa
- riscos_potenciais: Descrição dos riscos
- recomendacoes: (Vazio)
- area_afetada_regiao: Regiões afetadas (separadas por ;)
- area_afetada_municipio: Municípios afetados (separados por ;)
- fonte: INMET
- id: ID único do alerta