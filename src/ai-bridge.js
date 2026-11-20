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
import * as CloudHub from './lib/cloudHub.js';
import * as GedcomParser from './lib/gedcomParser.js';
import * as DriveSync from './lib/driveSync.js';

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
  window.CloudImportHub = CloudHub;
  window.GedcomImporter = GedcomParser;
  window.DriveSyncUtil = DriveSync;
  window.dispatchEvent(new CustomEvent('archival_ai_ready'));
}
