import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';

export const syncGmailRecent = onSchedule({ schedule: 'every 10 minutes', timeoutSeconds: 120, memory: '256MiB' }, async () => {
  logger.info('syncGmailRecent tick');
  // TODO: fetch mailboxes with provider=gmail and run history sync using stored cursor
});

export const syncOutlookDelta = onSchedule({ schedule: 'every 10 minutes', timeoutSeconds: 120, memory: '256MiB' }, async () => {
  logger.info('syncOutlookDelta tick');
  // TODO: fetch mailboxes with provider=outlook and run delta sync using stored token
});