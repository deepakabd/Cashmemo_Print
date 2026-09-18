export const workspaceCommands = [
  ['permanentDelete', 'Bin: Permanently Delete'],
  ['registerActions', 'Register Report: Actions'],
  ['registerModify', 'Register Report: Modify'],
  ['registerDelete', 'Register Report: Delete'],
  ['registerPaid', 'Register Report: Mark Paid'],
  ['registerUnpaid', 'Register Report: Mark Unpaid'],
  ['registerPrintBill', 'Register Report: Print Bill'],
  ['registerPrintReport', 'Register Report: Print Report'],
  ['registerRemark', 'Register Report: Remark'],
  ['productCode', 'Product: Code'],
  ['productHSN', 'Product: HSN'],
  ['productBasicPrice', 'Product: Basic Price'],
  ['productSGST', 'Product: SGST'],
  ['productCGST', 'Product: CGST'],
];
export const defaultCommands = Object.fromEntries(workspaceCommands.map(([key]) => [key, false]));
