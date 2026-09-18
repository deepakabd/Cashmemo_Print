export const parseConsumerImport = (rows) => {
  if (!rows.length || rows.length > 400) throw new Error('Upload 1–400 consumers per file.');
  const numbers = new Set();
  return rows.map((row, index) => {
    const cells = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), String(value).trim()]));
    const consumer = { consumerName: cells.consumername || cells.name || '', consumerNo: cells.consumernumber || cells.consumerno || '', mobileNo: cells.mobilenumber || cells.mobileno || cells.mobile || '', address: cells.address || '', gstin: cells.gstin || '' };
    if (!consumer.consumerName || !consumer.consumerNo || !/^\d{10}$/.test(consumer.mobileNo)) throw new Error(`Row ${index + 2}: consumer name, number and 10-digit mobile required.`);
    const key = consumer.consumerNo.toUpperCase();
    if (numbers.has(key)) throw new Error(`Row ${index + 2}: duplicate consumer number ${consumer.consumerNo}.`);
    numbers.add(key);
    return consumer;
  });
};
