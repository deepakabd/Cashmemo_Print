import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areAllFilteredRowsSelected,
  buildPrintDataHtml,
  escapeHtml,
  formatPrintTableValue,
  getSelectedCustomersForPrint,
  toggleCustomerSelection,
  toggleSelectAllFiltered,
} from '../src/utils/printSelection.js';

const formatDateToDDMMYYYY = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const excelSerialDateToJSDate = (serial) => {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(excelEpoch.getTime() + (serial * 24 * 60 * 60 * 1000));
};

const parseDateString = (value) => {
  if (!value) return null;
  const [day, month, year] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
};

test('toggleCustomerSelection adds and removes a consumer id', () => {
  assert.deepEqual(toggleCustomerSelection([], '101'), ['101']);
  assert.deepEqual(toggleCustomerSelection(['101', '202'], '101'), ['202']);
});

test('toggleSelectAllFiltered selects all filtered rows across pages and preserves other selections', () => {
  const filteredData = [
    { 'Consumer No.': '101' },
    { 'Consumer No.': '102' },
    { 'Consumer No.': '103' },
    { 'Consumer No.': '104' },
  ];

  const nextSelection = toggleSelectAllFiltered(['999'], filteredData);

  assert.deepEqual(nextSelection, ['999', '101', '102', '103', '104']);
});

test('toggleSelectAllFiltered clears only filtered rows when all filtered rows are already selected', () => {
  const filteredData = [
    { 'Consumer No.': '101' },
    { 'Consumer No.': '102' },
  ];

  const nextSelection = toggleSelectAllFiltered(['999', '101', '102'], filteredData);

  assert.deepEqual(nextSelection, ['999']);
});

test('areAllFilteredRowsSelected returns true only when every filtered row is selected', () => {
  const filteredData = [
    { 'Consumer No.': '101' },
    { 'Consumer No.': '102' },
  ];

  assert.equal(areAllFilteredRowsSelected(filteredData, ['101', '102', '500']), true);
  assert.equal(areAllFilteredRowsSelected(filteredData, ['101']), false);
});

test('getSelectedCustomersForPrint returns only selected customers from filtered data', () => {
  const filteredData = [
    { 'Consumer No.': '101', name: 'A' },
    { 'Consumer No.': '102', name: 'B' },
    { 'Consumer No.': '103', name: 'C' },
  ];

  assert.deepEqual(getSelectedCustomersForPrint(filteredData, ['102', '103']), [
    { 'Consumer No.': '102', name: 'B' },
    { 'Consumer No.': '103', name: 'C' },
  ]);
});

test('escapeHtml safely escapes dangerous characters', () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script> & 'test'`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;'
  );
});

test('formatPrintTableValue normalizes payment status and dates', () => {
  const paidRow = { 'Online Refill Payment status': 'PAID' };
  const codRow = { 'Online Refill Payment status': 'pending' };
  const dateRow = { 'Order Date': '12-04-2026' };

  assert.equal(
    formatPrintTableValue(
      paidRow,
      'Online Refill Payment status',
      formatDateToDDMMYYYY,
      excelSerialDateToJSDate,
      parseDateString,
    ),
    'PAID'
  );

  assert.equal(
    formatPrintTableValue(
      codRow,
      'Online Refill Payment status',
      formatDateToDDMMYYYY,
      excelSerialDateToJSDate,
      parseDateString,
    ),
    'COD'
  );

  assert.equal(
    formatPrintTableValue(
      dateRow,
      'Order Date',
      formatDateToDDMMYYYY,
      excelSerialDateToJSDate,
      parseDateString,
    ),
    '12-04-2026'
  );
});

test('buildPrintDataHtml escapes rendered headers and cell values in print output', () => {
  const html = buildPrintDataHtml({
    visibleHeaders: ['Consumer <Name>', 'Online Refill Payment status'],
    filteredData: [
      {
        'Consumer <Name>': '<b>Alice</b>',
        'Online Refill Payment status': 'PAID',
      },
    ],
    formatDateToDDMMYYYY,
    excelSerialDateToJSDate,
    parseDateString,
  });

  assert.match(html, /Consumer &lt;Name&gt;/);
  assert.match(html, /&lt;b&gt;Alice&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
