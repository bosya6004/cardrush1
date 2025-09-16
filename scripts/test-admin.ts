import { config } from "dotenv";
config({ path: ".env.local" });

import { adminDb } from "../src/lib/firebase/admin";

async function main() {
  const ref = adminDb.collection("diagnostics").doc("admin-sdk-test");
  const payload = { ok: true, at: new Date().toISOString(), nonce: Math.random() };
  await ref.set(payload, { merge: true });

  const snap = await ref.get();
  if (!snap.exists) throw new Error("Read failed: document not found");
  console.log("Admin write+read OK:", snap.data());
}

main().catch((err) => {
  console.error("Admin test failed:", err);
  process.exit(1);
});
