import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueuedVideo } from '@shared/types';
import { STORAGE_KEY, PLATFORM_COLORS, DEFAULT_WEB_APP_URL, PENDING_URLS_KEY } from '@shared/constants';

function Popup() {
  const [queue, setQueue] = useState<QueuedVideo[]>([]);

  useEffect(() => {
    loadQueue();

    // Listen for storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEY]) {
        setQueue(changes[STORAGE_KEY].newValue || []);
      }
    };

    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const loadQueue = async () => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    setQueue(result[STORAGE_KEY] || []);
  };

  const clearQueue = async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    setQueue([]);
  };

  const removeFromQueue = async (id: string) => {
    const filtered = queue.filter((v) => v.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    setQueue(filtered);
  };

  const openApp = () => {
    chrome.tabs.create({ url: DEFAULT_WEB_APP_URL });
  };

  const downloadAll = async () => {
    if (queue.length === 0) return;

    // Save URLs to localStorage via content script
    const urls = queue.map((v) => v.url);

    // Open app with URLs in query param
    const urlsParam = encodeURIComponent(JSON.stringify(urls));
    chrome.tabs.create({ url: `${DEFAULT_WEB_APP_URL}?import=${urlsParam}` });

    // Clear the queue after opening
    await clearQueue();
  };

  const getPlatformColor = (platform: string) => {
    return PLATFORM_COLORS[platform] || '#666666';
  };

  const truncateUrl = (url: string, maxLength = 35) => {
    return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
  };

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>DOWNLOADER</h1>
        <span className="queue-count">{queue.length}</span>
      </header>

      <div className="popup-content">
        {queue.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum vídeo na fila</p>
            <p className="hint">Visite YouTube, TikTok ou Twitter para adicionar vídeos</p>
          </div>
        ) : (
          <>
            <div className="queue-list">
              {queue.map((video) => (
                <div key={video.id} className="queue-item">
                  <span
                    className="platform-badge"
                    style={{ background: getPlatformColor(video.platform) }}
                  >
                    {video.platform.charAt(0).toUpperCase()}
                  </span>
                  <span className="url">{truncateUrl(video.url)}</span>
                  <button className="remove-btn" onClick={() => removeFromQueue(video.id)}>
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <div className="popup-actions">
              <button className="btn primary" onClick={downloadAll}>
                Baixar Todos ({queue.length})
              </button>
              <button className="btn secondary" onClick={clearQueue}>
                Limpar Fila
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="popup-footer">
        <button className="btn link" onClick={openApp}>
          Abrir Downloader
        </button>
      </footer>
    </div>
  );
}

// Mount React app
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Popup />);
}
