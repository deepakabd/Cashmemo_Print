export const CASHMEMO_PAGE_TYPES = ['2 Cashmemo/Page', '3 Cashmemo/Page', '4 Cashmemo/Page'];

export const CASHMEMO_LABEL_OPTIONS = [
  { key: 'consumerName', label: 'Consumer Name', group: 'Distributor Copy' },
  { key: 'consumerNoLpgId', label: 'Consumer No / LPG ID', group: 'Distributor Copy' },
  { key: 'address', label: 'Address', group: 'Distributor Copy' },
  { key: 'mobileNo', label: 'Mobile No.', group: 'Common Details' },
  { key: 'deliveryArea', label: 'Delivery Area', group: 'Distributor Copy' },
  { key: 'deliveryStaff', label: 'Delivery Staff', group: 'Distributor Copy' },
  { key: 'productHsnQty', label: 'Product / HSN / Qty', group: 'Distributor Copy' },
  { key: 'orderNoAndDate', label: 'Order No. & Order Date', group: 'Distributor Copy' },
  { key: 'cashMemoNoAndDate', label: 'Cash Memo No. & Date', group: 'Distributor Copy' },
  { key: 'basePrice', label: 'Base Price (Rs.)', group: 'Amount Details' },
  { key: 'dlvryCharges', label: 'Dlvry Charges (Rs.)', group: 'Amount Details' },
  { key: 'cashCarryRebate', label: 'C & C Rebate (Rs.)', group: 'Amount Details' },
  { key: 'cgst', label: 'CGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'sgst', label: 'SGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'totalAmount', label: 'Total Amount (Rs.)', group: 'Amount Details' },
  { key: 'eKyc', label: 'E-KYC', group: 'Common Details' },
  { key: 'payment', label: 'Payment', group: 'Common Details' },
  { key: 'taxConsumerName', label: 'Tax Consumer Name', group: 'Tax Invoice' },
  { key: 'taxConsumerNo', label: 'Tax Consumer No.', group: 'Tax Invoice' },
  { key: 'taxLpgId', label: 'Tax LPG ID', group: 'Tax Invoice' },
  { key: 'taxAddress', label: 'Tax Address', group: 'Tax Invoice' },
  { key: 'category', label: 'Category', group: 'Tax Invoice' },
  { key: 'productHsn', label: 'Product/ HSN', group: 'Tax Invoice' },
  { key: 'connectionQty', label: 'Connection/ Qty', group: 'Tax Invoice' },
  { key: 'bookingSource', label: 'Booking Source', group: 'Tax Invoice' },
  { key: 'orderNo', label: 'Order No.', group: 'Tax Invoice' },
  { key: 'orderDate', label: 'Order Date', group: 'Tax Invoice' },
  { key: 'cashMemoNo', label: 'CashMemo No.', group: 'Tax Invoice' },
  { key: 'cashMemoDate', label: 'CashMemo Date', group: 'Tax Invoice' },
  { key: 'deliveryCharges', label: 'Delivery Charges (Rs.)', group: 'Tax Invoice' },
  { key: 'taxableAmount', label: 'Taxable Amount (Rs.)', group: 'Tax Invoice' },
  { key: 'advanceOnline', label: 'Advance (Online) (Rs.)', group: 'Tax Invoice' },
  { key: 'netPayable', label: 'Net Payable (Rs.)', group: 'Tax Invoice' },
];

export const DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE = {
  '4 Cashmemo/Page': new Set(['deliveryStaff', 'productHsnQty', 'dlvryCharges', 'cashCarryRebate', 'category', 'productHsn', 'connectionQty', 'deliveryCharges', 'taxableAmount']),
};

export const PACKAGE_OPTIONS = [
  'Premium Package - 30 Days',
  'Enterprise Package - 365 Days',
  'Enterprise Package with (हिंदी) - 365 Days',
];

export const PACKAGE_PRICING = {
  'Premium Package - 30 Days': 'Rs. 1999',
  'Enterprise Package - 365 Days': 'Rs. 4999',
  'Enterprise Package with (हिंदी) - 365 Days': 'Rs. 6999',
};

export const PAYMENT_UPI_ID = '8002074620@ybl';
export const HINDI_ENTERPRISE_PACKAGE_NAMES = ['Enterprise Package with (हिंदी) - 365 Days'];

export const DEFAULT_EXPORT_HEADERS = [
  'Consumer No.', 'Consumer Name', 'Delivery Area', 'Mobile No.', 'Order Date',
  'Cash Memo Date', 'Order Type', 'Order Status', 'Online Refill Payment status', 'EKYC Status',
];

export const SMART_SEARCH_FIELDS = ['Consumer No.', 'Consumer Name', 'Mobile No.', 'Delivery Area'];

export const HEADER_MAPPING = {
  uniqueconsumerid: 'UniqueConsumerId',
  consumerno: 'Consumer No.',
  consumername: 'Consumer Name',
  naturecode_desc: 'Consumer Nature',
  packagecode_desc: 'Consumer Package',
  consumertype: 'Consumer Type',
  orderno: 'Order No.',
  orderstatus: 'Order Status',
  orderdate: 'Order Date',
  ordersource: 'Order Source',
  ordertype: 'Order Type',
  cashmemono: 'Cash Memo No.',
  cashmemostatus: 'Cash Memo Status',
  cashmemodate: 'Cash Memo Date',
  orderquantity: 'Order Qty.',
  consumedsubsidyqty: 'Consumed Subsidy Qty',
  areaname: 'Delivery Area',
  deliveryman: 'Delivery Man',
  refillpaymentstatus: 'Online Refill Payment status',
  ivrsbookingnumber: 'IVRS Booking No.',
  mobileno: 'Mobile No.',
  mobilenumber: 'Mobile No.',
  bookingdonethroughregisteremobile: 'Is Reg Mobile',
  consumeraddress: 'Address',
  isrefillport: 'IsRefillPort',
  ekycstatus: 'EKYC Status',
};

export const ADMIN_ROLE_PERMISSIONS = {
  'super-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'active-user', 'total-user', 'create-user', 'announcements', 'recycle-bin'], mutate: true },
  'approval-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'announcements'], mutate: true },
  'support-admin': { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user', 'announcements'], mutate: true },
  viewer: { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user'], mutate: false },
};
