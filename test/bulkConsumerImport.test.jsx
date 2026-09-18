import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as XLSX from 'xlsx';
import BulkConsumerImport from '../src/components/BulkConsumerImport';
import { parseConsumerImport } from '../src/utils/consumerImport';
it('waits for Upload before reading the chosen file and importing the preview', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'Consumer Name': 'New Consumer', 'Consumer Number': '00999', 'Mobile Number': '9876543210' }]), 'Consumers');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const file = new File([buffer], 'consumers.xlsx');
  file.arrayBuffer = vi.fn(async () => buffer);
  const mutate = vi.fn(async ({ consumers }) => ({ consumers }));
  const onSaved = vi.fn();
  render(<BulkConsumerImport mutate={mutate} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('Upload consumer Excel'), { target: { files: [file] } });
  expect(file.arrayBuffer).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Import Consumers' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Upload', exact: true }));
  await screen.findByText('New Consumer');
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import Consumers' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(mutate.mock.calls[0][0]).toMatchObject({ mode: 'bulkConsumers', consumers: [{ consumerName: 'New Consumer', consumerNo: '00999' }] });
});

it('supports Excel header aliases and preserves leading zeros', () => {
  expect(parseConsumerImport([{ 'Consumer Name': ' Ravi ', 'Consumer No.': '00101', 'Mobile No.': '9876543210', Address: 'Patna' }])[0]).toMatchObject({ consumerName: 'Ravi', consumerNo: '00101', mobileNo: '9876543210' });
});
it('rejects duplicate numbers, invalid mobiles and oversized files before import', () => {
  const row = { 'Consumer Name': 'Ravi', 'Consumer Number': '001', 'Mobile Number': '9876543210' };
  expect(() => parseConsumerImport([row, row])).toThrow('duplicate');
  expect(() => parseConsumerImport([{ ...row, 'Mobile Number': '123' }])).toThrow('Row 2');
  expect(() => parseConsumerImport(Array(401).fill(row))).toThrow('400');
});
