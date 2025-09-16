// Load .env.local explicitly so this file always sees Admin vars in dev/scripts.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { getApps, initializeApp, getApp, App, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || ""; // may be ""
const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !rawPrivateKey) {
  // Optional quick booleans to diagnose WITHOUT leaking secrets:
  // console.log({
  //   hasProjectId: !!projectId,
  //   hasClientEmail: !!clientEmail,
  //   hasKey: !!rawPrivateKey,
  // });
  throw new Error("Missing FIREBASE_* env vars for Admin SDK (check .env.local).");
}

let adminApp: App;
if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
} else {
  adminApp = getApp();
}

export const adminDb = getFirestore(adminApp);
