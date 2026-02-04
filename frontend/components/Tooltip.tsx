'use client'

import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({
  children,
  content,
  position = 'top',
  delay = 300
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = -tooltipRect.height - 8
          left = (triggerRect.width - tooltipRect.width) / 2
          break
        case 'bottom':
          top = triggerRect.height + 8
          left = (triggerRect.width - tooltipRect.width) / 2
          break
        case 'left':
          top = (triggerRect.height - tooltipRect.height) / 2
          left = -tooltipRect.width - 8
          break
        case 'right':
          top = (triggerRect.height - tooltipRect.height) / 2
          left = triggerRect.width + 8
          break
      }

      setCoords({ top, left })
    }
  }, [isVisible, position])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-3 py-2 text-[11px] font-normal text-white bg-dark/95 rounded-lg shadow-lg max-w-[250px] whitespace-normal leading-relaxed pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-dark/95 rotate-45 ${
              position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </div>
  )
}

// Info icon component for help indicators
export function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-dark/40 hover:text-dark/70 transition-colors ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

// Combined tooltip with info icon
export function HelpTip({ content, position = 'top' }: { content: string, position?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip content={content} position={position}>
      <InfoIcon className="cursor-help ml-1" />
    </Tooltip>
  )
}
