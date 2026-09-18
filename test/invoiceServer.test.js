import { expect, it, vi } from 'vitest';
import { mutateInvoice, invoiceWorkspace } from '../server/invoiceWorkspace.js';
import { buildInvoiceLedger, invoiceDue, invoicePaid, financialYear, consumerStatement } from '../src/utils/invoiceAccounting.js';

const sdk = vi.hoisted(() => ({ auth: { verifyIdToken: vi.fn() }, firestore: null }));
vi.mock('../server/loginService.js', async (original) => ({ ...await original(), getAdmin: async () => sdk }));

const database = (initial = {}) => {
  const records = new Map(Object.entries(initial));
  let queue = Promise.resolve();
  const ref = (path) => ({ path, id: path.split('/').pop(), collection: (name) => collection(`${path}/${name}`), get: async () => snapshot(path) });
  const snapshot = (path) => ({ id: path.split('/').pop(), exists: records.has(path), data: () => records.get(path) && structuredClone(records.get(path)) });
  const collection = (path) => ({ doc: (id) => ref(`${path}/${id}`), get: async () => ({ docs: [...records.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/')).map(snapshot) }) });
  const firestore = { collection, runTransaction: (callback) => {
    const operation = queue.then(async () => {
      const writes = [];
      const result = await callback({ get: async (target) => { expect(writes).toHaveLength(0); return snapshot(target.path); }, set: (target, data) => writes.push([target.path, data]), update: (target, data) => writes.push([target.path, { ...records.get(target.path), ...data }]) });
      for (const [path, data] of writes) records.set(path, data);
      return result;
    });
    queue = operation.catch(() => {}); return operation;
  } };
  return { firestore, records };
};
const create = (id, date = '2026-04-01', total = 1000) => ({ mode: 'create', id, record: { title: id, draft: { billToDate: date, billToName: 'Ravi', billToConsumerNo: '101', summary: { payableTotal: total } } } });
const payment = (id, amount) => ({ mode: 'payment', id: 'bill', payment: { id, amount, date: '2026-04-02', mode: 'UPI', reference: 'ref' } });

it('allocates distinct financial-year numbers and replays the same creation safely', async () => {
  const { firestore } = database();
  const records = await Promise.all([mutateInvoice(firestore, 'u1', create('first')), mutateInvoice(firestore, 'u1', create('second'))]);
  expect(new Set(records.map((record) => record.invoiceNumber)).size).toBe(2);
  expect(records[0].invoiceNumber).toBe('INV/2026-27/00001');
  expect((await mutateInvoice(firestore, 'u1', create('first'))).invoiceNumber).toBe(records[0].invoiceNumber);
  expect(financialYear('2026-03-31')).toBe('2025-26');
});
it('records partial payments with exact balances and rejects concurrent overpayment', async () => {
  const { firestore } = database();
  await mutateInvoice(firestore, 'u1', create('bill'));
  const partial = await mutateInvoice(firestore, 'u1', payment('first', 400));
  expect(partial.status).toBe('Partial'); expect(invoicePaid(partial)).toBe(400); expect(invoiceDue(partial)).toBe(600);
  expect(await mutateInvoice(firestore, 'u1', payment('first', 400))).toEqual(partial);
  const results = await Promise.allSettled([mutateInvoice(firestore, 'u1', payment('second', 400)), mutateInvoice(firestore, 'u1', payment('third', 400))]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  await expect(mutateInvoice(firestore, 'u1', { mode: 'delete', id: 'bill' })).rejects.toThrow('payments cannot be deleted');
});
it('preserves historical paid records during migration and computes running ledger balances', async () => {
  const { firestore } = database();
  const request = create('bill'); request.mode = 'migrateInvoice'; request.record.status = 'Paid';
  const record = await mutateInvoice(firestore, 'u1', request);
  expect(invoiceDue(record)).toBe(0); expect(record.payments[0].mode).toBe('Legacy');
  expect(buildInvoiceLedger([record]).map((row) => row.balance)).toEqual([1000, 0]);
});
it('rejects malformed dates and negative payments without changing stored records', async () => {
  const { firestore, records } = database();
  await expect(mutateInvoice(firestore, 'u1', create('bill', '2026-02-31'))).rejects.toThrow('invoice date');
  expect(records.size).toBe(0);
  await mutateInvoice(firestore, 'u1', create('bill'));
  const before = JSON.stringify([...records]);
  await expect(mutateInvoice(firestore, 'u1', payment('negative', -1))).rejects.toThrow('positive');
  expect(JSON.stringify([...records])).toBe(before);
});
it('verifies revoked tokens and refuses a different dealer account', async () => {
  sdk.firestore = database({ 'users/u1': { dealerCode: 'D001', status: 'active' } }).firestore;
  sdk.auth.verifyIdToken.mockResolvedValue({ dealerCode: 'OTHER', accountActive: true, planActive: true });
  await expect(invoiceWorkspace('Bearer token', { userId: 'u1', mode: 'load' })).rejects.toMatchObject({ status: 403 });
  expect(sdk.auth.verifyIdToken).toHaveBeenCalledWith('token', true);
  await expect(invoiceWorkspace('', { userId: 'u1', mode: 'load' })).rejects.toMatchObject({ status: 401 });
});

it('edits an unpaid invoice without allocating a new number and locks it after payment', async () => {
  const { firestore } = database();
  const initial = await mutateInvoice(firestore, 'u1', create('bill'));
  const request = create('bill', '2026-04-01', 1200); request.mode = 'edit';
  const edited = await mutateInvoice(firestore, 'u1', request);
  expect(edited.invoiceNumber).toBe(initial.invoiceNumber); expect(invoiceDue(edited)).toBe(1200);
  await mutateInvoice(firestore, 'u1', payment('first', 400));
  await expect(mutateInvoice(firestore, 'u1', request)).rejects.toThrow('cannot be edited');
});

it('reverses a payment once, then cancels without losing the invoice or original payment', async () => {
  const { firestore } = database();
  const original = await mutateInvoice(firestore, 'u1', create('bill'));
  await mutateInvoice(firestore, 'u1', payment('first', 400));
  await expect(mutateInvoice(firestore, 'u1', { mode: 'cancel', id: 'bill', reason: 'Wrong bill' })).rejects.toThrow('Reverse payments first');
  const reversal = { mode: 'reversePayment', id: 'bill', paymentId: 'first', reason: 'Wrong receipt' };
  const reversed = await mutateInvoice(firestore, 'u1', reversal);
  expect(invoicePaid(reversed)).toBe(0); expect(invoiceDue(reversed)).toBe(1000);
  expect(reversed.payments[0].amount).toBe(400);
  expect(await mutateInvoice(firestore, 'u1', reversal)).toEqual(reversed);
  const cancelled = await mutateInvoice(firestore, 'u1', { mode: 'cancel', id: 'bill', reason: 'Wrong bill' });
  expect(cancelled.invoiceNumber).toBe(original.invoiceNumber); expect(cancelled.status).toBe('Cancelled');
  expect(buildInvoiceLedger([cancelled]).at(-1).balance).toBe(0);
  await expect(mutateInvoice(firestore, 'u1', payment('next', 100))).rejects.toThrow('cannot be changed');
});

it('keeps opening balance outside the statement period and includes debit/credit adjustments', async () => {
  const { firestore } = database();
  const record = await mutateInvoice(firestore, 'u1', create('bill'));
  const adjustments = [{ id: 'opening', consumer: 'Ravi', consumerKey: '101', type: 'OpeningDebit', amount: 200, date: '2026-03-01', reason: 'Carry forward' }, { id: 'credit', consumer: 'Ravi', consumerKey: '101', type: 'Credit', amount: 100, date: '2026-04-02', reason: 'Correction' }];
  const statement = consumerStatement(buildInvoiceLedger([record], adjustments), '101', '2026-04-01', '2026-04-30');
  expect(statement.opening).toBe(200); expect(statement.debit).toBe(1000); expect(statement.credit).toBe(100); expect(statement.closing).toBe(1100);
});

it('allows only one opening balance per stored consumer', async () => {
  const { firestore } = database({ 'users/u1': { dealerCode: 'D001', status: 'active' }, 'users/u1/consumers/customer': { consumerNo: '101', consumerName: 'Ravi', mobileNo: '9876543210' } });
  sdk.firestore = firestore; sdk.auth.verifyIdToken.mockResolvedValue({ dealerCode: 'D001', accountActive: true, planActive: true, role: 'operator' });
  const entry = { id: 'opening', consumerId: 'customer', type: 'OpeningDebit', amount: 200, date: '2026-03-01', reason: 'Carry forward' };
  await invoiceWorkspace('Bearer token', { userId: 'u1', mode: 'adjustment', entry });
  await expect(invoiceWorkspace('Bearer token', { userId: 'u1', mode: 'adjustment', entry: { ...entry, id: 'duplicate' } })).rejects.toThrow('already recorded');
});
