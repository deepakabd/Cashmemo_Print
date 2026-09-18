import { createHash } from 'node:crypto';
import { getAdmin, LoginError } from './loginService.js';
import { getUserAccountStatus } from '../src/utils/userAccountStatus.js';
import { invoicePaid, invoiceDue, invoiceNetTotal, invoiceRefunded, paymentStatus, indiaDate, financialYear } from '../src/utils/invoiceAccounting.js';

const fail = (message, status = 400) => { throw new LoginError('billing-error', message, status); };
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const hashId = (value) => createHash('sha256').update(value).digest('hex');
const validDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export const mutateInvoice = async (firestore, userId, body, actor = userId) => {
  const root = firestore.collection('users').doc(userId);
  if (!validId(body.id)) fail('Valid record ID required.');
  const ref = root.collection('invoices').doc(body.id);
  return firestore.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (body.mode === 'create' || body.mode === 'migrateInvoice') {
      if (existing.exists) {
        if (body.mode === 'create' && existing.data().archived) fail('This invoice was deleted. Start a new invoice.', 409);
        if (body.mode === 'create' && JSON.stringify(existing.data().draft) !== JSON.stringify(body.record?.draft)) fail('This draft was already saved. Start a new invoice for changed details.', 409);
        return existing.data(); // Stable ID makes retries idempotent.
      }
      const input = body.record;
      if (!input?.draft || typeof input.draft !== 'object' || Array.isArray(input.draft)) fail('Invoice draft required.');
      const date = input.draft.billToDate || indiaDate();
      if (!validDate(date)) fail('Valid invoice date required.');
      if (input.draft.billDueDate && (!validDate(input.draft.billDueDate) || input.draft.billDueDate < date)) fail('Due date must be a valid date on or after the invoice date.');
      const total = Number(input.header?.amount ?? input.draft.summary?.payableTotal);
      if (!Number.isFinite(total) || total < 0 || total > 100000000) fail('Valid invoice total required.');
      const fy = financialYear(date);
      const counterRef = root.collection('billingCounters').doc(fy);
      const counter = await tx.get(counterRef);
      const sequence = Number(counter.data()?.sequence || 0) + 1;
      const payments = body.mode === 'migrateInvoice' && input.status === 'Paid' && total > 0
        ? [{ id: `legacy-${body.id}`, amount: Math.round(total * 100) / 100, date, mode: 'Legacy', reference: 'Imported paid status', recordedAt: new Date().toISOString() }] : [];
      const next = { id: body.id, invoiceNumber: `INV/${fy}/${String(sequence).padStart(5, '0')}`,
        title: String(input.title || input.draft.billToName || 'Invoice').slice(0, 250),
        draft: input.draft, header: { name: input.draft.billToName || '', mobile: input.draft.billToMobileNo || '', address: input.draft.billToAddress || '', date, amount: Math.round(total * 100) / 100 },
        payments, createdBy: actor, savedAt: body.mode === 'migrateInvoice' ? input.savedAt || new Date().toISOString() : new Date().toISOString(), archived: false };
      next.status = paymentStatus(next);
      tx.set(counterRef, { sequence }); tx.set(ref, next);
      return next;
    }
    if (!existing.exists || existing.data().archived) fail('Invoice not found.', 404);
    const record = existing.data();
    if (body.mode === 'trashInvoice' || body.mode === 'restoreInvoice') {
      const trashed = body.mode === 'trashInvoice';
      if (Boolean(record.trashed) === trashed) return record;
      const next = { ...record, trashed, deletedAt: trashed ? new Date().toISOString() : null, deletedBy: trashed ? actor : null, restoredAt: trashed ? null : new Date().toISOString() };
      tx.update(ref, next); return next;
    }
    if (record.trashed) fail('Restore this invoice from Bin before changing it.', 409);
    if (body.mode === 'reversePayment') {
      const payment = record.payments.find((item) => item.id === body.paymentId);
      if (!payment) fail('Payment not found.', 404);
      if (payment.reversal) return record;
      if (record.refunds?.length) fail('Payments backing recorded refunds cannot be reversed.');
      const reason = String(body.reason || '').trim();
      if (reason.length < 3 || reason.length > 500) fail('A reversal reason of 3–500 characters is required.');
      const next = { ...record, payments: record.payments.map((item) => item.id === payment.id ? { ...item, reversal: { reason, date: indiaDate(), recordedBy: actor, recordedAt: new Date().toISOString() } } : item) };
      next.status = paymentStatus(next); tx.update(ref, { payments: next.payments, status: next.status }); return next;
    }
    if (body.mode === 'cancel' || body.mode === 'delete') {
      if (record.status === 'Cancelled') return record;
      if (invoicePaid(record) > 0) fail('Invoices with recorded payments cannot be deleted or cancelled. Reverse payments first.');
      if (record.refunds?.length) fail('Invoices with recorded refunds cannot be cancelled.');
      const reason = String(body.reason || '').trim();
      if (reason.length < 3 || reason.length > 500) fail('A cancellation reason of 3–500 characters is required.');
      const next = { ...record, status: 'Cancelled', cancellation: { reason, date: indiaDate(), recordedBy: actor, recordedAt: new Date().toISOString() } };
      tx.update(ref, { status: next.status, cancellation: next.cancellation }); return next;
    }
    if (record.status === 'Cancelled') fail('Cancelled invoices cannot be changed.');
    if (body.mode === 'note' || body.mode === 'refund') {
      const entry = body.entry;
      if (!validId(entry?.id)) fail('Entry ID required.');
      const field = body.mode === 'note' ? 'notes' : 'refunds';
      const entries = record[field] || [];
      const amount = Number(entry.amount);
      const reason = String(entry.reason || '').trim();
      const replay = entries.find((item) => item.id === entry.id);
      if (replay) {
        if (replay.amount !== amount || replay.date !== entry.date || replay.reason !== reason || (field === 'notes' && replay.type !== entry.type)) fail('Entry ID already used with different details.', 409);
        return record;
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) fail('Valid positive amount with up to two decimals required.');
      if (!validDate(entry.date) || entry.date < record.header.date || entry.date > indiaDate()) fail('Entry date must be between the invoice date and today.');
      if (reason.length < 3 || reason.length > 500) fail('Reason of 3?500 characters required.');
      if (field === 'notes' && !['Credit', 'Debit'].includes(entry.type)) fail('Credit or Debit note required.');
      if (field === 'notes' && entry.type === 'Credit' && amount > invoiceNetTotal(record)) fail('Credit cannot exceed the adjusted invoice total.');
      const refundable = Math.max(0, invoicePaid(record) - invoiceRefunded(record) - invoiceNetTotal(record));
      if (field === 'refunds' && Math.round(amount * 100) > Math.round(refundable * 100)) fail('Refund cannot exceed the consumer credit on this invoice. Issue a credit note first.');
      const saved = { id: entry.id, amount, date: entry.date, reason, recordedBy: actor, recordedAt: new Date().toISOString(), ...(field === 'notes' ? { type: entry.type } : {}) };
      const next = { ...record, [field]: [...entries, saved] };
      next.status = paymentStatus(next);
      tx.update(ref, { [field]: next[field], status: next.status });
      return next;
    }
    if (body.mode === 'edit') {
      if (invoicePaid(record) > 0 || record.notes?.length || record.refunds?.length) fail('Invoices with payments, notes or refunds cannot be edited.');
      const draft = body.record?.draft;
      const total = Number(draft?.summary?.payableTotal);
      if (!draft || !draft.billToName?.trim() || !validDate(draft.billToDate)
        || !Number.isFinite(total) || total < 0 || total > 100000000) fail('Valid invoice details required.');
      if (draft.billToDate !== record.header.date) fail('The issued invoice date cannot be changed.');
      if (draft.billDueDate && (!validDate(draft.billDueDate) || draft.billDueDate < draft.billToDate)) fail('Valid invoice due date required.');
      const next = { ...record, draft, header: { name: draft.billToName, mobile: draft.billToMobileNo || '', address: draft.billToAddress || '', date: draft.billToDate, amount: Math.round(total * 100) / 100 }, updatedBy: actor, updatedAt: new Date().toISOString() };
      next.status = paymentStatus(next);
      tx.set(root.collection('invoiceHistory').doc(`${body.id}-${Number(record.version || 0) + 1}`), record);
      next.version = Number(record.version || 0) + 1;
      tx.update(ref, next); return next;
    }
    if (body.mode !== 'payment') fail('Unknown invoice operation.');
    const payment = body.payment;
    if (!validId(payment?.id)) fail('Payment ID required.');
    const replay = record.payments.find((item) => item.id === payment.id);
    if (replay) {
      if (replay.amount !== Number(payment.amount) || replay.date !== payment.date || replay.mode !== payment.mode
        || replay.reference !== String(payment.reference || '').slice(0, 200)) fail('This payment was already recorded with different details. Sync Data first.', 409);
      return record;
    }
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
      || Math.round(amount * 100) > Math.round(invoiceDue(record) * 100)) fail('Payment must be positive and cannot exceed the balance due.');
    if (!validDate(payment.date) || payment.date > indiaDate()) fail('Valid payment date required; future dates are not allowed.');
    if (payment.date < record.header.date) fail('Payment date cannot precede the invoice date.');
    if (!['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'].includes(payment.mode)) fail('Valid payment mode required.');
    const next = { ...record, payments: [...record.payments, { id: payment.id, amount, date: payment.date, mode: payment.mode, reference: String(payment.reference || '').slice(0, 200), recordedBy: actor, recordedAt: new Date().toISOString() }] };
    next.status = paymentStatus(next);
    tx.update(ref, { payments: next.payments, status: next.status });
    return next;
  });
};

