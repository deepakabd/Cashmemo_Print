import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockState = vi.hoisted(() => ({
  csvRows: [],
}));

vi.mock('../src/firebase.js', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  endBefore: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
  getDocsFromCache: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: vi.fn(async () => undefined),
  startAfter: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  where: vi.fn(() => ({})),
}));

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((_file, config) => {
      config.complete({ data: mockState.csvRows });
    }),
  },
}));

vi.mock('react-dom/server', () => ({
  renderToString: vi.fn((element) => {
    const customer = element?.props?.customer || {};
    return `<article data-consumer="${customer['Consumer No.'] || ''}">${customer['Consumer Name'] || ''}</article>`;
  }),
}));

vi.mock('../src/CashMemoEnglish.jsx', () => ({
  default: () => null,
}));

vi.mock('../src/CashMemoHindi.jsx', () => ({
  default: () => null,
}));

import App from '../src/App.jsx';
import { auth } from '../src/firebase.js';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { loadAdminSnapshot } from '../src/services/adminDataRepository';

vi.mock('../src/services/adminDataRepository', () => ({ loadAdminSnapshot: vi.fn() }));

const createRows = (count = 30) => Array.from({ length: count }, (_, index) => {
  const serial = 410001 + index;
  return {
    consumerno: String(serial),
    consumername: `Consumer ${serial}`,
    areaname: index < 25 ? 'Area A' : 'Area B',
    mobileno: `900000${String(serial).slice(-4)}`,
    orderdate: '12-04-2026',
    cashmemodate: '13-04-2026',
    refillpaymentstatus: index % 2 === 0 ? 'PAID' : 'UNPAID',
    ekycstatus: 'DONE',
    orderno: `ORD-${serial}`,
    cashmemono: `CM-${serial}`,
    deliveryman: `DM-${index + 1}`,
    consumeraddress: `Address ${serial}`,
    packagecode_desc: '14.2 KG',
    consumertype: 'SBC',
  };
});

const seedLoggedInUser = () => {
  localStorage.setItem('usersData', JSON.stringify([
    {
      id: 'user-1',
      dealerCode: 'D001',
      dealerName: 'Dealer One',
      validTill: '2099-12-31T00:00:00.000Z',
      status: 'active',
      approvalStatus: {},
      pendingUpdates: {},
      cashMemoLabelSettings: {},
    },
  ]));
  localStorage.setItem('cashmemoUserSession', JSON.stringify({
    id: 'user-1',
    dealerCode: 'D001',
  }));
};

