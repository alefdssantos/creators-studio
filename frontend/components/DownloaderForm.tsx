'use client'

import { useState, useEffect, useRef } from 'react'
import Tooltip, { HelpTip } from './Tooltip'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Tooltips de ajuda
const HELP_TIPS = {
  mode: {
    single: 'Baixe um vídeo por vez com controle total de qualidade e formato.',
    multiple: 'Cole várias URLs de uma vez para download em lote.'
  },
  urlInput: 'Cole a URL completa do vídeo. Suportamos YouTube, TikTok e Twitter/X.',
  platform: 'Plataforma detectada automaticamente pela URL.',
  quality: 'Escolha a qualidade do vídeo. Qualidades mais altas = arquivos maiores. A bolinha indica a qualidade recomendada (720p).',
  downloadType: {
    video: 'Baixa o vídeo completo com áudio em formato MP4.',
    audio: 'Extrai apenas o áudio do vídeo.'
  },
  audioFormat: {
    mp3: 'Formato mais compatível, funciona em qualquer dispositivo.',
    m4a: 'Melhor qualidade de áudio, ideal para Apple devices.'
  },
  progress: 'Barra de progresso em tempo real. O download pode demorar dependendo do tamanho do vídeo.',
  downloadBtn: 'Clique para iniciar o download. O arquivo será baixado automaticamente quando concluído.',
  staged: 'URLs reconhecidas aguardando confirmação. Clique em "Adicionar" para buscar as informações.',
  queue: 'Vídeos na fila de download. Configure cada um individualmente antes de baixar.'
}

interface VideoFormat {
  formatId: string
  quality: string
  height?: number
  ext: string
  filesize?: number
}

interface VideoInfo {
  title: string
  duration: number
  thumbnail: string
  uploader: string
}

interface FormatsData {
  video: VideoFormat[]
  audio: VideoFormat[]
}

interface DownloadItem {
  id: string
  url: string
  platform: string
  videoInfo: VideoInfo | null
  formats: FormatsData | null
  status: 'pending' | 'fetching' | 'ready' | 'downloading' | 'completed' | 'error'
  progress: number
  error?: string
  downloadId?: string
  // Individual settings
  downloadType: 'video' | 'audio'
  selectedQuality: string
  audioFormat: string
}

interface HistoryItem {
  id: string
  title: string
  platform: string
  quality: string
  type: string
  date: string
}

