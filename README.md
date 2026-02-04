# 🎬 Video Downloader

Sistema fullstack robusto para download de vídeos do **YouTube**, **TikTok** e **Twitter/X** com arquitetura resiliente e interface neo-brutalista.

## ✨ Funcionalidades Principais

### Download
- 🔗 **Detecção automática** de plataforma (YouTube, TikTok, Twitter/X)
- 📺 **Download de vídeo** com áudio (MP4) - qualidades de 144p a 4K
- 🎵 **Download somente áudio** (MP3 ou M4A)
- 📊 **Seleção dinâmica** de qualidade (mostra apenas qualidades disponíveis)
- 📈 **Progresso em tempo real** com barra animada
- 🔄 **Download único ou múltiplo** (batch)

### Resiliência
- 🔁 **Retry automático** com backoff exponencial (3 tentativas)
- 📉 **Fallback de qualidade** (1080p → 720p → 480p → 360p)
- 🔌 **Circuit breaker** por plataforma (proteção contra instabilidades)
- ⏱️ **Timeouts configuráveis** (30s info, 30min download)
- 🛡️ **Rate limiting** por IP (10 downloads/min, 20 info/min)

### Anti-bloqueio
- 🔄 **Rotação de User-Agent** (15 variações)
- 📋 **Headers customizados** por plataforma
- 🌐 **Suporte a proxy** (HTTP, HTTPS, SOCKS4, SOCKS5)

### Interface
- 📱 **Design responsivo** (mobile-first)
- 🎨 **Neo-brutalismo** (bordas grossas, cores vibrantes)
- 📋 **Histórico local** (localStorage)
- ✅ **Indicador de qualidade recomendada**

---

## 🛠️ Tecnologias

### Backend (TypeScript)
| Tecnologia | Uso |
|------------|-----|
| Node.js 20+ | Runtime |
| Express 4 | API REST |
| TypeScript 5 | Type safety |
| yt-dlp | Engine de download |
| Pino | Logging estruturado |
| Zod | Validação |

### Frontend (React)
| Tecnologia | Uso |
|------------|-----|
| Next.js 14 | Framework React |
| React 18 | UI Components |
| Tailwind CSS 3 | Estilização |
| TypeScript | Type safety |

---

## 📁 Estrutura do Projeto

```
Downloader/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── app.ts                   # Express config
│   │   ├── config/
│   │   │   ├── app.config.ts        # Configurações gerais
│   │   │   └── resilience.config.ts # Retry, timeout, circuit breaker
│   │   ├── types/
│   │   │   ├── error.types.ts       # Erros estruturados (24 tipos)
│   │   │   ├── platform.types.ts    # Enum Platform
│   │   │   ├── video.types.ts       # VideoFormat, VideoInfo
│   │   │   └── download.types.ts    # DownloadRequest, Progress
│   │   ├── errors/
│   │   │   └── error-classifier.ts  # Classifica erros do yt-dlp
│   │   ├── providers/
│   │   │   ├── base.provider.ts     # Interface abstrata
│   │   │   ├── youtube.provider.ts  # YouTube (merge áudio/vídeo)
│   │   │   ├── tiktok.provider.ts   # TikTok (filtro watermark)
│   │   │   └── twitter.provider.ts  # Twitter/X
│   │   ├── engines/
│   │   │   └── ytdlp.engine.ts      # Wrapper yt-dlp
│   │   ├── services/
│   │   │   ├── download.service.ts  # Orquestração de download
│   │   │   ├── info.service.ts      # Busca info com cache
│   │   │   ├── validation.service.ts
│   │   │   └── health.service.ts
│   │   ├── infrastructure/
│   │   │   ├── queue.ts             # Fila com timeout
│   │   │   ├── cache.ts             # LRU Cache
│   │   │   ├── rate-limiter.ts      # Sliding window
│   │   │   ├── circuit-breaker.ts   # CLOSED/OPEN/HALF_OPEN
│   │   │   └── metrics.ts
│   │   ├── resilience/
│   │   │   ├── retry-with-backoff.ts
│   │   │   ├── timeout-handler.ts
│   │   │   └── fallback-chain.ts
│   │   ├── anti-blocking/
│   │   │   ├── user-agent-rotator.ts
│   │   │   ├── headers-manager.ts
│   │   │   └── proxy-manager.ts
│   │   ├── logging/
│   │   │   └── logger.ts            # Pino structured logging
│   │   ├── middleware/
│   │   │   └── error-handler.middleware.ts
│   │   └── routes/
│   │       ├── info.routes.ts
│   │       ├── download.routes.ts
│   │       ├── health.routes.ts
│   │       └── admin.routes.ts
│   ├── downloads/                   # Arquivos temporários
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Página principal
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── DownloaderForm.tsx       # Formulário principal
│   │   └── DownloadHistory.tsx
│   ├── tailwind.config.ts
│   └── package.json
├── package.json                     # Scripts raiz
└── README.md
```

