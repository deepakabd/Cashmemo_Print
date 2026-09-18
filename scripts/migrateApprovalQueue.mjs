// Run while approval submissions/completions are paused, before deploying the queue-only reader.
// Dry run is the default. Requires Firebase Admin application default credentials.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildLegacyApprovalQueue } from './legacyApprovalQueue.js';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const readAll = async (name, fields) => {
  const records = [];
  let cursor;
  for (;;) {
    let query = db.collection(name).orderBy('__name__').limit(200);
    if (fields) query = query.select(...fields);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    records.push(...page.docs.map((document) => ({ ...document.data(), id: document.id })));
    if (page.size < 200) return records;
    cursor = page.docs.at(-1);
  }
};
const [users, approvals] = await Promise.all([
  readAll('users', ['dealerCode', 'dealerName', 'pendingUpdates', 'pendingDictionaryRequests']),
  readAll('updateApprovals'),
]);
const records = buildLegacyApprovalQueue(users, approvals);
console.log(`${records.length} legacy approvals need queue records.`);
if (process.argv.includes('--apply')) {
  for (let index = 0; index < records.length; index += 400) {
    const batch = db.batch();
    for (const { id, ...record } of records.slice(index, index + 400)) {
      batch.create(db.collection('updateApprovals').doc(id), { ...record, updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  console.log('Migration complete. Existing queue records and user documents were preserved.');
} else {
  console.log('Dry run only. Use --apply to create queue records.');
}
