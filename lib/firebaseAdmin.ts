// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getCredentials() {
  // Prefer inline JSON (FIREBASE_SERVICE_ACCOUNT_JSON), else ADC path
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
        try {
        const parsed = JSON.parse(json);
        return cert(parsed as any);
        } catch (e) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
        }
    }
    
    return applicationDefault();
}

const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: getCredentials(),
        });

export const adminDb = getFirestore(app);
