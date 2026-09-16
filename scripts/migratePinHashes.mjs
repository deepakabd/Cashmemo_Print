/**
 * One-off migration: clear legacy plaintext PINs from the `users` collection.
 *
 * A plaintext PIN cannot be converted into a hash (the hash needs the original
 * value, which is exactly what we want to destroy). So this script's job is to
 * REMOVE the readable `pin` field and set `pinResetRequired: true`, which forces
 * those accounts through a PIN re-issue.
 *
 * Run AFTER deploying firestore.rules and the /api/login endpoint:
 *
 *   node scripts/migratePinHashes.mjs --dry-run
 *   node scripts/migratePinHashes.mjs --apply
 *
 * Requires Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS).
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { isHashedPin } from "../server/pinCredentials.js";

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--apply");

const main = async () => {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  const users = await db.collection("users").get();

  const plaintext = [];
  const alreadyHashed = [];
  const noPin = [];

  users.forEach((doc) => {
    const data = doc.data();
    if (data.pinHash && isHashedPin(data.pinHash)) {
      alreadyHashed.push(doc.id);
    } else if (data.pin) {
      plaintext.push(doc.id);
    } else {
      noPin.push(doc.id);
    }
  });

  console.log(`Scanned ${users.size} user documents.`);
  console.log(`  already hashed (pinHash):  ${alreadyHashed.length}`);
  console.log(`  still plaintext (pin):     ${plaintext.length}`);
  console.log(`  no PIN set:                ${noPin.length}`);

  if (plaintext.length === 0) {
    console.log("\nNothing to migrate.");
    return;
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — no writes performed. Affected dealer codes:");
    plaintext.slice(0, 50).forEach((id) => console.log(`  - ${id}`));
    if (plaintext.length > 50)
      console.log(`  ... and ${plaintext.length - 50} more`);
    console.log("\nRe-run with --apply to clear the plaintext PINs.");
    return;
  }

  // Batched writes keep the migration idempotent and cheap to re-run.
  let batch = db.batch();
  let pending = 0;
  let updated = 0;

  for (const id of plaintext) {
    batch.update(db.collection("users").doc(id), {
      pin: null,
      pinHash: null,
      pinResetRequired: true,
      pinMigratedAt: new Date().toISOString(),
    });
    pending += 1;
    updated += 1;

    if (pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();

  console.log(`\nCleared the plaintext PIN on ${updated} accounts.`);
  console.log(
    "Those users must be issued a new PIN (pinResetRequired is now true).",
  );
};

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
