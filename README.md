# Forex IA Studio v67 - JSX testado

Corrige definitivamente o erro do ValidationChecklist: agora o retorno JSX usa Fragment (`<>...</>`).

## Rodar

```cmd
cd C:\robo2606\v67
npm install
npm start
```

Abra:

```text
http://localhost:3000/?v=67
```

## v123 - WhatsApp real com Evolution API

A versão v123 adiciona uma tela em **Instalação > WhatsApp Evolution API** para conectar o FOREX IA ao WhatsApp via Evolution API.

### Rodar Evolution API localmente

```bash
docker compose -f docker-compose.evolution.yml up -d
```

Depois, no sistema:

- URL: `http://localhost:8080`
- Instância: `forex-ia`
- API Key global: `forex-ia-123456`

Clique em **Criar instância + QR**, escaneie o QR Code no WhatsApp e use **Enviar alerta teste** no Agente de Voz.