export default function DownloaderForm() {
  // Mode toggle
  const [mode, setMode] = useState<'single' | 'multiple'>('single')

  // Single mode states
  const [singleUrl, setSingleUrl] = useState('')
  const [singleLoadedUrl, setSingleLoadedUrl] = useState('') // URL do vídeo carregado
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleError, setSingleError] = useState('')
  const [singlePlatform, setSinglePlatform] = useState('')
  const [singleVideoInfo, setSingleVideoInfo] = useState<VideoInfo | null>(null)
  const [singleFormats, setSingleFormats] = useState<FormatsData | null>(null)
  const [singleQuality, setSingleQuality] = useState('720p')
  const [singleDownloadType, setSingleDownloadType] = useState<'video' | 'audio'>('video')
  const [singleAudioFormat, setSingleAudioFormat] = useState('mp3')
  const [singleDownloading, setSingleDownloading] = useState(false)
  const [singleProgress, setSingleProgress] = useState(0)
  const [singleDownloadId, setSingleDownloadId] = useState<string | null>(null)
  const singleDownloadTriggered = useRef(false)

  // Multiple mode states
  const [inputUrls, setInputUrls] = useState('')
  const [stagedUrls, setStagedUrls] = useState<string[]>([]) // URLs recognized but not added yet
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([])
  const [multiLoading, setMultiLoading] = useState(false)
  const [multiError, setMultiError] = useState('')
  const downloadTriggeredRef = useRef<Set<string>>(new Set())
  const multiInputRef = useRef<HTMLInputElement>(null)

  // ==================== EXTENSION SYNC ====================

  // Listen for URLs from browser extension
  useEffect(() => {
    // Check for pending URLs from extension on mount
    const checkPendingUrls = () => {
      try {
        const pendingData = localStorage.getItem('downloader_pending_urls')
        if (pendingData) {
          const pendingUrls: string[] = JSON.parse(pendingData)
          if (pendingUrls.length > 0) {
            // Filter URLs that aren't already staged or in queue
            const newUrls = pendingUrls.filter(url =>
              !stagedUrls.includes(url) &&
              !downloadItems.some(item => item.url === url)
            )

            if (newUrls.length > 0) {
              setMode('multiple')
              setStagedUrls(prev => [...prev, ...newUrls])
            }

            // Clear pending URLs
            localStorage.removeItem('downloader_pending_urls')
          }
        }
      } catch (e) {
        console.error('Failed to load pending URLs:', e)
      }
    }

    // Check for import URLs from query params (from extension popup)
    const checkImportUrls = () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const importParam = params.get('import')
        if (importParam) {
          const urls: string[] = JSON.parse(decodeURIComponent(importParam))
          if (urls.length > 0) {
            const newUrls = urls.filter(url =>
              !stagedUrls.includes(url) &&
              !downloadItems.some(item => item.url === url)
            )

            if (newUrls.length > 0) {
              setMode('multiple')
              setStagedUrls(prev => [...prev, ...newUrls])
            }

            // Clean URL without refreshing
            window.history.replaceState({}, '', window.location.pathname)
          }
        }
      } catch (e) {
        console.error('Failed to parse import URLs:', e)
      }
    }

    // Initial checks
    checkPendingUrls()
    checkImportUrls()

    // Listen for real-time updates via BroadcastChannel
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('downloader_sync')
      channel.onmessage = (event) => {
        if (event.data.type === 'ADD_URL' && event.data.payload?.url) {
          const url = event.data.payload.url

          // Check for duplicates
          if (stagedUrls.includes(url) || downloadItems.some(item => item.url === url)) {
            return
          }

          // Switch to multi-link mode and add URL
          setMode('multiple')
          setStagedUrls(prev => [...prev, url])
        }
      }
    } catch (e) {
      console.error('BroadcastChannel not supported:', e)
    }

    // Also listen for storage changes (fallback for cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'downloader_pending_urls' && e.newValue) {
        checkPendingUrls()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      channel?.close()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [stagedUrls, downloadItems])

  // ==================== SHARED FUNCTIONS ====================

  const detectPlatform = (inputUrl: string): string => {
    const urlLower = inputUrl.toLowerCase()
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube'
    if (urlLower.includes('tiktok.com')) return 'tiktok'
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter'
    return ''
  }

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'youtube': return 'bg-[#FF0000]'
      case 'tiktok': return 'bg-[#000000]'
      case 'twitter': return 'bg-[#1DA1F2]'
      default: return 'bg-gray-500'
    }
  }

  // Select best quality: 720p preferred, otherwise next lower available
  const selectBestQuality = (formats: VideoFormat[]): string => {
    const preferredOrder = ['720p', '480p', '360p', '240p', '144p']
    const availableQualities = formats.map(f => f.quality)

    // Try preferred qualities in order
    for (const quality of preferredOrder) {
      if (availableQualities.includes(quality)) {
        return quality
      }
    }

    // If none found, try higher qualities (1080p, 1440p, etc)
    const higherQualities = ['1080p', '1440p', '2160p']
    for (const quality of higherQualities) {
      if (availableQualities.includes(quality)) {
        return quality
      }
    }

    // Fallback to first available
    return formats[0]?.quality || '720p'
  }

  const saveToHistory = (item: HistoryItem) => {
    try {
      const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]')
      history.unshift(item)
      localStorage.setItem('downloadHistory', JSON.stringify(history.slice(0, 50)))
    } catch (err) {
      console.error('Error saving to history:', err)
    }
  }

  // ==================== SINGLE MODE FUNCTIONS ====================

  const handleSingleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setSingleUrl(newUrl)
    setSingleError('')
    // Only update platform preview if no video is loaded
    if (!singleVideoInfo) {
      setSinglePlatform(detectPlatform(newUrl))
    }
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setSingleUrl(text)
        setSingleError('')
        // Only update platform preview if no video is loaded
        if (!singleVideoInfo) {
          setSinglePlatform(detectPlatform(text))
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err)
      setSingleError('Não foi possível acessar a área de transferência')
    }
  }

  const clearSingleUrl = () => {
    setSingleUrl('')
    setSingleLoadedUrl('')
    setSingleError('')
    setSinglePlatform('')
    setSingleVideoInfo(null)
    setSingleFormats(null)
  }

  const fetchSingleInfo = async () => {
    if (!singleUrl.trim()) {
      setSingleError('Por favor, insira uma URL')
      return
    }

    const platform = detectPlatform(singleUrl)
    if (!platform) {
      setSingleError('URL não reconhecida. Use YouTube, TikTok ou Twitter/X.')
      return
    }

    // Check if URL is already loaded or in multiple mode list
    const trimmedUrl = singleUrl.trim()
    if (trimmedUrl === singleLoadedUrl) {
      setSingleError('Este vídeo já está carregado')
      setSingleUrl('')
      setTimeout(() => setSingleError(''), 3000)
      return
    }
    const isInQueue = downloadItems.some(item => item.url === trimmedUrl)
    const isStaged = stagedUrls.includes(trimmedUrl)
    if (isInQueue || isStaged) {
      setSingleError('Este vídeo já está na lista de múltiplos downloads')
      setSingleUrl('')
      setTimeout(() => setSingleError(''), 3000)
      return
    }

    setSingleLoading(true)
    setSingleError('')

    try {
      const response = await fetch(`${API_URL}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: singleUrl })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao buscar informações')

      setSinglePlatform(data.platform)
      setSingleVideoInfo(data.videoInfo)
      setSingleFormats(data.formats)

      // Auto-select best quality (720p or next lower)
      const bestQuality = selectBestQuality(data.formats.video)
      setSingleQuality(bestQuality)

      // Save loaded URL and clear input field
      setSingleLoadedUrl(singleUrl.trim())
      setSingleUrl('')
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSingleLoading(false)
    }
  }

  const startSingleDownload = async () => {
    if (!singleLoadedUrl || !singleFormats) return

    singleDownloadTriggered.current = false
    setSingleDownloading(true)
    setSingleProgress(0)
    setSingleError('')

    try {
      const response = await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: singleLoadedUrl,
          type: singleDownloadType,
          quality: singleDownloadType === 'video' ? singleQuality : 'best',
          ext: singleDownloadType === 'audio' ? singleAudioFormat : 'mp4'
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao iniciar download')

      setSingleDownloadId(data.downloadId)
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : 'Erro ao iniciar download')
      setSingleDownloading(false)
    }
  }

  // Poll single download progress
  useEffect(() => {
    if (!singleDownloadId || !singleDownloading) return

    const pollProgress = async () => {
      try {
        const response = await fetch(`${API_URL}/api/progress/${singleDownloadId}`)
        const data = await response.json()

        setSingleProgress(data.progress || 0)

        if (data.status === 'completed' && !singleDownloadTriggered.current) {
          singleDownloadTriggered.current = true

          saveToHistory({
            id: singleDownloadId,
            title: singleVideoInfo?.title || 'Unknown',
            platform: singlePlatform,
            quality: singleDownloadType === 'video' ? singleQuality : 'audio',
            type: singleDownloadType,
            date: new Date().toISOString()
          })

          window.open(`${API_URL}/api/file/${singleDownloadId}`, '_blank')
          setSingleDownloading(false)
          setSingleDownloadId(null)
        } else if (data.status === 'error') {
          setSingleError(data.error || 'Erro no download')
          setSingleDownloading(false)
          setSingleDownloadId(null)
        }
      } catch (err) {
        console.error('Error polling progress:', err)
      }
    }

    const interval = setInterval(pollProgress, 1000)
    return () => clearInterval(interval)
  }, [singleDownloadId, singleDownloading, singleVideoInfo, singlePlatform, singleQuality, singleDownloadType])

  // ==================== MULTIPLE MODE FUNCTIONS ====================

  const parseUrls = (input: string): string[] => {
    return input.split(/[\n,\s]/).map(line => line.trim()).filter(line => isValidUrl(line) && detectPlatform(line))
  }

  // Handle input change - detect and stage URLs
  const handleMultiInputChange = (value: string) => {
    // Parse and stage valid URLs
    const urls = parseUrls(value)

    if (urls.length > 0) {
      const duplicateUrls: string[] = []
      const newStagedUrls: string[] = []

      for (const url of urls) {
        const isInQueue = downloadItems.some(item => item.url === url)
        const isStaged = stagedUrls.includes(url)
        const isInSingleMode = singleUrl.trim() === url || singleLoadedUrl === url

        if (isInQueue || isStaged || isInSingleMode) {
          duplicateUrls.push(url)
        } else {
          newStagedUrls.push(url)
        }
      }

      if (newStagedUrls.length > 0) {
        setStagedUrls(prev => [...prev, ...newStagedUrls])
      }

      // Show warning for duplicates
      if (duplicateUrls.length > 0) {
        const msg = duplicateUrls.length === 1
          ? 'Este vídeo já está na lista'
          : `${duplicateUrls.length} vídeos já estão na lista`
        setMultiError(msg)
        setTimeout(() => setMultiError(''), 3000) // Clear after 3 seconds
      } else {
        setMultiError('')
      }

      // Clear input and refocus
      setInputUrls('')
      setTimeout(() => multiInputRef.current?.focus(), 0)
    } else {
      setInputUrls(value)
    }
  }

  // Paste from clipboard for multi mode
  const pasteMultiFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        handleMultiInputChange(text)
      }
      multiInputRef.current?.focus()
    } catch (err) {
      console.error('Failed to read clipboard:', err)
      setMultiError('Não foi possível acessar a área de transferência')
    }
  }

  // Remove a staged URL
  const removeStagedUrl = (url: string) => {
    setStagedUrls(prev => prev.filter(u => u !== url))
  }

  // Clear all staged URLs
  const clearStagedUrls = () => {
    setStagedUrls([])
    setInputUrls('')
  }

  // Add staged URLs to download queue and fetch info immediately
  const addStagedToQueue = async () => {
    if (stagedUrls.length === 0) return

    const newItems: DownloadItem[] = stagedUrls
      .filter(url => !downloadItems.some(item => item.url === url))
      .map(url => ({
        id: Math.random().toString(36).substr(2, 9),
        url,
        platform: detectPlatform(url),
        videoInfo: null,
        formats: null,
        status: 'pending' as const,
        progress: 0,
        downloadType: 'video' as const,
        selectedQuality: '720p',
        audioFormat: 'mp3'
      }))

    if (newItems.length === 0) {
      setStagedUrls([])
      return
    }

    // Add to queue
    setDownloadItems(prev => [...prev, ...newItems])
    setStagedUrls([])
    setMultiError('')

    // Fetch info for new items immediately
    setMultiLoading(true)
    for (const item of newItems) {
      setDownloadItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'fetching' as const } : i
      ))

      try {
        const response = await fetch(`${API_URL}/api/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao buscar informações')

        // Auto-select best quality (720p or next lower)
        const bestQuality = selectBestQuality(data.formats.video)

        setDownloadItems(prev => prev.map(i =>
          i.id === item.id ? {
            ...i,
            status: 'ready' as const,
            videoInfo: data.videoInfo,
            formats: data.formats,
            selectedQuality: bestQuality
          } : i
        ))
      } catch (err) {
        setDownloadItems(prev => prev.map(i =>
          i.id === item.id ? {
            ...i,
            status: 'error' as const,
            error: err instanceof Error ? err.message : 'Erro desconhecido'
          } : i
        ))
      }
    }
    setMultiLoading(false)
  }

  const removeItem = (id: string) => {
    setDownloadItems(prev => prev.filter(item => item.id !== id))
  }

  const clearAll = () => {
    setDownloadItems([])
    setMultiError('')
  }

  const updateItemSetting = (id: string, key: keyof DownloadItem, value: any) => {
    setDownloadItems(prev => prev.map(item =>
      item.id === id ? { ...item, [key]: value } : item
    ))
  }

  const fetchAllInfo = async () => {
    const pendingItems = downloadItems.filter(item => item.status === 'pending')
    if (pendingItems.length === 0) return

    setMultiLoading(true)

    for (const item of pendingItems) {
      setDownloadItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'fetching' as const } : i
      ))

      try {
        const response = await fetch(`${API_URL}/api/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao buscar informações')

        // Auto-select best quality (720p or next lower)
        const bestQuality = selectBestQuality(data.formats.video)

        setDownloadItems(prev => prev.map(i =>
          i.id === item.id ? {
            ...i,
            status: 'ready' as const,
            videoInfo: data.videoInfo,
            formats: data.formats,
            selectedQuality: bestQuality
          } : i
        ))
      } catch (err) {
        setDownloadItems(prev => prev.map(i =>
          i.id === item.id ? {
            ...i,
            status: 'error' as const,
            error: err instanceof Error ? err.message : 'Erro desconhecido'
          } : i
        ))
      }
    }

    setMultiLoading(false)
  }

  const startSingleItemDownload = async (item: DownloadItem) => {
    try {
      setDownloadItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'downloading' as const, progress: 0 } : i
      ))

      const response = await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          type: item.downloadType,
          quality: item.downloadType === 'video' ? item.selectedQuality : 'best',
          ext: item.downloadType === 'audio' ? item.audioFormat : 'mp4'
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao iniciar download')

      setDownloadItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, downloadId: data.downloadId } : i
      ))
    } catch (err) {
      setDownloadItems(prev => prev.map(i =>
        i.id === item.id ? {
          ...i,
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Erro no download'
        } : i
      ))
    }
  }

  const startAllDownloads = async () => {
    const readyItems = downloadItems.filter(item => item.status === 'ready')
    if (readyItems.length === 0) return

    downloadTriggeredRef.current = new Set()

    for (const item of readyItems) {
      await startSingleItemDownload(item)
    }
  }

  // Poll multiple downloads progress
  useEffect(() => {
    const downloadingItems = downloadItems.filter(item => item.status === 'downloading' && item.downloadId)
    if (downloadingItems.length === 0) return

    const pollProgress = async () => {
      for (const item of downloadingItems) {
        if (!item.downloadId) continue

        try {
          const response = await fetch(`${API_URL}/api/progress/${item.downloadId}`)
          const data = await response.json()

          if (data.status === 'completed' && !downloadTriggeredRef.current.has(item.id)) {
            downloadTriggeredRef.current.add(item.id)

            saveToHistory({
              id: item.downloadId,
              title: item.videoInfo?.title || 'Unknown',
              platform: item.platform,
              quality: item.downloadType === 'video' ? item.selectedQuality : 'audio',
              type: item.downloadType,
              date: new Date().toISOString()
            })

            window.open(`${API_URL}/api/file/${item.downloadId}`, '_blank')

            setDownloadItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, status: 'completed' as const, progress: 100 } : i
            ))
          } else if (data.status === 'error') {
            setDownloadItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, status: 'error' as const, error: data.error } : i
            ))
          } else if (data.status === 'downloading') {
            setDownloadItems(prev => prev.map(i =>
              i.id === item.id ? { ...i, progress: data.progress || 0 } : i
            ))
          }
        } catch (err) {
          console.error('Error polling progress:', err)
        }
      }
    }

    const interval = setInterval(pollProgress, 1000)
    return () => clearInterval(interval)
  }, [downloadItems])

  // ==================== COMPUTED VALUES ====================

  const readyCount = downloadItems.filter(i => i.status === 'ready').length
  const pendingCount = downloadItems.filter(i => i.status === 'pending').length
  const allInfoFetched = downloadItems.length > 0 && downloadItems.every(i => i.status === 'ready' || i.status === 'completed' || i.status === 'error')
  const hasDownloading = downloadItems.some(i => i.status === 'downloading')

  // ==================== RENDER ====================

  return (
    <div className="brutal-card">
      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Tooltip content={HELP_TIPS.mode.single} position="bottom">
            <button
              onClick={() => setMode('single')}
              className={`brutal-btn text-xs flex-1 ${mode === 'single' ? 'bg-dark text-white' : 'bg-white text-dark'}`}
            >
              Link Único
            </button>
          </Tooltip>
          <Tooltip content={HELP_TIPS.mode.multiple} position="bottom">
            <button
              onClick={() => setMode('multiple')}
              className={`brutal-btn text-xs flex-1 ${mode === 'multiple' ? 'bg-dark text-white' : 'bg-white text-dark'}`}
            >
              Múltiplos Links
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ==================== SINGLE MODE ==================== */}
      {mode === 'single' && (
        <>
          {/* URL Input */}
          <div className="mb-6">
            <label className="flex items-center text-xs font-bold uppercase mb-2 text-dark">
              Cole a URL do vídeo
              <HelpTip content={HELP_TIPS.urlInput} />
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={singleUrl}
                    onChange={handleSingleUrlChange}
                    placeholder="https://youtube.com/watch?v=..."
                    className="brutal-input w-full text-sm pr-10"
                    disabled={singleLoading || singleDownloading}
                  />
                  {/* Paste button inside input */}
                  <button
                    onClick={pasteFromClipboard}
                    disabled={singleLoading || singleDownloading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
                    title="Colar"
                  >
                    <svg className="w-5 h-5 text-dark/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchSingleInfo}
                  disabled={singleLoading || singleDownloading || !singleUrl.trim()}
                  className={`brutal-btn text-xs whitespace-nowrap ${singleLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-secondary text-dark'}`}
                >
                  {singleLoading ? 'Buscando...' : 'Buscar'}
                </button>
                {(singleUrl || singleVideoInfo) && (
                  <button
                    onClick={clearSingleUrl}
                    disabled={singleLoading || singleDownloading}
                    className="brutal-btn text-xs bg-danger text-white"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {singlePlatform && !singleLoading && (
              <div className="mt-2 flex items-center gap-2">
                <Tooltip content={HELP_TIPS.platform} position="right">
                  <span className={`text-xs text-white px-2 py-1 brutal-border cursor-help ${getPlatformColor(singlePlatform)}`}>
                    {singlePlatform.toUpperCase()}
                  </span>
                </Tooltip>
                <span className="text-xs text-dark/60">detectado</span>
              </div>
            )}
          </div>

          {singleError && (
            <div className="brutal-border bg-danger/20 border-danger p-4 mb-6">
              <p className="text-xs text-danger font-bold">{singleError}</p>
            </div>
          )}

          {/* Video Info */}
          {singleVideoInfo && (
            <div className="brutal-border bg-[#F5F5F5] p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {singleVideoInfo.thumbnail && (
                  <div className="brutal-border w-full md:w-48 h-28 overflow-hidden flex-shrink-0">
                    <img src={singleVideoInfo.thumbnail} alt={singleVideoInfo.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-dark mb-2 line-clamp-2">{singleVideoInfo.title}</h3>
                  <p className="text-xs text-dark/70"><span className="font-bold">Canal:</span> {singleVideoInfo.uploader}</p>
                </div>
              </div>
              {/* Link to original video */}
              {singleLoadedUrl && (
                <a
                  href={singleLoadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 p-2 bg-white brutal-border hover:shadow-brutal transition-all cursor-pointer"
                >
                  <span className={`text-[10px] text-white px-2 py-1 ${getPlatformColor(singlePlatform)}`}>
                    {singlePlatform.toUpperCase()}
                  </span>
                  <span className="flex-1 text-xs text-dark/70 truncate">{singleLoadedUrl}</span>
                  <svg className="w-4 h-4 text-dark/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Download Options */}
          {singleFormats && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase mb-2 text-dark">Tipo de Download</label>
                <div className="flex gap-2">
                  <Tooltip content={HELP_TIPS.downloadType.video} position="bottom">
                    <button
                      onClick={() => setSingleDownloadType('video')}
                      className={`brutal-btn text-xs flex-1 ${singleDownloadType === 'video' ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                    >
                      Vídeo + Áudio
                    </button>
                  </Tooltip>
                  <Tooltip content={HELP_TIPS.downloadType.audio} position="bottom">
                    <button
                      onClick={() => setSingleDownloadType('audio')}
                      className={`brutal-btn text-xs flex-1 ${singleDownloadType === 'audio' ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                    >
                      Somente Áudio
                    </button>
                  </Tooltip>
                </div>
              </div>

              {singleDownloadType === 'video' && singleFormats.video.filter(f => f.quality && f.quality !== 'unknown').length > 0 && (
                <div>
                  <label className="flex items-center text-xs font-bold uppercase mb-2 text-dark">
                    Qualidade do Vídeo
                    <span className="font-normal text-dark/50 ml-2">({singleFormats.video.filter(f => f.quality && f.quality !== 'unknown').length} disponíveis)</span>
                    <HelpTip content={HELP_TIPS.quality} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {singleFormats.video
                      .filter(f => f.quality && f.quality !== 'unknown')
                      .sort((a, b) => (b.height || 0) - (a.height || 0))
                      .map((format) => {
                        const isSelected = singleQuality === format.quality
                        const isRecommended = format.quality === '720p'
                        return (
                          <button
                            key={format.formatId}
                            onClick={() => setSingleQuality(format.quality)}
                            className={`brutal-border px-3 py-2 text-xs transition-all relative ${
                              isSelected
                                ? 'bg-primary text-white shadow-brutal'
                                : 'bg-white text-dark hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-bold">{format.quality}</span>
                            {isRecommended && !isSelected && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full" title="Recomendado" />
                            )}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              {singleDownloadType === 'audio' && (
                <div>
                  <label className="block text-xs font-bold uppercase mb-2 text-dark">Formato de Áudio</label>
                  <div className="flex gap-2">
                    <Tooltip content={HELP_TIPS.audioFormat.mp3} position="bottom">
                      <button onClick={() => setSingleAudioFormat('mp3')} className={`brutal-btn text-xs flex-1 ${singleAudioFormat === 'mp3' ? 'bg-secondary text-dark' : 'bg-white text-dark'}`}>MP3</button>
                    </Tooltip>
                    <Tooltip content={HELP_TIPS.audioFormat.m4a} position="bottom">
                      <button onClick={() => setSingleAudioFormat('m4a')} className={`brutal-btn text-xs flex-1 ${singleAudioFormat === 'm4a' ? 'bg-secondary text-dark' : 'bg-white text-dark'}`}>M4A</button>
                    </Tooltip>
                  </div>
                </div>
              )}

              {singleDownloading && (
                <Tooltip content={HELP_TIPS.progress} position="top">
                  <div className="brutal-border bg-[#F5F5F5] p-4 w-full">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold uppercase text-dark">Baixando...</span>
                      <span className="text-xs font-bold text-primary">{Math.round(singleProgress)}%</span>
                    </div>
                    <div className="brutal-border h-6 bg-white overflow-hidden">
                      <div className="h-full bg-primary progress-striped transition-all" style={{ width: `${singleProgress}%` }} />
                    </div>
                  </div>
                </Tooltip>
              )}

              <Tooltip content={singleDownloading ? HELP_TIPS.progress : HELP_TIPS.downloadBtn} position="top">
                <button
                  onClick={startSingleDownload}
                  disabled={singleDownloading}
                  className={`brutal-btn w-full text-base py-4 ${singleDownloading ? 'bg-gray-300 cursor-not-allowed' : 'bg-success text-white hover:bg-success/90'}`}
                >
                  {singleDownloading ? 'Baixando...' : `DOWNLOAD ${singleDownloadType === 'video' ? singleQuality : singleAudioFormat.toUpperCase()}`}
                </button>
              </Tooltip>
            </div>
          )}

          {!singleVideoInfo && !singleLoading && !singleError && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎬</div>
              <p className="text-xs text-dark/60">Cole a URL de um vídeo do YouTube, TikTok ou Twitter/X</p>
            </div>
          )}
        </>
      )}

      {/* ==================== MULTIPLE MODE ==================== */}
      {mode === 'multiple' && (
        <>
          {/* URL Input */}
          <div className="mb-6">
            <label className="flex items-center text-xs font-bold uppercase mb-2 text-dark">
              Cole as URLs dos vídeos
              <HelpTip content={HELP_TIPS.urlInput} />
            </label>
            {/* Input field - always on top */}
            <div className="relative">
              <input
                ref={multiInputRef}
                type="text"
                value={inputUrls}
                onChange={(e) => handleMultiInputChange(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault()
                  const text = e.clipboardData.getData('text')
                  handleMultiInputChange(text)
                }}
                placeholder="Cole URLs aqui (YouTube, TikTok, Twitter/X)"
                className="brutal-input w-full text-sm pr-12"
                disabled={multiLoading || hasDownloading}
              />
              {/* Paste button */}
              <button
                onClick={pasteMultiFromClipboard}
                disabled={multiLoading || hasDownloading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded"
                title="Colar"
              >
                <svg className="w-5 h-5 text-dark/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>

            {/* Staged URLs - submenu style */}
            {stagedUrls.length > 0 && (
              <div className="mt-1 ml-4 border-l-4 border-primary bg-gray-50">
                {stagedUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0">
                    {/* Checkmark */}
                    <span className="text-green-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {/* Platform badge */}
                    <span className={`text-[9px] text-white px-1.5 py-0.5 ${getPlatformColor(detectPlatform(url))}`}>
                      {detectPlatform(url).toUpperCase()}
                    </span>
                    {/* URL */}
                    <span className="flex-1 text-xs text-dark/80 truncate">{url}</span>
                    {/* Remove button */}
                    <button
                      onClick={() => removeStagedUrl(url)}
                      className="text-gray-400 hover:text-danger p-0.5"
                      title="Remover"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={addStagedToQueue}
                disabled={multiLoading || hasDownloading || stagedUrls.length === 0}
                className={`brutal-btn text-xs flex-1 ${stagedUrls.length === 0 || multiLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-secondary text-dark'}`}
              >
                {multiLoading ? 'Buscando...' : `Adicionar (${stagedUrls.length})`}
              </button>
              {(stagedUrls.length > 0 || downloadItems.length > 0) && (
                <button
                  onClick={() => { clearStagedUrls(); clearAll(); }}
                  disabled={hasDownloading || multiLoading}
                  className="brutal-btn text-xs bg-danger text-white"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {multiError && (
            <div className="brutal-border bg-danger/20 border-danger p-4 mb-6">
              <p className="text-xs text-danger font-bold">{multiError}</p>
            </div>
          )}

          {/* Download Queue */}
          {downloadItems.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="flex items-center text-xs font-bold uppercase text-dark">
                  Fila de Downloads ({downloadItems.length})
                  <HelpTip content={HELP_TIPS.queue} />
                </label>
                {pendingCount > 0 && !multiLoading && (
                  <button
                    onClick={fetchAllInfo}
                    disabled={hasDownloading}
                    className="brutal-btn text-xs bg-accent text-dark"
                  >
                    Buscar Novos ({pendingCount})
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {downloadItems.map((item) => (
                  <div key={item.id} className="brutal-border bg-[#F5F5F5] p-3">
                    {/* Header row with thumbnail */}
                    <div className="flex items-start gap-3 mb-2">
                      {/* Small thumbnail */}
                      {item.videoInfo?.thumbnail ? (
                        <div className="w-16 h-10 brutal-border overflow-hidden flex-shrink-0">
                          <img
                            src={item.videoInfo.thumbnail}
                            alt={item.videoInfo.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-10 brutal-border bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] text-white px-1.5 py-0.5 ${getPlatformColor(item.platform)}`}>
                            {item.platform.toUpperCase()}
                          </span>
                          {item.status !== 'downloading' && (
                            <button onClick={() => removeItem(item.id)} className="ml-auto text-danger hover:bg-danger/10 p-0.5" title="Remover">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-bold text-dark line-clamp-1">
                          {item.videoInfo?.title || 'Carregando...'}
                        </p>
                        {/* Link to original video */}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-dark/50 hover:text-primary truncate block mt-0.5"
                          title={item.url}
                        >
                          {item.url}
                        </a>
                      </div>
                    </div>

                    {/* Status and progress */}
                    {item.status === 'pending' && (
                      <p className="text-[10px] text-gray-500">Aguardando busca de informações...</p>
                    )}
                    {item.status === 'fetching' && (
                      <p className="text-[10px] text-blue-600 font-bold">Buscando informações...</p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-[10px] text-red-600 font-bold">{item.error}</p>
                    )}
                    {item.status === 'completed' && (
                      <p className="text-[10px] text-green-700 font-bold">Concluído!</p>
                    )}

                    {/* Downloading progress */}
                    {item.status === 'downloading' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-blue-600 font-bold">Baixando...</span>
                          <span className="font-bold">{Math.round(item.progress)}%</span>
                        </div>
                        <div className="brutal-border h-3 bg-white overflow-hidden">
                          <div className="h-full bg-primary progress-striped transition-all" style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Settings when ready */}
                    {item.status === 'ready' && (
                      <div className="mt-3 space-y-2">
                        {/* Type toggle */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateItemSetting(item.id, 'downloadType', 'video')}
                            disabled={hasDownloading}
                            className={`brutal-border px-3 py-1 text-[10px] flex-1 ${item.downloadType === 'video' ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                          >
                            Vídeo
                          </button>
                          <button
                            onClick={() => updateItemSetting(item.id, 'downloadType', 'audio')}
                            disabled={hasDownloading}
                            className={`brutal-border px-3 py-1 text-[10px] flex-1 ${item.downloadType === 'audio' ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                          >
                            Áudio
                          </button>
                        </div>

                        {/* Quality selection for video - shows only available qualities */}
                        {item.downloadType === 'video' && item.formats && (
                          <>
                            {item.formats.video.filter(f => f.quality && f.quality !== 'unknown').length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {item.formats.video
                                  .filter(f => f.quality && f.quality !== 'unknown')
                                  .sort((a, b) => (b.height || 0) - (a.height || 0))
                                  .map(format => {
                                    const isSelected = item.selectedQuality === format.quality
                                    const isRecommended = format.quality === '720p'
                                    return (
                                      <button
                                        key={format.formatId}
                                        onClick={() => updateItemSetting(item.id, 'selectedQuality', format.quality)}
                                        disabled={hasDownloading}
                                        className={`brutal-border px-2 py-1 text-[10px] relative ${
                                          isSelected
                                            ? 'bg-secondary text-dark font-bold'
                                            : 'bg-white text-dark hover:bg-gray-50'
                                        }`}
                                      >
                                        {format.quality}
                                        {isRecommended && !isSelected && (
                                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" title="Recomendado" />
                                        )}
                                      </button>
                                    )
                                  })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-dark/50 italic">Sem opções de qualidade - usando melhor disponível</p>
                            )}
                          </>
                        )}

                        {/* Audio format for audio */}
                        {item.downloadType === 'audio' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateItemSetting(item.id, 'audioFormat', 'mp3')}
                              disabled={hasDownloading}
                              className={`brutal-border px-2 py-1 text-[10px] ${item.audioFormat === 'mp3' ? 'bg-secondary text-dark' : 'bg-white text-dark'}`}
                            >
                              MP3
                            </button>
                            <button
                              onClick={() => updateItemSetting(item.id, 'audioFormat', 'm4a')}
                              disabled={hasDownloading}
                              className={`brutal-border px-2 py-1 text-[10px] ${item.audioFormat === 'm4a' ? 'bg-secondary text-dark' : 'bg-white text-dark'}`}
                            >
                              M4A
                            </button>
                          </div>
                        )}

                        {/* Individual download button */}
                        <button
                          onClick={() => startSingleItemDownload(item)}
                          disabled={hasDownloading}
                          className={`brutal-btn w-full text-xs py-2 ${hasDownloading ? 'bg-gray-300 cursor-not-allowed' : 'bg-success text-white'}`}
                        >
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download All Button */}
          {readyCount > 0 && allInfoFetched && (
            <button
              onClick={startAllDownloads}
              disabled={hasDownloading || readyCount === 0}
              className={`brutal-btn w-full text-base py-4 ${hasDownloading ? 'bg-gray-300 cursor-not-allowed' : 'bg-success text-white hover:bg-success/90'}`}
            >
              {hasDownloading ? 'Baixando...' : `DOWNLOAD TODOS (${readyCount})`}
            </button>
          )}

          {downloadItems.length === 0 && stagedUrls.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎬</div>
              <p className="text-xs text-dark/60">Cole URLs no campo acima</p>
              <p className="text-xs text-dark/40 mt-2">YouTube, TikTok ou Twitter/X</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
