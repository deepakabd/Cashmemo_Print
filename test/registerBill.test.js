import { expect, it } from 'vitest';
import { registerBillHtml } from '../src/utils/registerBill';

const entry = { id: 'r1', date: '2026-09-01', name: 'SUNIL', village: 'GARGATTA', contact: '9876543210', rate14: 771, rate19: 2007, filledGoes14: 6, filledGoes19: 2, totalAmount: 8640, paidAmount: 2000, duesAmount: 6640 };
it('uses the Tax Invoice layout and splits GST out of the inclusive rate', () => {
  const html = registerBillHtml({ ...entry, filledGoes14: 1, filledGoes19: 0, rate14: 105, totalAmount: 105 }, {}, [{ Item: '14.2 KG NON-SUBSIDIZED CYLINDER', HSNCode: '27111900', SGST: 2.5, CGST: 2.5 }], { bankName: 'Sample Bank' });
  for (const text of ['Tax Invoice', 'HSN', '27111900', '100.00', '5.00', 'CGST Amt', 'SGST Amt', '2.50', 'Our Bank Details', 'Sample Bank', 'Declaration']) expect(html).toContain(text);
});
it('prints supplied products using saved rates and payments', () => {
  const html = registerBillHtml(entry, { name: 'Dealer' });
  for (const text of ['14.2KG LPG Cylinder', '19KG LPG Cylinder', '771.00', '2,007.00', '8,640.00', '6,640.00', 'SUNIL', 'Dealer']) expect(html).toContain(text);
});
it.each(['14', '19'])('prints only the supplied %s cylinder', (size) => {
  const html = registerBillHtml({ ...entry, filledGoes14: size === '14' ? 6 : 0, filledGoes19: size === '19' ? 2 : 0 });
  expect(html.includes('14.2KG LPG Cylinder')).toBe(size === '14');
  expect(html.includes('19KG LPG Cylinder')).toBe(size === '19');
});
it('escapes customer and dealer text', () => {
  const html = registerBillHtml({ ...entry, name: '<script>alert(1)</script>' }, { name: '<img onerror=alert(1)>' });
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img onerror');
  expect(html).toContain('&lt;script&gt;');
});
