/**
 * Content script that runs on the Downloader app (localhost:3000)
 * Syncs URLs from chrome.storage to the app via localStorage and BroadcastChannel
 */

import { QueuedVideo } from '@shared/types';
import { STORAGE_KEY, BROADCAST_CHANNEL, PENDING_URLS_KEY } from '@shared/constants';

async function syncUrlsToApp() {
  try {
    // Get queued videos from chrome.storage
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const queue: QueuedVideo[] = result[STORAGE_KEY] || [];

    if (queue.length === 0) {
      console.log('[Downloader Extension] No URLs in queue');
      return;
    }

    const urls = queue.map((v) => v.url);

    // Always save all URLs to pending - frontend handles deduplication
    localStorage.setItem(PENDING_URLS_KEY, JSON.stringify(urls));

    // Send via BroadcastChannel for real-time sync (with delay for React to mount)
    setTimeout(() => {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      queue.forEach((video) => {
        channel.postMessage({
          type: 'ADD_URL',
          payload: video,
        });
      });
      channel.close();
    }, 500);

    console.log(`[Downloader Extension] Synced ${queue.length} URLs to app`);
  } catch (e) {
    console.error('[Downloader Extension] Sync error:', e);
  }
}

// Run sync immediately
syncUrlsToApp();

// Also listen for storage changes to sync new URLs
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    syncUrlsToApp();
  }
});

// Dispatch a custom event to notify the app that extension is present
window.dispatchEvent(new CustomEvent('downloader-extension-ready'));

console.log('[Downloader Extension] Injector loaded on Downloader app');
