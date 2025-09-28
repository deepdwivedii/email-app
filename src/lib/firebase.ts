import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  "projectId": "studio-8723461064-1f69a",
  "appId": "1:407435573533:web:b37c85765767fd607d09f4",
  "storageBucket": "studio-8723461064-1f69a.firebasestorage.app",
  "apiKey": "AIzaSyA8-Nv0TupsrH9UOHKbkC87pRG9mQI5KMQ",
  "authDomain": "studio-8723461064-1f69a.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "407435573533"
};

// Initialize Firebase
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(firebaseApp);

export { firebaseApp, auth };
