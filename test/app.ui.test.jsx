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
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  query: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
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
  await screen.findByText('Print Cashmemo');
  await screen.findByText('Page 1 of 2');
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
  it('keeps manual selections across pages and prints selected consumers only', async () => {
    seedLoggedInUser();
    const printWindow = createPrintWindow();
    window.open = vi.fn(() => printWindow);

    const { container } = render(<App />);
    await uploadCsvData(container);

    const rowPage1 = screen.getByText('Consumer 410001').closest('tr');
    fireEvent.click(within(rowPage1).getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');

    const rowPage2 = screen.getByText('Consumer 410026').closest('tr');
    fireEvent.click(within(rowPage2).getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Print Cashmemo' }));

    await waitFor(() => {
      expect(printWindow.document.write).toHaveBeenCalled();
      expect(printWindow.writtenHtml).toContain('data-consumer="410001"');
      expect(printWindow.writtenHtml).toContain('data-consumer="410026"');
      expect(printWindow.writtenHtml).not.toContain('data-consumer="410002"');
    });
  });

  it('select all carries to the next page and prints the full filtered set', async () => {
    seedLoggedInUser();
    const printWindow = createPrintWindow();
    window.open = vi.fn(() => printWindow);

    const { container } = render(<App />);
    await uploadCsvData(container);

    const allCheckboxesPage1 = screen.getAllByRole('checkbox');
    fireEvent.click(allCheckboxesPage1[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
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
    });
  });
});
