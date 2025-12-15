import { getApps, getApp, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';

function createAdminApp() {
  if (getApps().length) return getApp();
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const useFileCred = !!credPath && fs.existsSync(credPath);
  return useFileCred
    ? initializeApp({ credential: applicationDefault() })
    : initializeApp();
}

const app = createAdminApp();

export const firestore = getFirestore(app);
export const firebaseAdminApp = app;
export default app;
