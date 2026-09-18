import { expect, it } from 'vitest';
import { parseConsumerImport } from '../src/utils/consumerImport';

it('supports Excel header aliases and preserves leading zeros', () => {
  expect(parseConsumerImport([{ 'Consumer Name': ' Ravi ', 'Consumer No.': '00101', 'Mobile No.': '9876543210', Address: 'Patna' }])[0]).toMatchObject({ consumerName: 'Ravi', consumerNo: '00101', mobileNo: '9876543210' });
});
it('rejects duplicate numbers, invalid mobiles and oversized files before import', () => {
  const row = { 'Consumer Name': 'Ravi', 'Consumer Number': '001', 'Mobile Number': '9876543210' };
  expect(() => parseConsumerImport([row, row])).toThrow('duplicate');
  expect(() => parseConsumerImport([{ ...row, 'Mobile Number': '123' }])).toThrow('Row 2');
  expect(() => parseConsumerImport(Array(401).fill(row))).toThrow('400');
});