---

## 🚀 Instalação

### Pré-requisitos
- **Node.js 18+**
- **npm** ou **yarn**
- **yt-dlp** (`pip install yt-dlp` ou `brew install yt-dlp`)
- **ffmpeg** (para merge de áudio/vídeo)

### Instalar ffmpeg

**macOS:**
```bash
brew install ffmpeg yt-dlp
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
pip install yt-dlp
```

**Windows:**
```bash
winget install ffmpeg
pip install yt-dlp
```

### Instalar dependências

```bash
# Na raiz do projeto
npm run install:all
```

Ou manualmente:
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

---

## ▶️ Executar

### Modo desenvolvimento (backend + frontend)
```bash
npm run dev
```

### Separadamente:

**Backend** (porta 3001):
```bash
cd backend && npm run dev
```

**Frontend** (porta 3000):
```bash
cd frontend && npm run dev
```

Acesse: **http://localhost:3000**

---

## 📝 API Endpoints

### Info

#### `POST /api/info`
Busca metadados do vídeo.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=abc123"
}
```

**Response (200):**
```json
{
  "success": true,
  "platform": "youtube",
  "videoInfo": {
    "title": "Título do vídeo",
    "duration": 180,
    "thumbnail": "https://i.ytimg.com/...",
    "uploader": "Nome do Canal",
    "viewCount": 12345,
    "likeCount": 500
  },
  "formats": {
    "video": [
      { "formatId": "137", "quality": "1080p", "height": 1080, "ext": "mp4" },
      { "formatId": "136", "quality": "720p", "height": 720, "ext": "mp4" }
    ],
    "audio": [
      { "formatId": "bestaudio", "quality": "Melhor qualidade", "ext": "mp3" }
    ]
  },
  "availableQualities": ["1080p", "720p", "480p", "360p"],
  "recommendedQuality": "720p"
}
```

### Download

#### `POST /api/download`
Inicia download (entra na fila).

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=abc123",
  "type": "video",
  "quality": "720p",
  "ext": "mp4"
}
```

**Response (200):**
```json
{
  "downloadId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "position": 1,
  "message": "Iniciando download..."
}
```

#### `GET /api/progress/:downloadId`
Verifica progresso.

**Response (downloading):**
```json
{
  "progress": 45,
  "status": "downloading",
  "position": 1
}
```

**Response (completed):**
```json
{
  "progress": 100,
  "status": "completed",
  "filename": "youtube-video1.mp4",
  "downloadUrl": "/downloads/youtube-video1.mp4"
}
```

**Response (error):**
```json
{
  "progress": 0,
  "status": "error",
  "error": "Vídeo não disponível ou removido."
}
```

#### `GET /api/file/:downloadId`
Baixa o arquivo finalizado.

### Health & Admin

#### `GET /api/health`
Status do sistema.

```json
{
  "status": "healthy",
  "timestamp": "2026-02-03T20:00:00.000Z",
  "components": {
    "ytdlp": { "healthy": true, "version": "2026.01.29" },
    "queues": {
      "info": { "running": 0, "queued": 0 },
      "download": { "running": 1, "queued": 2 }
    },
    "circuitBreakers": {
      "youtube": "closed",
      "tiktok": "closed",
      "twitter": "closed"
    }
  }
}
```

#### `GET /api/metrics`
Métricas detalhadas.

#### `POST /api/update`
Atualiza yt-dlp manualmente.

#### `POST /api/cache/clear`
Limpa cache de metadados.

---

## 🔄 Sistema de Resiliência

