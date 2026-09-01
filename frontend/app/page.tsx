'use client'

import { useState } from 'react'
import DownloaderForm from '@/components/DownloaderForm'
import DownloadHistory from '@/components/DownloadHistory'

export default function Home() {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <main className="min-h-screen bg-[#FFF8F0] p-4 md:p-8">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 50px,
            #000 50px,
            #000 51px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 50px,
            #000 50px,
            #000 51px
          )`
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12">
          <div className="inline-block brutal-border brutal-shadow-xl bg-primary px-6 py-4 md:px-8 md:py-5 mb-4">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              DOWNLOADER
            </h1>
          </div>
          <p className="text-sm md:text-base text-dark/80 max-w-md mx-auto">
            Baixe vídeos do YouTube, TikTok e Twitter/X de forma rápida e gratuita
          </p>
        </header>

        {/* Platform badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <span className="brutal-border bg-[#FF0000] text-white px-4 py-2 text-xs font-bold">
            YOUTUBE
          </span>
          <span className="brutal-border bg-[#000000] text-white px-4 py-2 text-xs font-bold">
            TIKTOK
          </span>
          <span className="brutal-border bg-[#1DA1F2] text-white px-4 py-2 text-xs font-bold">
            TWITTER/X
          </span>
        </div>

        {/* Main Form */}
        <DownloaderForm />

        {/* History Toggle */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="brutal-btn bg-accent text-dark text-xs"
          >
            {showHistory ? 'Ocultar Histórico' : 'Ver Histórico'}
          </button>
        </div>

        {/* History Section */}
        {showHistory && (
          <div className="mt-6">
            <DownloadHistory />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-dark/60">
          <p className="mt-1">Use apenas para conteúdo que você tem permissão para baixar</p>
        </footer>
      </div>
    </main>
  )
}
