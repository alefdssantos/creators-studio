import { UrlDetector } from './url-detector';
import { QueuedVideo, VideoDetectionResult } from '@shared/types';
import {
  STORAGE_KEY,
  BROADCAST_CHANNEL,
  PENDING_URLS_KEY,
  PLATFORM_COLORS,
  DEFAULT_WEB_APP_URL,
} from '@shared/constants';

export class OverlayManager {
  private container: HTMLElement | null = null;
  private detector: UrlDetector;
  private currentVideo: VideoDetectionResult | null = null;
  private isExpanded = false;
  private cleanup: (() => void) | null = null;

  constructor() {
    this.detector = new UrlDetector();
  }

  init() {
    this.createOverlay();
    this.attachListeners();
    this.watchForVideoChanges();
    this.updateBadgeFromStorage();
    this.watchStorageChanges();
  }

  // Listen for storage changes from other tabs
  private watchStorageChanges() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        const queue: QueuedVideo[] = changes[STORAGE_KEY].newValue || [];
        this.updateBadge(queue.length);
        if (this.isExpanded) {
          this.updateQueueList();
        }
      }
    });
  }

  private createOverlay() {
    // Remove existing overlay if present
    const existing = document.getElementById('downloader-ext-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'downloader-ext-overlay';
    this.container.innerHTML = this.getOverlayHTML();
    document.body.appendChild(this.container);

    this.updateVisibility();
  }

  private getOverlayHTML(): string {
    return `
      <div class="downloader-ext-fab" id="downloader-fab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span class="downloader-ext-badge" id="downloader-badge">0</span>
      </div>

      <div class="downloader-ext-panel" id="downloader-panel">
        <div class="downloader-ext-header">
          <span>Adicionar ao Download</span>
          <button class="downloader-ext-close" id="downloader-close">&times;</button>
        </div>
        <div class="downloader-ext-content">
          <div class="downloader-ext-video-preview" id="downloader-preview">
            <p class="downloader-ext-empty">Nenhum vídeo detectado</p>
          </div>
          <div class="downloader-ext-actions">
            <button class="downloader-ext-btn primary" id="downloader-add" disabled>
              Adicionar à Fila
            </button>
            <button class="downloader-ext-btn secondary" id="downloader-open-app">
              Abrir Downloader
            </button>
          </div>
          <div class="downloader-ext-queue-section">
            <div class="downloader-ext-queue-header">
              <span>Na fila</span>
              <button class="downloader-ext-clear" id="downloader-clear">Limpar</button>
            </div>
            <div class="downloader-ext-queue" id="downloader-queue-list">
              <p class="downloader-ext-empty">Nenhum vídeo na fila</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachListeners() {
    // FAB click to toggle panel
    document.getElementById('downloader-fab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePanel();
    });

    // Close button
    document.getElementById('downloader-close')?.addEventListener('click', () => {
      this.togglePanel(false);
    });

    // Add to queue button
    document.getElementById('downloader-add')?.addEventListener('click', () => {
      this.addCurrentVideoToQueue();
    });

    // Open app button
    document.getElementById('downloader-open-app')?.addEventListener('click', () => {
      this.openDownloaderApp();
    });

    // Clear queue button
    document.getElementById('downloader-clear')?.addEventListener('click', () => {
      this.clearQueue();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isExpanded && !this.container?.contains(e.target as Node)) {
        this.togglePanel(false);
      }
    });

    // Prevent panel clicks from closing
    document.getElementById('downloader-panel')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  private watchForVideoChanges() {
    // Initial check
    this.currentVideo = this.detector.extractVideoUrl();
    this.updatePreview();

    // Watch for navigation changes
    this.cleanup = this.detector.watchUrlChanges((result) => {
      this.currentVideo = result;
      this.updateVisibility();
      this.updatePreview();
    });
  }

  private updateVisibility() {
    if (!this.container) return;

    // Always show on supported platforms
    this.container.style.display = 'block';
  }

  private updatePreview() {
    const preview = document.getElementById('downloader-preview');
    const addBtn = document.getElementById('downloader-add') as HTMLButtonElement;

    if (!preview) return;

    // Detect platform even without video URL
    const currentPlatform = this.detector.detectPlatform(window.location.href);

    if (!this.currentVideo) {
      const platformColor = currentPlatform ? PLATFORM_COLORS[currentPlatform] : '#666666';
      const platformName = currentPlatform ? currentPlatform.toUpperCase() : 'DESCONHECIDO';

      preview.innerHTML = `
        <div class="downloader-ext-platform" style="background: ${platformColor}">
          ${platformName}
        </div>
        <p class="downloader-ext-hint">Abra um vídeo específico para adicionar à fila</p>
      `;
      if (addBtn) addBtn.disabled = true;
      return;
    }

    const platform = this.currentVideo.platform;
    const color = PLATFORM_COLORS[platform] || '#666666';

    preview.innerHTML = `
      <div class="downloader-ext-platform" style="background: ${color}">
        ${platform.toUpperCase()}
      </div>
      <div class="downloader-ext-url">${this.truncateUrl(this.currentVideo.url, 45)}</div>
    `;

    if (addBtn) addBtn.disabled = false;
  }

  private truncateUrl(url: string, maxLength: number): string {
    return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
  }

  private togglePanel(show?: boolean) {
    this.isExpanded = show ?? !this.isExpanded;
    const panel = document.getElementById('downloader-panel');
    if (panel) {
      panel.classList.toggle('expanded', this.isExpanded);
    }
    if (this.isExpanded) {
      this.updateQueueList();
    }
  }

  private async addCurrentVideoToQueue() {
    if (!this.currentVideo) return;

    const video: QueuedVideo = {
      id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: this.currentVideo.url,
      platform: this.currentVideo.platform,
      addedAt: Date.now(),
      synced: false,
    };

    // Save to chrome.storage
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const queue: QueuedVideo[] = result[STORAGE_KEY] || [];

    // Check for duplicates
    if (queue.some((v) => v.url === video.url)) {
      this.showNotification('Vídeo já está na fila!', 'warning');
      return;
    }

    queue.push(video);
    await chrome.storage.local.set({ [STORAGE_KEY]: queue });

    // Sync with web app
    this.syncWithWebApp(video);

    this.updateBadge(queue.length);
    this.updateQueueList();
    this.showNotification('Adicionado à fila!', 'success');
  }

  private syncWithWebApp(_video: QueuedVideo) {
    // Note: BroadcastChannel and localStorage don't work cross-origin
    // The injector.ts script handles syncing when the user visits the Downloader app
    // URLs are already saved in chrome.storage by addCurrentVideoToQueue()
    console.log('[Downloader Extension] Video queued, will sync when Downloader app is opened');
  }

  private openDownloaderApp() {
    window.open(DEFAULT_WEB_APP_URL, '_blank');
  }

  private async updateQueueList() {
    const list = document.getElementById('downloader-queue-list');
    if (!list) return;

    const result = await chrome.storage.local.get(STORAGE_KEY);
    const queue: QueuedVideo[] = result[STORAGE_KEY] || [];

    if (queue.length === 0) {
      list.innerHTML = '<p class="downloader-ext-empty">Nenhum vídeo na fila</p>';
      return;
    }

    list.innerHTML = queue
      .slice(-5)
      .reverse()
      .map(
        (video) => `
      <div class="downloader-ext-queue-item">
        <span class="downloader-ext-queue-platform" style="background: ${PLATFORM_COLORS[video.platform] || '#666666'}">
          ${video.platform.charAt(0).toUpperCase()}
        </span>
        <span class="downloader-ext-queue-url">${this.truncateUrl(video.url, 30)}</span>
        <button class="downloader-ext-queue-remove" data-id="${video.id}">&times;</button>
      </div>
    `
      )
      .join('');

    // Attach remove listeners
    list.querySelectorAll('.downloader-ext-queue-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id;
        if (id) this.removeFromQueue(id);
      });
    });
  }

  private async removeFromQueue(id: string) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const queue: QueuedVideo[] = result[STORAGE_KEY] || [];
    const filtered = queue.filter((v) => v.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    this.updateBadge(filtered.length);
    this.updateQueueList();
  }

  private async clearQueue() {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    this.updateBadge(0);
    this.updateQueueList();
    this.showNotification('Fila limpa!', 'success');
  }

  private async updateBadgeFromStorage() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const queue: QueuedVideo[] = result[STORAGE_KEY] || [];
    this.updateBadge(queue.length);
  }

  private updateBadge(count: number) {
    const badge = document.getElementById('downloader-badge');
    if (badge) {
      badge.textContent = count.toString();
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  private showNotification(message: string, type: 'success' | 'warning' | 'error') {
    const existing = this.container?.querySelector('.downloader-ext-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `downloader-ext-notification ${type}`;
    notification.textContent = message;
    this.container?.appendChild(notification);

    setTimeout(() => notification.remove(), 2500);
  }

  destroy() {
    if (this.cleanup) {
      this.cleanup();
    }
    this.container?.remove();
  }
}
