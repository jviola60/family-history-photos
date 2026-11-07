import {
  FAL_MODELS,
  getAiSettings,
  restoreWithCloudAi,
  sanitizeFalKey,
  saveAiSettings,
  testFalConnection
} from './lib/aiSettings.js';
import {
  checkLocalAiHealth,
  restoreWithLocalAi
} from './lib/localAiService.js';

if (typeof window !== 'undefined') {
  window.ArchivalAiBridge = {
    FAL_MODELS,
    getAiSettings,
    saveAiSettings,
    sanitizeFalKey,
    testFalConnection,
    restoreWithCloudAi,
    checkLocalAiHealth,
    restoreWithLocalAi
  };
  window.dispatchEvent(new CustomEvent('archival_ai_ready'));
}