### Retry com Backoff Exponencial

```
Tentativa 1 → falha → espera 1s
Tentativa 2 → falha → espera 2s (+ jitter 10%)
Tentativa 3 → falha → erro final
```

| Configuração | Valor |
|--------------|-------|
| Máximo tentativas | 3 |
| Delay inicial | 1000ms |
| Fator backoff | 2x |
| Delay máximo | 30000ms |
| Jitter | 10% |

### Fallback de Qualidade

Quando um formato não está disponível, tenta automaticamente:

```
1080p → 720p → 480p → 360p → 240p → 144p
```

### Circuit Breaker (por plataforma)

Protege contra plataformas instáveis:

```
CLOSED (normal)
    │
    ▼ 5 falhas consecutivas
OPEN (bloqueado 60s)
    │
    ▼ após timeout
HALF_OPEN (testa 3 requests)
    │
    ├─ sucesso → CLOSED
    └─ falha → OPEN
```

### Timeouts

| Operação | Timeout |
|----------|---------|
| Buscar info | 30 segundos |
| Início download | 60 segundos |
| Download total | 30 minutos |
| Atualizar yt-dlp | 2 minutos |
| Espera na fila | 5 minutos |

---

## ⚠️ Tratamento de Erros

### Tipos de Erro (24 categorias)

#### Erros de Rede (retentáveis)
| Código | Mensagem |
|--------|----------|
| `NETWORK_TIMEOUT` | Conexão expirou. Tente novamente. |
| `NETWORK_UNREACHABLE` | Não foi possível conectar. |
| `NETWORK_DNS_FAILURE` | Falha ao resolver endereço. |
| `NETWORK_CONNECTION_RESET` | Conexão interrompida. |

#### Erros de Plataforma
| Código | Mensagem | Retentável |
|--------|----------|------------|
| `PLATFORM_VIDEO_UNAVAILABLE` | Vídeo não disponível ou removido. | ❌ |
| `PLATFORM_VIDEO_PRIVATE` | Este vídeo é privado. | ❌ |
| `PLATFORM_VIDEO_REMOVED` | O vídeo foi removido. | ❌ |
| `PLATFORM_AGE_RESTRICTED` | Vídeo com restrição de idade. | ❌ |
| `PLATFORM_GEO_RESTRICTED` | Vídeo não disponível em sua região. | ❌ |
| `PLATFORM_AUTH_REQUIRED` | Vídeo requer autenticação. | ❌ |
| `PLATFORM_RATE_LIMITED` | Muitas requisições. Aguarde. | ✅ |
| `PLATFORM_BLOCKED` | Acesso bloqueado. | ✅ |

#### Erros de Formato (retentáveis com fallback)
| Código | Mensagem |
|--------|----------|
| `FORMAT_NOT_AVAILABLE` | Formato não disponível. Tente outra qualidade. |
| `FORMAT_EXTRACTION_FAILED` | Falha ao processar vídeo. |
| `FORMAT_MERGE_FAILED` | Falha ao processar áudio/vídeo. |

#### Erros Internos
| Código | Mensagem |
|--------|----------|
| `INTERNAL_YTDLP_UPDATE_NEEDED` | Atualizando sistema. Tente novamente. |
| `CIRCUIT_BREAKER_OPEN` | Serviço temporariamente indisponível. |
| `QUEUE_TIMEOUT` | Tempo de espera excedido. |

### Estrutura do Erro

```json
{
  "code": "FORMAT_NOT_AVAILABLE",
  "type": "format",
  "platform": "youtube",
  "message": "Formato não disponível. Tente outra qualidade.",
  "cause": "ERROR: Requested format is not available",
  "retryable": true,
  "suggestedAction": "Try different quality",
  "timestamp": "2026-02-03T20:00:00.000Z",
  "attempts": 3
}
```

---

## 🔧 Configuração

### Variáveis de Ambiente

