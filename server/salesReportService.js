import { getAdmin, LoginError } from './loginService.js';

export const SALES_REPORT_CHUNK_SIZE = 700_000;

export const splitSalesReportData = (value = '') => {
  const chunks = [];
  for (let offset = 0; offset < value.length; offset += SALES_REPORT_CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + SALES_REPORT_CHUNK_SIZE));
  }
  return chunks;
};

const chunkId = (index) => String(index).padStart(4, '0');

const hydrateChunkedData = async (targetDocRef, salesReportData) => {
  const chunkCount = Number(salesReportData?.chunkCount || 0);
  if (salesReportData?.storageVersion !== 2 || chunkCount < 1) return salesReportData;

  const snapshots = await Promise.all(Array.from({ length: chunkCount }, (_, index) => (
    targetDocRef.collection('salesReportChunks').doc(chunkId(index)).get()
  )));
  if (snapshots.some((snapshot) => !snapshot.exists)) {
    throw new LoginError('incomplete-cloud-data', 'Sales Report cloud data is incomplete. Please upload it again.', 409);
  }
  return {
    ...salesReportData,
    compressedData: snapshots.map((snapshot) => snapshot.data()?.data || '').join(''),
  };
};

/**
 * Server-side trusted service for Sales Report cloud persistence.
 * Uses Firebase Admin SDK to bypass client-side security rules,
 * handle documents regardless of whether accessed by userId or dealerCode,
 * and support both dealer accounts and administrator oversight.
 */
export const handleSalesReportRequest = async (authorization, body = {}) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) {
    throw new LoginError('unauthenticated', 'Sign in to sync Sales Report data.', 401);
  }

  const { auth, firestore } = await getAdmin();
  let claims;
  try {
    claims = await auth.verifyIdToken(token, true);
  } catch {
    throw new LoginError('unauthenticated', 'Sign in again to sync Sales Report data.', 401);
  }
  const mode = body.mode || 'save'; // 'save' | 'load'
  const userId = body.userId ? String(body.userId).trim() : '';
  const dealerCode = body.dealerCode ? String(body.dealerCode).trim() : '';

  if (!userId && !dealerCode) {
    throw new LoginError('missing-identity', 'User ID or Dealer Code is required.', 400);
  }

  // 1. Locate the user document in Firestore
  let targetDocRef = null;
  if (userId) {
    const directDoc = firestore.collection('users').doc(userId);
    const snap = await directDoc.get();
    if (snap.exists) {
      targetDocRef = directDoc;
    }
  }

  if (!targetDocRef && dealerCode) {
    const q = await firestore.collection('users').where('dealerCode', '==', dealerCode).limit(1).get();
    if (!q.empty) {
      targetDocRef = q.docs[0].ref;
    }
  }

  if (!targetDocRef) {
    throw new LoginError('account-not-found', 'Dealer account was not found.', 404);
  }

  const targetSnapshot = await targetDocRef.get();
  const target = targetSnapshot.data() || {};
  const isAdmin = claims.role === 'admin';
  const ownsAccount = claims.uid === targetDocRef.id
    || (claims.dealerCode && claims.dealerCode === target.dealerCode);
  if (!isAdmin && !ownsAccount) {
    throw new LoginError('forbidden', 'Sales Report access is not allowed for this account.', 403);
  }
  if (mode !== 'load' && !isAdmin
    && (claims.accountActive !== true || claims.planActive !== true)) {
    throw new LoginError('inactive-account', 'An active account and plan are required to sync Sales Report data.', 403);
  }

  // 2. Process request mode
  if (mode === 'load') {
    const salesReportData = await hydrateChunkedData(targetDocRef, target?.salesReportData || null);
    return {
      success: true,
      docId: targetDocRef.id,
      salesReportData,
    };
  }

  // mode === 'save'
  const salesReportData = body.salesReportData;
  if (!salesReportData || typeof salesReportData !== 'object') {
    throw new LoginError('invalid-data', 'salesReportData payload is required.', 400);
  }

  const compressedData = typeof salesReportData.compressedData === 'string'
    ? salesReportData.compressedData
    : '';
  const chunks = splitSalesReportData(compressedData);
  const previousChunkCount = Number(target?.salesReportData?.chunkCount || 0);
  const payload = {
    ...salesReportData,
    updatedAt: new Date().toISOString(),
  };

  if (chunks.length > 1) {
    delete payload.compressedData;
    payload.storageVersion = 2;
    payload.chunkCount = chunks.length;
    payload.compression = 'lz-string-base64';

    await Promise.all(chunks.map((data, index) => (
      targetDocRef.collection('salesReportChunks').doc(chunkId(index)).set({
        data,
        index,
        updatedAt: payload.updatedAt,
      })
    )));
  } else {
    delete payload.storageVersion;
    delete payload.chunkCount;
    delete payload.compression;
  }

  await targetDocRef.set({
    salesReportData: payload,
  }, { merge: true });

  if (previousChunkCount > chunks.length) {
    await Promise.all(Array.from(
      { length: previousChunkCount - chunks.length },
      (_, offset) => targetDocRef.collection('salesReportChunks')
        .doc(chunkId(chunks.length + offset)).delete(),
    ));
  }

  return {
    success: true,
    docId: targetDocRef.id,
  };
};
