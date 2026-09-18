import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import InvoicePage from '../src/InvoicePage';
import { invoiceDue, paymentStatus } from '../src/utils/invoiceAccounting';

const cloud = vi.hoisted(() => ({ invoices: new Map(), consumers: [], fail: false }));
vi.mock('../src/services/invoiceRepository', () => ({ invoiceRequest: vi.fn(async (_userId, body) => {
  if (cloud.fail) throw new Error('Cloud unavailable');
  if (body.mode === 'load') return { invoices: [...cloud.invoices.values()], consumers: cloud.consumers };
  if (body.mode === 'consumer') { const next = { ...body.consumer, id: 'consumer-1' }; cloud.consumers.push(next); return next; }
  if (body.mode === 'create' || body.mode === 'migrateInvoice') {
    const record = { ...body.record, invoiceNumber: `INV/2026-27/${body.id}`, payments: body.record.status === 'Paid' ? [{ id: 'legacy', amount: body.record.draft.summary.payableTotal, date: '2026-09-18', mode: 'Legacy' }] : [] };
    cloud.invoices.set(body.id, record); return record;
  }
  if (body.mode === 'payment') { const record = cloud.invoices.get(body.id); const next = { ...record, payments: [...record.payments, body.payment] }; next.status = paymentStatus(next); cloud.invoices.set(body.id, next); return next; }
  if (body.mode === 'reversePayment') { const record = cloud.invoices.get(body.id); const next = { ...record, payments: record.payments.map((payment) => payment.id === body.paymentId ? { ...payment, reversal: { reason: body.reason, date: '2026-09-18' } } : payment) }; next.status = paymentStatus(next); cloud.invoices.set(body.id, next); return next; }
  if (body.mode === 'cancel') { const next = { ...cloud.invoices.get(body.id), status: 'Cancelled', cancellation: { reason: body.reason, date: '2026-09-18' } }; cloud.invoices.set(body.id, next); return next; }
  if (['trashInvoice', 'restoreInvoice'].includes(body.mode)) { const next = { ...cloud.invoices.get(body.id), trashed: body.mode === 'trashInvoice', deletedAt: '2026-09-18T10:00:00Z' }; cloud.invoices.set(body.id, next); return next; }
  if (['trashConsumer', 'restoreConsumer'].includes(body.mode)) { const next = { ...cloud.consumers.find((item) => item.id === body.id), trashed: body.mode === 'trashConsumer', deletedAt: '2026-09-18T10:00:00Z' }; cloud.consumers = cloud.consumers.map((item) => item.id === body.id ? next : item); return next; }
  if (body.mode === 'delete') { cloud.invoices.delete(body.id); return { id: body.id }; }
}) }));
beforeEach(() => { cloud.invoices.clear(); cloud.consumers = []; cloud.fail = false; });

const dealer = { id: 'u1', dealerCode: 'D001', dealerName: 'Test Agency', ratesData: [{ Item: 'LPG Cylinder', BasicPrice: 900, RSP: 1100 }] };

it('shows saved invoice totals on the dashboard and updates them after recording payment', { timeout: 20000 }, async () => {
  localStorage.setItem('cashmemoSavedInvoices_D001', JSON.stringify([
    { id: 'paid', title: 'Paid bill', status: 'Paid', savedAt: '2026-09-18T10:00:00Z', draft: { billToName: 'Ravi', billToConsumerNo: '101', summary: { payableTotal: 300 } } },
    { id: 'due', title: 'Due bill', status: 'Unpaid', savedAt: '2026-09-18T11:00:00Z', draft: { billToName: 'Mohan', billToConsumerNo: '102', summary: { payableTotal: 200 } } },
  ]));
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Cloud billing connected');
  expect(within(screen.getByRole('button', { name: /Total Consumers/ })).getByText('2')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /Recorded Paid/ })).getByText('₹300.00')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /Outstanding Balance/ })).getByText('₹200.00')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  const paymentButtons = screen.getAllByRole('button', { name: 'Record Payment' });
  fireEvent.click(paymentButtons.find((button) => !button.disabled));
  fireEvent.click(screen.getByRole('button', { name: 'Save Payment' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Record payment' })).toBeNull());
  await waitFor(() => expect(invoiceDue(cloud.invoices.get('due'))).toBe(0));
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  expect(within(screen.getByRole('button', { name: /Recorded Paid/ })).getByText('₹500.00')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /Outstanding Balance/ })).getByText('₹0.00')).toBeTruthy();
});

it('opens billing from the sidebar and preserves its draft across navigation', () => {
  const { container } = render(<InvoicePage loggedInUser={dealer} />);
  const navigation = screen.getByRole('navigation', { name: 'Invoice navigation' });
  const billing = container.querySelector('.invoice-workspace__billing');
  expect(billing.hidden).toBe(true);
  fireEvent.click(within(navigation).getByRole('button', { name: 'Billing' }));
  expect(billing.hidden).toBe(false);
  fireEvent.change(screen.getByPlaceholderText('Consumer Name'), { target: { value: 'Ravi' } });
  fireEvent.click(within(navigation).getByRole('button', { name: 'Product' }));
  expect(billing.hidden).toBe(true);
  expect(screen.getByRole('heading', { name: 'Product Catalogue' })).toBeTruthy();
  fireEvent.click(within(navigation).getByRole('button', { name: 'Billing' }));
  expect(screen.getByPlaceholderText('Consumer Name').value).toBe('RAVI');
});