const uploadCsvData = async (container, rowCount = 30) => {
  mockState.csvRows = createRows(rowCount);
  const fileInput = container.querySelector('input[type="file"]');
  expect(fileInput).toBeTruthy();
  const file = new File(['mock'], 'cashmemo.csv', { type: 'text/csv' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await screen.findByText('Print Cashmemo', {}, { timeout: 5000 });
  await screen.findByText('Page 1 of 2', {}, { timeout: 5000 });
};

const createPrintWindow = () => {
  let writtenHtml = '';
  return {
    get writtenHtml() {
      return writtenHtml;
    },
    document: {
      write: vi.fn((html) => {
        writtenHtml = html;
      }),
      close: vi.fn(),
      readyState: 'complete',
      images: [],
    },
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn(),
    scrollTo: vi.fn(),
  };
};

describe('App UI selection and print flow', () => {
  it('transitions from pending admin authentication to one stable panel load', async () => {
    auth.currentUser = null;
    let finishSignIn;
    signInWithEmailAndPassword.mockImplementationOnce(() => new Promise((resolve) => { finishSignIn = resolve; }));
    loadAdminSnapshot.mockReset().mockResolvedValue({
      snapshot: { version: 1, requests: [], users: [], approvals: [], audit: [] },
      health: { source: 'live', firebaseReachable: true, error: '' },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Admin$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Login as Admin' }));
    const email = await screen.findByPlaceholderText('Admin Email');
    fireEvent.change(email, { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'test-password' } });
    const form = email.closest('form');
    const previousCalls = signInWithEmailAndPassword.mock.calls.length;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signInWithEmailAndPassword.mock.calls.length).toBe(previousCalls + 1);
    // Firebase changes currentUser before the role check completes.
    const user = { email: 'admin@example.com', getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'admin' } }) };
    auth.currentUser = user;
    expect(screen.getByPlaceholderText('Admin Email')).toBe(email);
    expect(loadAdminSnapshot).not.toHaveBeenCalled();
    finishSignIn({ user });
    await screen.findByText('LIVE FIREBASE');
    expect(screen.queryByPlaceholderText('Admin Email')).toBeNull();
    const search = screen.getByPlaceholderText('Search current tab...');
    fireEvent.change(search, { target: { value: 'stable search' } });
    const toast = screen.getByText('Admin login successful.').closest('.toast-item');
    fireEvent.click(within(toast).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Search current tab...')).toBe(search));
    expect(search.value).toBe('stable search');
    expect(loadAdminSnapshot).toHaveBeenCalledTimes(1);
  });

  // Same async print path as the test below (two dynamic imports + 2 rendered
  // memos), so it needs the same budget when the suite runs with other workers.
  it('keeps manual selections across pages and prints selected consumers only', { timeout: 20000 }, async () => {
    seedLoggedInUser();
    const printWindow = createPrintWindow();
    window.open = vi.fn(() => printWindow);

    const { container } = render(<App />);
    await uploadCsvData(container);

    const rowPage1 = screen.getByText('Consumer 410001').closest('tr');
    fireEvent.click(within(rowPage1).getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Page 2 of 2');

    const rowPage2 = screen.getByText('Consumer 410026').closest('tr');
    fireEvent.click(within(rowPage2).getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Print Cashmemo' }));

    await waitFor(() => {
      expect(printWindow.document.write).toHaveBeenCalled();
      expect(printWindow.writtenHtml).toContain('data-consumer="410001"');
      expect(printWindow.writtenHtml).toContain('data-consumer="410026"');
      expect(printWindow.writtenHtml).not.toContain('data-consumer="410002"');
    }, { timeout: 15000 });
  });

  // Printing 30 memos goes through two dynamic imports (react-dom/server + the memo
  // template), which alone can exceed Vitest's 5s default on a cold module cache.
  it('select all carries to the next page and prints the full filtered set', async () => {
    seedLoggedInUser();
    const printWindow = createPrintWindow();
    window.open = vi.fn(() => printWindow);

    const { container } = render(<App />);
    await uploadCsvData(container);

    const allCheckboxesPage1 = screen.getAllByRole('checkbox');
    fireEvent.click(allCheckboxesPage1[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Page 2 of 2');

    const rowPage2 = screen.getByText('Consumer 410026').closest('tr');
    expect(within(rowPage2).getByRole('checkbox').checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Print Cashmemo' }));

    await waitFor(() => {
      expect(printWindow.document.write).toHaveBeenCalled();
      const matches = printWindow.writtenHtml.match(/data-consumer="/g) || [];
      expect(matches).toHaveLength(30);
      expect(printWindow.writtenHtml).toContain('data-consumer="410001"');
      expect(printWindow.writtenHtml).toContain('data-consumer="410030"');
    }, { timeout: 15000 });
  }, 20000);

  it('search filters matching consumer, mobile, name, or delivery area values', async () => {
    seedLoggedInUser();

    const { container } = render(<App />);
    await uploadCsvData(container);

    const searchInput = screen.getByPlaceholderText('Consumer, mobile, name, cash memo...');
    fireEvent.change(searchInput, { target: { value: '4100' } });

    await waitFor(() => {
      expect(screen.getByText('Consumer 410001')).toBeTruthy();
    });

    fireEvent.change(searchInput, { target: { value: '410001' } });

    await waitFor(() => {
      expect(screen.getByText('Consumer 410001')).toBeTruthy();
    });
    expect(screen.queryByText('Consumer 410002')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'consumer 410001' } });

    await waitFor(() => {
      expect(screen.getByText('Consumer 410001')).toBeTruthy();
    });
    expect(screen.queryByText('Consumer 410002')).toBeNull();

    fireEvent.change(searchInput, { target: { value: '9000000001' } });

    await waitFor(() => {
      expect(screen.getByText('Consumer 410001')).toBeTruthy();
    });
    expect(screen.queryByText('Consumer 410002')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'area b' } });

    await waitFor(() => {
      expect(screen.getByText('Consumer 410026')).toBeTruthy();
    });
    expect(screen.queryByText('Consumer 410001')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'CM-410001' } });

    await waitFor(() => {
      expect(screen.queryByText('Consumer 410001')).toBeNull();
    });
  });
});
