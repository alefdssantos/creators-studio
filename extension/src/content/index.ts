import './styles.css';
import { OverlayManager } from './overlay';

// Initialize overlay when DOM is ready
function init() {
  const overlay = new OverlayManager();
  overlay.init();

  // Log for debugging
  console.log('[Downloader Extension] Overlay initialized');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