**Backend** (`backend/.env`):
```env
PORT=3001
LOG_LEVEL=info
NODE_ENV=development

# Limites
MAX_CONCURRENT_DOWNLOADS=3
MAX_CONCURRENT_INFO=5
MAX_VIDEO_DURATION=3600
MAX_FILE_SIZE=1073741824

# Cache
CACHE_TTL_MINUTES=30
CACHE_MAX_SIZE=1000

# Rate Limit
RATE_LIMIT_INFO=20
RATE_LIMIT_DOWNLOAD=10

# yt-dlp
YTDLP_PATH=yt-dlp
YTDLP_AUTO_UPDATE=true

# Proxy (opcional)
YTDLP_PROXY=
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🎨 Design System

### Cores (Neo-Brutalismo)

| Nome | Hex | Uso |
|------|-----|-----|
| Primary | `#FF6B35` | CTAs, seleção |
| Secondary | `#4ECDC4` | Ações secundárias |
| Accent | `#FFE66D` | Destaques |
| Dark | `#2C3E50` | Texto |
| Success | `#2ECC71` | Sucesso |
| Danger | `#E74C3C` | Erros |

### Componentes

```css
.brutal-border { border: 3px solid black; }
.brutal-btn { /* Botões com sombra offset */ }
.brutal-card { /* Cards com bordas grossas */ }
.brutal-input { /* Inputs com estilo bold */ }
```

---

## 📊 Métricas e Logs

### Eventos Logados

```
INFO  info_fetch_completed   {requestId, url, platform, cached, durationMs}
INFO  download_started       {downloadId, url, platform, quality, type}
INFO  download_progress      {downloadId, progress}
INFO  download_completed     {downloadId, filename, durationMs, attempts}
ERROR download_failed        {downloadId, error, attempts}
WARN  retry_attempt          {attempt, maxAttempts, delayMs, reason}
WARN  circuit_breaker_opened {platform, failures, threshold}
WARN  rate_limited           {type, ip, remaining}
```

### Métricas Coletadas

- Downloads: total, completados, falhas, em progresso
- Info: total, cache hits, cache misses, falhas
- Por plataforma: YouTube, TikTok, Twitter
- Sistema: uptime, uso de fila, hit rate do cache

---

## 🔐 Segurança

- **Rate Limiting**: Proteção contra abuso por IP
- **Validação**: URLs validadas com Zod
- **Sanitização**: Nomes de arquivo sanitizados
- **Timeout**: Proteção contra downloads infinitos
- **Circuit Breaker**: Proteção contra cascata de falhas

---

## 🧩 Extensão Chrome

A extensão do Chrome permite adicionar vídeos diretamente à fila de downloads enquanto navega no YouTube, TikTok ou Twitter/X.

### Funcionalidades

- **Botão flutuante** nas páginas de vídeo para adicionar à fila
- **Popup** com lista de vídeos na fila
- **Detecção automática** da URL do vídeo atual
- **Integração direta** com a aplicação web

### Instalação da Extensão (Modo Desenvolvedor)

1. **Compile a extensão:**
   ```bash
   cd extension
   npm install
   npm run build
   ```

2. **Carregue no Chrome:**
   - Abra `chrome://extensions/`
   - Ative o **"Modo do desenvolvedor"** (canto superior direito)
   - Clique em **"Carregar sem compactação"**
   - Selecione a pasta `extension/dist`

3. **Configure o backend:**
   - Certifique-se que o backend está rodando em `http://localhost:3001`
   - E o frontend em `http://localhost:3000`

### Uso

1. Navegue até um vídeo no YouTube, TikTok ou Twitter/X
2. Clique no botão **"Adicionar à Fila"** que aparece na página
3. O vídeo será adicionado à sua lista de downloads
4. Acesse `http://localhost:3000` para gerenciar seus downloads

### Estrutura da Extensão

```
extension/
├── src/
│   ├── background/       # Service Worker (comunicação)
│   ├── content/          # Scripts injetados nas páginas
│   ├── popup/            # Interface do popup
│   └── shared/           # Tipos e constantes compartilhados
├── manifest.json         # Configuração da extensão (Manifest v3)
├── webpack.config.js     # Configuração de build
└── package.json
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

### Padrões de Commit

Utilize [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Manutenção

---

## ⚠️ Aviso Legal

Este aplicativo é fornecido apenas para fins educacionais. Use apenas para baixar conteúdo que você tem permissão para baixar. Respeite:

- Termos de serviço das plataformas
- Direitos autorais
- Leis locais sobre download de conteúdo

---

## 📄 Licença

MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.