export const invoiceWorkspace = async (authorization, body) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) fail('Sign in to access billing.', 401);
  const { auth, firestore } = await getAdmin();
  let claims;
  try { claims = await auth.verifyIdToken(token, true); } catch { fail('Sign in again to access billing.', 401); }
  if (!validId(body?.userId)) fail('Valid dealer account required.');
  const user = await firestore.collection('users').doc(body.userId).get();
  if (!user.exists || !claims.dealerCode || claims.dealerCode !== user.data().dealerCode
    || claims.accountActive !== true || claims.planActive !== true
    || getUserAccountStatus(user.data()) !== 'active') fail('Billing access is not allowed for this account.', 403);
  if ((claims.role === 'viewer' || user.data().role === 'viewer') && body.mode !== 'load') fail('This account has read-only billing access.', 403);
  const root = firestore.collection('users').doc(body.userId);
  if (body.mode === 'load') {
    const [invoices, consumers, adjustments] = await Promise.all([root.collection('invoices').get(), root.collection('consumers').get(), root.collection('billingAdjustments').get()]);
    return { invoices: invoices.docs.map((doc) => ({ ...doc.data(), id: doc.id })).filter((record) => !record.archived), consumers: consumers.docs.map((doc) => ({ ...doc.data(), id: doc.id })), adjustments: adjustments.docs.map((doc) => ({ ...doc.data(), id: doc.id })) };
  }
  if (body.mode === 'trashConsumer' || body.mode === 'restoreConsumer') {
    if (!validId(body.id)) fail('Valid consumer ID required.');
    const ref = root.collection('consumers').doc(body.id);
    return firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail('Consumer not found.', 404);
      const record = snapshot.data();
      const trashed = body.mode === 'trashConsumer';
      if (Boolean(record.trashed) === trashed) return { ...record, id: ref.id };
      const next = { ...record, trashed, deletedAt: trashed ? new Date().toISOString() : null, deletedBy: trashed ? claims.email || claims.uid || body.userId : null, restoredAt: trashed ? null : new Date().toISOString() };
      tx.update(ref, next); return { ...next, id: ref.id };
    });
  }
  if (body.mode === 'adjustment') {
    const entry = body.entry;
    if (!validId(entry?.id) || !['OpeningDebit', 'OpeningCredit', 'Debit', 'Credit'].includes(entry.type)
      || !validDate(entry.date) || entry.date > indiaDate() || !Number.isFinite(entry.amount) || entry.amount <= 0 || entry.amount > 100000000
      || Math.abs(entry.amount * 100 - Math.round(entry.amount * 100)) > 0.00001
      || !String(entry.reason || '').trim() || !validId(entry.consumerId)) fail('Valid consumer, type, amount, date and reason required.');
    const ref = root.collection('billingAdjustments').doc(entry.id);
    return firestore.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return { ...existing.data(), id: ref.id };
      const consumer = await tx.get(root.collection('consumers').doc(entry.consumerId));
      if (!consumer.exists || consumer.data().trashed) fail('Active consumer not found.', 404);
      const openingRef = root.collection('billingOpeningBalances').doc(entry.consumerId);
      if (entry.type.startsWith('Opening')) {
        const opening = await tx.get(openingRef);
        if (opening.exists) fail('Opening balance already recorded. Use a debit/credit adjustment to correct it.', 409);
      }
      const customer = consumer.data();
      const next = { id: entry.id, consumer: customer.consumerName, consumerKey: customer.consumerNo || customer.mobileNo || customer.consumerName.toLowerCase(), type: entry.type, amount: entry.amount, date: entry.date, reason: String(entry.reason).trim().slice(0, 500), recordedBy: claims.email || claims.uid, recordedAt: new Date().toISOString() };
      if (entry.type.startsWith('Opening')) tx.set(openingRef, { entryId: entry.id });
      tx.set(ref, next); return next;
    });
  }
  if (body.mode === 'bulkConsumers') {
    if (!Array.isArray(body.consumers) || !body.consumers.length || body.consumers.length > 400) fail('Import 1?400 consumers per file.');
    const seen = new Set();
    const consumers = body.consumers.map((input, index) => {
      const next = Object.fromEntries(['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin'].map((key) => [key, String(input?.[key] || '').trim().slice(0, 500)]));
      if (!next.consumerName || !next.consumerNo || !/^\d{10}$/.test(next.mobileNo)) fail(`Row ${index + 2}: valid name, consumer number and mobile required.`);
      const id = hashId(next.consumerNo.toUpperCase());
      if (seen.has(id)) fail(`Duplicate consumer number ${next.consumerNo}.`, 409);
      seen.add(id); return { ...next, id };
    });
    return firestore.runTransaction(async (tx) => {
      const refs = consumers.map((consumer) => root.collection('consumers').doc(consumer.id));
      const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
      const same = (record, input) => ['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin'].every((key) => String(record[key] || '') === input[key]);
      if (snapshots.every((snapshot, index) => snapshot.exists && !snapshot.data().trashed && same(snapshot.data(), consumers[index]))) return { consumers: snapshots.map((snapshot, index) => ({ ...snapshot.data(), id: consumers[index].id })) };
      if (snapshots.some((snapshot) => snapshot.exists)) fail('A consumer number already exists (including Bin). No consumers imported.', 409);
      consumers.forEach((consumer, index) => tx.set(refs[index], consumer));
      return { consumers };
    });
  }
  if (body.mode === 'consumer') {
    const input = body.consumer;
    if (typeof input?.consumerName !== 'string' || !input.consumerName.trim()
      || (body.migrate !== true && (typeof input.consumerNo !== 'string' || !input.consumerNo.trim()))
      || !/^\d{10}$/.test(String(input.mobileNo || ''))) fail('Consumer name, number and valid mobile required.');
    const id = hashId(String(input.consumerNo || input.mobileNo).trim().toUpperCase());
    const ref = root.collection('consumers').doc(id);
    return firestore.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (body.migrate === true) return { ...existing.data(), id };
        if (body.editId === id) {
          if (existing.data().trashed) fail('Restore this consumer from Bin before editing.', 409);
          const next = Object.fromEntries(['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin'].map((key) => [key, String(input[key] || '').trim().slice(0, 500)]));
          tx.update(ref, { ...next, updatedAt: new Date().toISOString() }); return { ...existing.data(), ...next, id };
        }
        fail('This consumer number already exists.', 409);
      }
      if (body.editId) fail('Consumer no longer exists. The consumer number cannot be changed.', 409);
      const next = Object.fromEntries(['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin'].map((key) => [key, String(input[key] || '').trim().slice(0, 500)]));
      tx.set(ref, next); return { ...next, id };
    });
  }
  return mutateInvoice(firestore, body.userId, body, claims.email || claims.uid);
};
