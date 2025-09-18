import { getApps, getApp, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Admin SDK using default credentials. On Firebase Hosting/Functions/App Hosting
// this uses the built-in service account. Locally, set GOOGLE_APPLICATION_CREDENTIALS.
const app = getApps().length ? getApp() : initializeApp({ credential: applicationDefault() });

export const firestore = getFirestore(app);
export default app;