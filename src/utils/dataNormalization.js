export const HEADER_MAPPING_LOCAL = {
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
  ivrsbookingnumber: 'IVR Booking No.',
  mobileno: 'Mobile No.',
  mobilenumber: 'Mobile No.',
  bookingdonethroughregisteremobile: 'Is Reg Mobile',
  consumeraddress: 'Address',
  isrefillport: 'IsRefillPort',
  ekycstatus: 'EKYC Status',
};

export const normalizeData = (data) => {
  return data.map(row => {
    const newRow = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const cleanedKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        const newKey = HEADER_MAPPING_LOCAL[cleanedKey] || key.trim();
        newRow[newKey] = row[key];
      }
    }
    if (!newRow['LPG ID'] && newRow.UniqueConsumerId) {
      newRow['LPG ID'] = newRow.UniqueConsumerId;
    }
    return newRow;
  });
};