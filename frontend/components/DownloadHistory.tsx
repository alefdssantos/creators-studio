'use client'

import { useState, useEffect } from 'react'

interface HistoryItem {
  id: string
  title: string
  platform: string
  quality: string
  type: string
  date: string
}

export default function DownloadHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('downloadHistory')
      if (stored) {
        const savedHistory = JSON.parse(stored) as HistoryItem[]
        const timeoutId = window.setTimeout(() => setHistory(savedHistory), 0)
        return () => window.clearTimeout(timeoutId)
      }
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }, [])

  const clearHistory = () => {
    localStorage.removeItem('downloadHistory')
    setHistory([])
  }

  const removeItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id)
    localStorage.setItem('downloadHistory', JSON.stringify(newHistory))
    setHistory(newHistory)
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'youtube': return 'bg-[#FF0000]'
      case 'tiktok': return 'bg-[#000000]'
      case 'twitter': return 'bg-[#1DA1F2]'
      default: return 'bg-gray-500'
    }
  }

  if (history.length === 0) {
    return (
      <div className="brutal-card text-center py-8">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-xs text-dark/60">Nenhum download no histórico</p>
      </div>
    )
  }

  return (
    <div className="brutal-card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold uppercase text-dark">
          Histórico de Downloads
        </h2>
        <button
          onClick={clearHistory}
          className="text-xs text-danger hover:underline font-bold"
        >
          Limpar Tudo
        </button>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {history.map((item) => (
          <div
            key={item.id}
            className="brutal-border bg-[#F5F5F5] p-3 flex items-center gap-3"
          >
            {/* Platform badge */}
            <span
              className={`text-[10px] text-white px-2 py-1 brutal-border ${getPlatformColor(item.platform)}`}
            >
              {item.platform.toUpperCase()}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-dark truncate">
                {item.title}
              </p>
              <p className="text-[10px] text-dark/60">
                {item.type === 'video' ? `🎬 ${item.quality}` : `🎵 ${item.quality}`}
                {' • '}
                {formatDate(item.date)}
              </p>
            </div>

            {/* Remove button */}
            <button
              onClick={() => removeItem(item.id)}
              className="text-danger hover:bg-danger/10 p-1 rounded"
              title="Remover"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-dark/40 mt-4 text-center">
        Últimos {history.length} downloads • Armazenado localmente
      </p>
    </div>
  )
}
