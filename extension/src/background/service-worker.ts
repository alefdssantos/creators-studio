import { QueuedVideo } from '@shared/types';
import { STORAGE_KEY, DEFAULT_SETTINGS, SETTINGS_KEY } from '@shared/constants';

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Downloader Extension] Installed');

  // Set default settings
  chrome.storage.local.set({
    [SETTINGS_KEY]: DEFAULT_SETTINGS,
    [STORAGE_KEY]: [],
  });

  // Clear badge
  chrome.action.setBadgeText({ text: '' });
});

// Update badge when queue changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    const queue: QueuedVideo[] = changes[STORAGE_KEY].newValue || [];
    updateBadge(queue.length);
  }
});

function updateBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#7C3AED' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_QUEUE') {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      sendResponse(result[STORAGE_KEY] || []);
    });
    return true; // Will respond asynchronously
  }

  if (message.type === 'ADD_TO_QUEUE') {
    addToQueue(message.payload).then(sendResponse);
    return true;
  }

  if (message.type === 'REMOVE_FROM_QUEUE') {
    removeFromQueue(message.payload).then(sendResponse);
    return true;
  }

  if (message.type === 'CLEAR_QUEUE') {
    clearQueue().then(sendResponse);
    return true;
  }
});

async function addToQueue(video: QueuedVideo): Promise<{ success: boolean; reason?: string }> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const queue: QueuedVideo[] = result[STORAGE_KEY] || [];

  // Check for duplicates
  if (queue.some((v) => v.url === video.url)) {
    return { success: false, reason: 'duplicate' };
  }

  queue.push(video);
  await chrome.storage.local.set({ [STORAGE_KEY]: queue });

  return { success: true };
}

async function removeFromQueue(id: string): Promise<{ success: boolean }> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const queue: QueuedVideo[] = result[STORAGE_KEY] || [];
  const filtered = queue.filter((v) => v.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });

  return { success: true };
}

async function clearQueue(): Promise<{ success: boolean }> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  return { success: true };
}

// Initialize badge on startup
chrome.storage.local.get(STORAGE_KEY).then((result) => {
  const queue: QueuedVideo[] = result[STORAGE_KEY] || [];
  updateBadge(queue.length);
});