it('saves a consumer and transfers details into billing', { timeout: 20000 }, async () => {
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Cloud billing connected');
  fireEvent.click(screen.getByRole('button', { name: 'Add Consumer' }));
  fireEvent.change(screen.getByLabelText('Consumer Name'), { target: { value: 'Ravi' } });
  fireEvent.change(screen.getByLabelText('Consumer Number'), { target: { value: '12345' } });
  fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Consumer & Bill' }));
  await waitFor(() => expect(screen.getByPlaceholderText('Consumer Name').value).toBe('Ravi'));
  expect(JSON.parse(localStorage.getItem('cashmemoBulkCustomers_D001'))[0]).toMatchObject({ consumerNo: '12345', consumerName: 'Ravi' });
  expect(screen.getByRole('heading', { name: 'Create Invoice' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'List of Consumer' }));
  expect(screen.getByRole('heading', { name: 'Consumer List' })).toBeTruthy();
  expect(screen.getByText('12345')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
  expect(screen.getByPlaceholderText('Consumer Name').value).toBe('Ravi');
  fireEvent.click(screen.getByRole('button', { name: 'Save Invoice Record' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
  expect(screen.getByRole('heading', { name: 'Consumer Ledger' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Print Ledger' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Credit / Debit' }));
  const ledger = screen.getByRole('table', { name: 'Ledger transactions' });
  expect(within(ledger).getByRole('columnheader', { name: 'Debit' })).toBeTruthy();
  expect(within(ledger).getByRole('columnheader', { name: 'Credit' })).toBeTruthy();
});

it('disables cloud mutations when synchronization fails', async () => {
  cloud.fail = true;
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Offline — displaying cached data');
  fireEvent.click(screen.getByRole('button', { name: 'Add Consumer' }));
  expect(screen.getByRole('button', { name: 'Save Consumer & Bill' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Billing' }));
  expect(screen.getByRole('button', { name: 'Save Invoice Record' }).disabled).toBe(true);
});

it('reverses a payment with a reason and cancels while retaining statement history', { timeout: 20000 }, async () => {
  cloud.invoices.set('bill', { id: 'bill', invoiceNumber: 'INV/2026-27/00001', title: 'Ravi bill', status: 'Partial', savedAt: '2026-04-01T00:00:00Z', payments: [{ id: 'receipt', amount: 400, date: '2026-04-02', mode: 'Cash' }], header: { amount: 1000, date: '2026-04-01' }, draft: { billToName: 'Ravi', billToConsumerNo: '101', billToDate: '2026-04-01', summary: { payableTotal: 1000 } } });
  vi.spyOn(window, 'prompt').mockReturnValueOnce('Wrong receipt').mockReturnValueOnce('Duplicate invoice');
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Cloud billing connected');
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  expect(screen.getByRole('button', { name: 'Cancel Invoice' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Payment History' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reverse Payment' }));
  await screen.findByText(/Reversed: Wrong receipt/);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Invoice' }));
  await waitFor(() => expect(cloud.invoices.get('bill').status).toBe('Cancelled'));
  expect(cloud.invoices.get('bill').payments[0].amount).toBe(400);
  fireEvent.click(screen.getByRole('button', { name: 'Consumer Statement' }));
  fireEvent.change(screen.getByLabelText('Statement consumer'), { target: { value: '101' } });
  expect(screen.getByText('Payment reversal: Wrong receipt')).toBeTruthy();
  expect(screen.getByText('Invoice cancelled: Duplicate invoice')).toBeTruthy();
});

it('records a partial payment and filters generated invoices by payment status', { timeout: 20000 }, async () => {
  cloud.invoices.set('bill', { id: 'bill', invoiceNumber: 'INV/2026-27/00001', title: 'Ravi bill', status: 'Unpaid', savedAt: '2026-04-01T00:00:00Z', payments: [], header: { amount: 1000, date: '2026-04-01' }, draft: { billToName: 'Ravi', billToConsumerNo: '101', billToDate: '2026-04-01', summary: { payableTotal: 1000 } } });
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Cloud billing connected');
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '400' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Payment' }));
  await waitFor(() => expect(invoiceDue(cloud.invoices.get('bill'))).toBe(600));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Paid' } });
  expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Partial' } });
  expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Name, consumer number, mobile or invoice'), { target: { value: 'missing consumer' } });
  expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
});

it('moves consumers and invoices out of their lists into Bin and restores both', { timeout: 20000 }, async () => {
  cloud.consumers = [{ id: 'consumer1', consumerName: 'Ravi', consumerNo: '101', mobileNo: '9876543210' }];
  cloud.invoices.set('bill', { id: 'bill', invoiceNumber: 'INV/2026-27/00001', status: 'Unpaid', payments: [], draft: { billToName: 'Ravi', billToConsumerNo: '101', billToDate: '2026-09-18', summary: { payableTotal: 100 } } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<InvoicePage loggedInUser={dealer} />);
  await screen.findByText('Cloud billing connected');
  fireEvent.click(screen.getByRole('button', { name: 'List of Consumer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Modify Consumer' }));
  expect(screen.getByLabelText('Consumer Name').value).toBe('Ravi');
  fireEvent.click(screen.getByRole('button', { name: 'List of Consumer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Consumer' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Consumer' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  expect(screen.getByRole('button', { name: 'Modify Invoice' }).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete Invoice' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Invoice' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  expect(within(screen.getByRole('button', { name: /Generated Invoices/ })).getByText('0')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
  expect(screen.queryByText('Ravi')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Bin' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore Consumer' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Restore Consumer' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Restore Invoice' }));
  await screen.findByText('Bin is empty.');
  fireEvent.click(screen.getByRole('button', { name: 'Generated Invoice' }));
  expect(screen.getByRole('button', { name: 'Delete Invoice' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'List of Consumer' }));
  expect(screen.getByRole('button', { name: 'Modify Consumer' })).toBeTruthy();
});
