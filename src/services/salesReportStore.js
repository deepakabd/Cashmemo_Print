import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import LZString from 'lz-string';
import { auth, db } from '../firebase';
import { normalizeSalesRows } from '../utils/salesDataNormalizer';
import {
  saveSalesReportToIndexedDB,
  loadSalesReportFromIndexedDB,
} from './salesReportDb';

const MAX_INLINE_CLOUD_DATA_LENGTH = 700_000;

export const DEFAULT_PRODUCT_TYPES = [
  { id: '14.2kg_domestic', name: '14.2 kg Domestic Refill', category: 'Domestic', defaultRate: 1039.00, enabled: true },
  { id: '19kg_commercial', name: '19 kg Commercial Refill', category: 'Commercial', defaultRate: 3047.00, enabled: true },
  { id: '5kg_domestic', name: '5 kg Domestic Refill', category: 'Domestic', defaultRate: 375.00, enabled: true },
  { id: '5kg_ftl', name: '5 kg FTL Cylinder', category: 'FTL', defaultRate: 550.00, enabled: true },
  { id: '47.5kg_commercial', name: '47.5 kg Commercial', category: 'Commercial', defaultRate: 7600.00, enabled: true },
  { id: '10kg_composite', name: '10 kg Composite Cylinder', category: 'Domestic', defaultRate: 745.00, enabled: true },
];

export const DEFAULT_SALES_SETTINGS = {
  uploadEnabled: true,
  allowDataReset: false, // Protected by default
  salesDateBasis: 'actualDeliveryDate', // 'actualDeliveryDate' | 'cashMemoDate' | 'orderDate'
  products: DEFAULT_PRODUCT_TYPES,
  disabledProducts: [],
  customProductRates: {},
};

// Initial real dataset matching user's exact format for September 2026
export const INITIAL_SEPTEMBER_2026_ROWS = [
  { id: 'r1', orderNo: '540414', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '608561', consumerName: 'JITIYA DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783006', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dinesh', paymentMode: 'Cash on Delivery', mobileNo: '9631903875', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-FAKIRA DASWARD-3KHARKA Kharka', amount: 1039, deliveryArea: 'Kharka - WARD - 03', ekycStatus: 'EKYC DONE' },
  { id: 'r2', orderNo: '540415', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '620270', consumerName: 'AMRITA  DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783053', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 1, deliveryStaff: 'Prashant', paymentMode: 'Cash on Delivery', mobileNo: '7835851318', dacType: 'OTP/DAC', dacVerified: true, address: 'WARD-07 WARD-07 DHAPAR BAGAHI F5131', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'EKYC DONE' },
  { id: 'r3', orderNo: '540417', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '605296', consumerName: 'CHANDRAKALA  DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1782886', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-04', quantity: 1, subsidyQty: 1, deliveryStaff: 'LALU DRIVER RUNNI AREA', paymentMode: 'Cash on Delivery', mobileNo: '6287065264', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-VIJAY THAKURWARD-08 BHANASPATTIBHANSPATTI Bhanspatti', amount: 1039, deliveryArea: 'RunniSaidpur Dakshni - WARD -08 Bhanaspatti', ekycStatus: 'EKYC DONE' },
  { id: 'r4', orderNo: '540418', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '612053', consumerName: 'BINDU DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783011', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-03', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dinesh', paymentMode: 'Cash on Delivery', mobileNo: '7484035862', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-LALBABU BAITHAWARD-8 IBRAHIMPURRAIN SHANKAR 252480', amount: 1039, deliveryArea: 'Kharka - WARD - 08 Ibrahimpur', ekycStatus: 'EKYC DONE' },
  { id: 'r5', orderNo: '540419', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '609735', consumerName: 'MR RAVINDRA RAY', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1782813', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'Sunny', paymentMode: 'Cash on Delivery', mobileNo: '7352212711', dacType: 'OTP/DAC', dacVerified: true, address: 'S/O-LAXMI RAYWARD-2VILL+PO+PS-RUNNISAIDPUR', amount: 1039, deliveryArea: 'RunniSaidpur - WARD - 02 Runnisaidpur Uttari', ekycStatus: 'EKYC DONE' },
  { id: 'r6', orderNo: '540420', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '620168', consumerName: 'SHABANAM  KHATOON', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783055', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-04', quantity: 1, subsidyQty: 1, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '9594796322', dacType: 'OTP/DAC', dacVerified: true, address: 'CO Md Manir CO Md Manir Partapur Partapur Sitamarhi Bihar- F5131', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'EKYC DONE' },
  { id: 'r7', orderNo: '992629', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '618593', consumerName: 'RANJITA DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783056', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dharmendra', paymentMode: 'Cash on Delivery', mobileNo: '7970393695', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-DASHRATH THAKUR WARD-9MURSAND MURSAND 252480', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'EKYC DONE' },
  { id: 'r8', orderNo: '540422', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '620156', consumerName: 'CHOTI  KUMARI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783057', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dharmendra', paymentMode: 'Cash on Delivery', mobileNo: '7762086283', dacType: 'OTP/DAC', dacVerified: true, address: 'CO: Pushpak Kumar Athari Sitamarhi', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'EKYC DONE' },
  { id: 'r9', orderNo: '540423', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '618785', consumerName: 'DURGA RANI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783058', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '9102442542', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-PURUSHOTTAM SINGH WARD-4RAIN SHANKAR', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'EKYC DONE' },
  { id: 'r10', orderNo: '540424', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '605233', consumerName: 'TUNI  DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1782922', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'LALU DRIVER RUNNI AREA', paymentMode: 'Cash on Delivery', mobileNo: '7654015200', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-DAYA SHANKAR DASWARD-9 BHANSAPATTI', amount: 1039, deliveryArea: 'RunniSaidpur Dakshni - WARD -09Bhanaspatti', ekycStatus: 'EKYC DONE' },
  { id: 'r11', orderNo: '992633', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '900141', consumerName: 'AWC TILAKTAJPUR BANDH KE BHITAR', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783182', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 0, deliveryStaff: 'Prashant', paymentMode: 'Cash on Delivery', mobileNo: '6201716990', dacType: 'CDCMS', dacVerified: false, address: 'TILAKTAJPUR253TILAKTAJPU', amount: 1039, deliveryArea: 'HP TILAKTAJPUR', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r12', orderNo: '192636', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900069', consumerName: 'GOVT BASIC SCHOOL MORASND', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2783068', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 2, subsidyQty: 0, deliveryStaff: 'MAHADEV HP GAS', paymentMode: 'Cash on Delivery', mobileNo: '9334738824', dacType: 'CDCMS', dacVerified: false, address: 'MORSANDMANANPURMANANPUR', amount: 6093.99, deliveryArea: 'MDM - 19 KG', ekycStatus: '' },
  { id: 'r13', orderNo: '992640', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '900602', consumerName: 'AWC RUNNISAIDPUR', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783183', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 0, deliveryStaff: 'Mani', paymentMode: 'Cash on Delivery', mobileNo: '9060459168', dacType: 'OTP/DAC', dacVerified: true, address: 'RUNNISAIDPUR153RUNNISAIDP', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r14', orderNo: '992657', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '611203', consumerName: 'SHANTI DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783204', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'Kamlesh G', paymentMode: 'Online Paid', mobileNo: '9135813156', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-SITARAM SAHBELHAI NEELKANTH', amount: 1039, deliveryArea: 'HP DHANUSHI', ekycStatus: 'EKYC DONE' },
  { id: 'r15', orderNo: '992658', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '900610', consumerName: 'AWC BHAPURA BHIMPUR UTTAR', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783228', cashMemoDate: '2026-09-01', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-01', quantity: 1, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '8207630920', dacType: 'OTP/DAC', dacVerified: true, address: 'BHAPURA BHIMPUR80 BHAPURA B', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r16', orderNo: '692668', date: '2026-09-01', orderStatus: 'Delivered', orderSource: 'E Comm App', orderType: 'Refill', consumerNo: '610671', consumerName: 'RAMKRISHNA  KUMAR', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783265', cashMemoDate: '2026-09-01', deliveryMode: 'Home', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 1, deliveryStaff: 'LALU DRIVER RUNNI AREA', paymentMode: 'Online Paid', mobileNo: '9507278217', dacType: 'OTP/DAC', dacVerified: true, address: 'S/O-ARUN JHAWARD-09Tilak tajpur', amount: 1039, deliveryArea: 'Tilaktajpur - WARD - 09', ekycStatus: 'EKYC DONE' },
  { id: 'r17', orderNo: '540923', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'IVRS', orderType: 'Refill', consumerNo: '610648', consumerName: 'Mrs. VINITA DEVI', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783450', cashMemoDate: '2026-09-02', deliveryMode: 'Home', actualDeliveryDate: '2026-09-05', quantity: 1, subsidyQty: 0, deliveryStaff: 'LALU DRIVER RUNNI AREA', paymentMode: 'Cash on Delivery', mobileNo: '9835789591', dacType: 'OTP/DAC', dacVerified: true, address: 'W//O-RAMBHU MANDALWARD-15MAHESHA FARRUKHPUR', amount: 1039, deliveryArea: 'Gurudah Urf Gausnagar - WARD - 15 Chakk RampurHari', ekycStatus: 'EKYC DONE' },
  { id: 'r18', orderNo: '992682', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '900149', consumerName: 'AWC BELAHI NIL KANTH BAZAAR TOLA', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783443', cashMemoDate: '2026-09-02', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-02', quantity: 2, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '8877202511', dacType: 'OTP/DAC', dacVerified: true, address: 'BELAHI NIL KANTH 84BELAHI NIL', amount: 2078, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r19', orderNo: '892692', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'Vitran', orderType: 'Refill', consumerNo: '900187', consumerName: 'AWC MANPUR RATNAULI', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783457', cashMemoDate: '2026-09-02', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-02', quantity: 2, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '7632987199', dacType: 'OTP/DAC', dacVerified: true, address: 'MANPUR RATNAULI 241 MANPUR RA', amount: 2078, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r20', orderNo: '992693', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '609647', consumerName: 'LALITA DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783462', cashMemoDate: '2026-09-02', deliveryMode: 'Home', actualDeliveryDate: '2026-09-09', quantity: 1, subsidyQty: 1, deliveryStaff: 'Sunny', paymentMode: 'Online Paid', mobileNo: '9525365650', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-MUKESH RAYBEDAUL ASLI BEDAUL ASLI Bedauli Asli', amount: 1039, deliveryArea: 'Bedaul Asli', ekycStatus: 'EKYC DONE' },
  { id: 'r21', orderNo: '892697', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'Vitran', orderType: 'Refill', consumerNo: '900715', consumerName: 'SDRF RUNNISAIDPUR', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'MBC', cashMemoNo: '1783506', cashMemoDate: '2026-09-02', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-02', quantity: 4, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '9798077229', dacType: 'OTP/DAC', dacVerified: true, address: 'RUNNISAIDPURSDRFSDRF', amount: 4156, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r22', orderNo: '892698', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'Vitran', orderType: 'Refill', consumerNo: '900142', consumerName: 'AWC TILAKTAJPUR  P TOLA', natureOfConsumer: '2 - Non Domestic Exempted', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783507', cashMemoDate: '2026-09-02', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-02', quantity: 1, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '9939411122', dacType: 'OTP/DAC', dacVerified: true, address: 'TILAKTAJPUR259 TILAKTAJP', amount: 1039, deliveryArea: 'Auto SV Area', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r23', orderNo: '192707', date: '2026-09-02', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900075', consumerName: 'MIDDLE SCHOOL BELAHI KANYA', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2783571', cashMemoDate: '2026-09-02', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-02', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9939787035', dacType: 'CDCMS', dacVerified: false, address: 'BELAHIBELAHIBELAHI', amount: 15235, deliveryArea: 'HP BELAHI', ekycStatus: '' },
  { id: 'r24', orderNo: '692748', date: '2026-09-04', orderStatus: 'Delivered', orderSource: 'E Comm App', orderType: 'Refill', consumerNo: '605369', consumerName: 'MUSTAKIMA  KHATOON', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1783976', cashMemoDate: '2026-09-04', deliveryMode: 'Home', actualDeliveryDate: '2026-09-09', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dinesh', paymentMode: 'Online Paid', mobileNo: '7004343019', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-ASHFAQ KHANWARD-1VILL-RAXIYA', amount: 1039, deliveryArea: 'RunniSaidpur Madhya - WARD - 01 Raksiya', ekycStatus: 'EKYC DONE' },
  { id: 'r25', orderNo: '992752', date: '2026-09-04', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '606809', consumerName: 'SAFINA  KHATOON', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1783921', cashMemoDate: '2026-09-04', deliveryMode: 'Home', actualDeliveryDate: '2026-09-04', quantity: 1, subsidyQty: 1, deliveryStaff: 'Kamlesh G', paymentMode: 'Online Paid', mobileNo: '9905115262', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-MD SAKILWARD-03BHANASPATTI', amount: 1039, deliveryArea: 'RunniSaidpur Madhya - WARD - 03 Runni', ekycStatus: 'EKYC DONE' },
  { id: 'r26', orderNo: '692760', date: '2026-09-04', orderStatus: 'Delivered', orderSource: 'E Comm App', orderType: 'Refill', consumerNo: '617315', consumerName: 'CHANDA DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1784004', cashMemoDate: '2026-09-04', deliveryMode: 'Home', actualDeliveryDate: '2026-09-08', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Raja', paymentMode: 'Online Paid', mobileNo: '7903117648', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-SHAILENDRA KUMAR JHAWARD-15 MURSAND', amount: 1039, deliveryArea: 'Morsand - WARD - 15', ekycStatus: 'EKYC DONE' },
  { id: 'r27', orderNo: '692777', date: '2026-09-04', orderStatus: 'Delivered', orderSource: 'E Comm App', orderType: 'Refill', consumerNo: '619958', consumerName: 'Mr. SANTOSH KUMAR', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1784109', cashMemoDate: '2026-09-04', deliveryMode: 'Home', actualDeliveryDate: '2026-09-06', quantity: 1, subsidyQty: 1, deliveryStaff: 'LALU BELAHI AREA', paymentMode: 'Online Paid', mobileNo: '7808984831', dacType: 'OTP/DAC', dacVerified: true, address: 'S/O-LAXMI NARAYAN SAHWARD NO:-01KHOPA', amount: 1039, deliveryArea: 'Belahi Nilkanth - WARD-01 Khopa', ekycStatus: 'EKYC DONE' },
  { id: 'r28', orderNo: '192781', date: '2026-09-04', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900027', consumerName: 'MIDDLE SCHOOL BENGAHI', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2784098', cashMemoDate: '2026-09-04', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-04', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9431209471', dacType: 'CDCMS', dacVerified: false, address: 'BENGAHIRAMNAGAR', amount: 15235, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r29', orderNo: '692793', date: '2026-09-05', orderStatus: 'Delivered', orderSource: 'E Comm App', orderType: 'Refill', consumerNo: '609439', consumerName: 'KERIYA DEVI', natureOfConsumer: '16-Scheme Ujjwala', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1784140', cashMemoDate: '2026-09-05', deliveryMode: 'Home', actualDeliveryDate: '2026-09-11', quantity: 1, subsidyQty: 1, deliveryStaff: 'LALU DRIVER RUNNI AREA', paymentMode: 'Online Paid', mobileNo: '7043885672', dacType: 'OTP/DAC', dacVerified: true, address: 'WO-BHIKARI SAHNIKUAHIKUAHI Kuahi', amount: 1039, deliveryArea: 'HP MAHESHA', ekycStatus: 'EKYC DONE' },
  { id: 'r30', orderNo: '992832', date: '2026-09-06', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '600942', consumerName: 'MALTI DEVI', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'SBC', cashMemoNo: '1784454', cashMemoDate: '2026-09-06', deliveryMode: 'Home', actualDeliveryDate: '2026-09-10', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Dinesh', paymentMode: 'Online Paid', mobileNo: '6353075020', dacType: 'OTP/DAC', dacVerified: true, address: 'W/O-BIRENDRA PRASAD SINGHWARD-5', amount: 1039, deliveryArea: 'Rain Vishuni  - WARD- 05', ekycStatus: 'EKYC DONE' },
  { id: 'r31', orderNo: '192842', date: '2026-09-06', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900075', consumerName: 'MIDDLE SCHOOL BELAHI KANYA', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2784521', cashMemoDate: '2026-09-06', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-06', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9939787035', dacType: 'CDCMS', dacVerified: false, address: 'BELAHIBELAHIBELAHI', amount: 15235, deliveryArea: 'HP BELAHI', ekycStatus: '' },
  { id: 'r32', orderNo: '192965', date: '2026-09-08', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900027', consumerName: 'MIDDLE SCHOOL BENGAHI', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2785298', cashMemoDate: '2026-09-08', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-08', quantity: 3, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9431209471', dacType: 'CDCMS', dacVerified: false, address: 'BENGAHIRAMNAGAR', amount: 9141, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r33', orderNo: '193069', date: '2026-09-09', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900026', consumerName: 'VISHAL CHAUMIN', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19KG FILLED HP GAS FLAME PLUS VOT', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'SBC', cashMemoNo: '2786008', cashMemoDate: '2026-09-09', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-09', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '-', dacType: 'CDCMS', dacVerified: false, address: 'VILL-GAURIGAMMAPO-MORSAND', amount: 15335, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r34', orderNo: '193125', date: '2026-09-10', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900028', consumerName: 'MIDDLE SCHOOL BELAHI', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2786479', cashMemoDate: '2026-09-10', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-10', quantity: 5, subsidyQty: 0, deliveryStaff: 'Jha G', paymentMode: 'Cash on Delivery', mobileNo: '9801173929', dacType: 'CDCMS', dacVerified: false, address: 'BELAHIBELAHI NILKANTH', amount: 15235, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r35', orderNo: '193168', date: '2026-09-11', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900026', consumerName: 'VISHAL CHAUMIN', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19KG FILLED HP GAS FLAME PLUS VOT', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'SBC', cashMemoNo: '2786839', cashMemoDate: '2026-09-11', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-11', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '-', dacType: 'CDCMS', dacVerified: false, address: 'VILL-GAURIGAMMAPO-MORSAND', amount: 15335, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r36', orderNo: '193265', date: '2026-09-14', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900027', consumerName: 'MIDDLE SCHOOL BENGAHI', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2787778', cashMemoDate: '2026-09-14', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-14', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9431209471', dacType: 'CDCMS', dacVerified: false, address: 'BENGAHIRAMNAGAR', amount: 15235, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r37', orderNo: '193312', date: '2026-09-16', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900075', consumerName: 'MIDDLE SCHOOL BELAHI KANYA', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2788195', cashMemoDate: '2026-09-16', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-16', quantity: 5, subsidyQty: 0, deliveryStaff: 'Kamlesh G', paymentMode: 'Cash on Delivery', mobileNo: '9939787035', dacType: 'CDCMS', dacVerified: false, address: 'BELAHIBELAHIBELAHI', amount: 15235, deliveryArea: 'HP BELAHI', ekycStatus: '' },
  { id: 'r38', orderNo: '193378', date: '2026-09-17', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900028', consumerName: 'MIDDLE SCHOOL BELAHI', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19 KG FILLED LPG CYLINDER', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'DBC', cashMemoNo: '2788643', cashMemoDate: '2026-09-17', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-17', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '9801173929', dacType: 'CDCMS', dacVerified: false, address: 'BELAHIBELAHI NILKANTH', amount: 15235, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r39', orderNo: '193473', date: '2026-09-20', orderStatus: 'Delivered', orderSource: 'Distributor', orderType: 'Refill', consumerNo: '900026', consumerName: 'VISHAL CHAUMIN', natureOfConsumer: '4 - Non Domestic Non Essential', packageCode: '19KG FILLED HP GAS FLAME PLUS VOT', productType: '19 kg Commercial Refill', category: 'Commercial', typeOfConsumer: 'SBC', cashMemoNo: '2789446', cashMemoDate: '2026-09-20', deliveryMode: 'Instant', actualDeliveryDate: '2026-09-20', quantity: 5, subsidyQty: 0, deliveryStaff: 'Alok Kumar', paymentMode: 'Cash on Delivery', mobileNo: '-', dacType: 'CDCMS', dacVerified: false, address: 'VILL-GAURIGAMMAPO-MORSAND', amount: 15335, deliveryArea: 'MDM - 19 KG', ekycStatus: 'Aadhaar Not Seeded' },
  { id: 'r40', orderNo: '992839', date: '2026-09-06', orderStatus: 'Delivered', orderSource: 'HP Pay', orderType: 'Refill', consumerNo: '600091', consumerName: 'MOHAMMAD SAMIR HUSSAIN', natureOfConsumer: '1 - Domestic', packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', productType: '14.2 kg Domestic Refill', category: 'Domestic', typeOfConsumer: 'DBC', cashMemoNo: '1784402', cashMemoDate: '2026-09-06', deliveryMode: 'Home', actualDeliveryDate: '2026-09-06', quantity: 1, subsidyQty: 1, deliveryStaff: 'DM Guddu', paymentMode: 'Online Paid', mobileNo: '8877496351', dacType: 'OTP/DAC', dacVerified: true, address: 'WARD-3NEAR TOL PLAJA NH 77VILL-RAMPUR', amount: 1039, deliveryArea: 'RunniSaidpur Dakshni - WARD -03 Shivnagar', ekycStatus: 'EKYC DONE' },
];

export const createSampleUploadRecord = () => {
  const rawRows = INITIAL_SEPTEMBER_2026_ROWS;
  const { validRows } = normalizeSalesRows(rawRows, {
    sourceFileName: 'Sales_Dump_September_2026.xlsx',
    batchId: 'batch_initial_sep_2026',
  });

  const totalCylinders = validRows.reduce((s, r) => s + (r.orderQuantity || 1), 0);
  const totalRevenue = validRows.reduce((s, r) => s + (r.salesValue || 0), 0);
  const dacCount = validRows.filter((r) => r.dacVerified).reduce((s, r) => s + (r.orderQuantity || 1), 0);
  const dacPercent = totalCylinders > 0 ? ((dacCount / totalCylinders) * 100).toFixed(1) : '0.0';

  return {
    fileName: 'Sales_Dump_September_2026.xlsx',
    fileSize: 45200,
    uploadedAt: '2026-09-20T14:30:00.000Z',
    uploadedBy: 'Distributor',
    confirmed: false,
    summary: {
      totalRows: validRows.length,
      totalCylinders,
      totalRevenue,
      dacCount,
      dacPercent: parseFloat(dacPercent),
    },
    rows: validRows,
  };
};

const getStorageKey = (user = {}) => {
  const identifier = user?.dealerCode || user?.id || user?.dealerName || 'default';
  return `cashmemoSalesReport_${String(identifier).trim().replace(/\s+/g, '_')}`;
};

export const resolveFirestoreUserDocRef = async (user = {}) => {
  const userId = user?.id ? String(user.id).trim() : '';
  const dealerCode = user?.dealerCode ? String(user.dealerCode).trim() : '';

  if (userId) {
    return doc(db, 'users', userId);
  }

  if (dealerCode) {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('dealerCode', '==', dealerCode)));
      if (snap?.docs && !snap.empty && snap.docs[0]) {
        return snap.docs[0].ref;
      }
    } catch {
      // ignore
    }
  }

  const fallbackId = userId || dealerCode || user?.dealerName || 'default';
  return doc(db, 'users', String(fallbackId).trim().replace(/\s+/g, '_'));
};

const postSalesReportApi = async (payload) => {
  if (!auth.currentUser) {
    throw new Error('Firebase sign-in required for Sales Report cloud sync.');
  }
  if (typeof window === 'undefined') {
    if (globalThis.fetch && !globalThis.fetch._isMockFunction && globalThis.fetch.name === 'fetch') {
      throw new Error('Relative URL not supported in unmocked Node fetch');
    }
  }

  let url = '/api/sales-report';
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('null')) {
    try {
      url = new URL('/api/sales-report', window.location.origin).toString();
    } catch {
      // ignore
    }
  }

  const request = async (forceRefresh = false) => {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  };

  let response = await request();
  if (response.status === 401 && auth.currentUser) {
    response = await request(true);
  }
  if (!response.ok) {
    let result = null;
    try {
      result = await response.json();
    } catch {
      // The status still gives a useful diagnostic when the proxy returns HTML.
    }
    const error = new Error(result?.error || `Sales Report API failed with HTTP ${response.status}.`);
    error.code = result?.code || `http-${response.status}`;
    throw error;
  }
  return response;
};


/**
 * Normalizes root Sales Report state object
 */
export const normalizeSalesReportData = (raw = {}) => {
  const settings = raw.settings || {};
  const isReset = raw.isReset || settings.isReset || false;
  const products = Array.isArray(settings.products) && settings.products.length > 0
    ? settings.products
    : DEFAULT_PRODUCT_TYPES;

  const monthlyUploads = raw.monthlyUploads && typeof raw.monthlyUploads === 'object'
    ? { ...raw.monthlyUploads }
    : {};

  let batches = Array.isArray(raw.batches) ? [...raw.batches] : [];
  let transactions = Array.isArray(raw.transactions)
    ? [...raw.transactions]
    : (raw.transactions && typeof raw.transactions === 'object' ? Object.values(raw.transactions) : []);

  // Ensure default initial September 2026 batch exists if brand new (and not explicitly reset)
  if (batches.length === 0 && transactions.length === 0 && !isReset) {
    const sample = createSampleUploadRecord();
    monthlyUploads['2026-09'] = sample;
    batches = [{
      batchId: 'batch_initial_sep_2026',
      fileName: 'Sales_Dump_September_2026.xlsx',
      uploadType: 'monthWise',
      fy: '2026-27',
      month: '09',
      uploadedAt: '2026-09-20T14:30:00.000Z',
      uploadedBy: 'Distributor',
      totalRows: sample.rows.length,
      importedRows: sample.rows.length,
      duplicateRows: 0,
      invalidRows: 0,
      status: 'completed',
    }];
    transactions = sample.rows;
  }

  // Auto-populate monthlyUploads[ym].rows from transactions if omitted/empty in storage
  Object.keys(monthlyUploads).forEach((ym) => {
    if (!monthlyUploads[ym].rows || monthlyUploads[ym].rows.length === 0) {
      monthlyUploads[ym].rows = transactions.filter((t) => {
        const rowYm = `${t.year}-${String(t.monthNo).padStart(2, '0')}`;
        return rowYm === ym;
      });
    }
  });

  return {
    isReset,
    updatedAt: raw.updatedAt || null,
    settings: {
      uploadEnabled: settings.uploadEnabled !== false,
      allowDataReset: settings.allowDataReset === true,
      salesDateBasis: settings.salesDateBasis || 'actualDeliveryDate',
      products,
      lockedMonths: settings.lockedMonths && typeof settings.lockedMonths === 'object' ? settings.lockedMonths : {},
    },
    monthlyUploads,
    batches,
    transactions,
  };
};

export const isSampleBatch = (batch = {}) => {
  return batch?.batchId === 'batch_initial_sep_2026' || batch?.fileName === 'Sales_Dump_September_2026.xlsx';
};

export const isSampleStore = (store = {}) => {
  if (!store) return true;
  const batches = Array.isArray(store.batches) ? store.batches : [];
  if (batches.length === 0) return true;
  return batches.every(isSampleBatch);
};


export const COMPACT_TX_FIELDS = [
  'id', 'uniqueKey', 'slNo', 'orderNo', 'orderDate', 'orderDateKey', 'orderTime',
  'orderStatus', 'orderSource', 'orderType', 'consumerNo', 'consumerName',
  'natureOfConsumer', 'packageCode', 'productType', 'category', 'typeOfConsumer',
  'cashMemoNo', 'cashMemoDate', 'cashMemoCancelDate', 'cashMemoStatus',
  'cancellationReason', 'deliveryMode', 'actualDeliveryDate', 'orderQuantity',
  'subsidyQty', 'deliveryStaff', 'onlineRefillPaymentStatus', 'ivrsBookingNumber',
  'mobileNo', 'isRegMobile', 'dacType', 'dacVerified', 'consumerAddress',
  'rawRsp', 'rsp', 'salesValue', 'deliveryArea', 'isRefillPort', 'ekycStatus',
  'paymentMode', 'salesDate', 'salesDateSource', 'dateKey', 'day', 'monthNo',
  'monthName', 'year', 'fy', 'importBatchId', 'sourceFileName',
];

/**
 * Compresses an array of transaction objects into a compact base64 string using LZString
 */
export function compressTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return '';
  const rows = transactions.map((t) => COMPACT_TX_FIELDS.map((f) => (t[f] !== undefined ? t[f] : null)));
  const json = JSON.stringify(rows);
  return LZString.compressToBase64(json);
}

/**
 * Decompresses a base64 LZString into full transaction objects
 */
export function decompressTransactions(compressedStr) {
  if (!compressedStr || typeof compressedStr !== 'string') return [];
  try {
    const decompressedJson = LZString.decompressFromBase64(compressedStr);
    if (!decompressedJson) return [];
    const rows = JSON.parse(decompressedJson);
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
      if (!Array.isArray(r) && typeof r === 'object' && r !== null) return r;
      const obj = {};
      COMPACT_TX_FIELDS.forEach((f, idx) => {
        obj[f] = r[idx] !== undefined ? r[idx] : null;
      });
      return obj;
    });
  } catch (err) {
    console.warn('Failed to decompress transactions from cloud:', err);
    return [];
  }
}

/**
 * Creates a lightweight copy of the sales data for localStorage cache,
 * stripping out redundant multi-megabyte raw transaction arrays so 5MB quota is never exceeded.
 */
export const createLightweightCacheCopy = (normalized) => {
  const lightMonthly = {};
  if (normalized.monthlyUploads) {
    Object.entries(normalized.monthlyUploads).forEach(([ym, up]) => {
      lightMonthly[ym] = {
        fileName: up.fileName,
        fileSize: up.fileSize,
        uploadedAt: up.uploadedAt,
        uploadedBy: up.uploadedBy,
        confirmed: up.confirmed,
        confirmedAt: up.confirmedAt || null,
        confirmedBy: up.confirmedBy || null,
        summary: up.summary,
        rows: [], // Omit duplicate 5000+ rows array to prevent quota explosion
      };
    });
  }

  return {
    isReset: normalized.isReset || false,
    settings: normalized.settings,
    batches: normalized.batches,
    monthlyUploads: lightMonthly,
    // Store only small sample in localStorage cache; full transactions are safely stored in IndexedDB and compressed in cloud
    transactions: normalized.transactions && normalized.transactions.length > 300
      ? normalized.transactions.slice(0, 300)
      : (normalized.transactions || []),
  };
};

/**
 * Synchronously load initial cached metadata from localStorage
 */
export const loadSalesReportData = (user) => {
  try {
    const cached = JSON.parse(localStorage.getItem(getStorageKey(user)) || '{}');
    return normalizeSalesReportData(cached);
  } catch {
    return normalizeSalesReportData({});
  }
};

/**
 * Load complete dataset from high-capacity IndexedDB, with Firestore cloud synchronization
 * Supports full multi-device synchronization by decompressing cloud transactions.
 */
export const loadSalesReportFromFirebase = async (user) => {
  const key = getStorageKey(user);

  // 1. Primary client source: Check high-capacity IndexedDB (contains all 50,000+ rows)
  let idbData = null;
  try {
    idbData = await loadSalesReportFromIndexedDB(key);
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // 2. Secondary client source: localStorage
  const localData = idbData ? normalizeSalesReportData(idbData) : loadSalesReportData(user);

  // 3. Remote Cloud source:
  if (!user) return localData;

  let remote = null;

  // Primary Path: Server API /api/sales-report (uses Firebase Admin SDK, bypasses security rules, works for Admin & Dealers)
  try {
    const resp = await postSalesReportApi({
      mode: 'load',
      userId: user?.id,
      dealerCode: user?.dealerCode,
    });
    if (resp.ok) {
      const result = await resp.json();
      if (result?.salesReportData) {
        remote = result.salesReportData;
        // monthKeys is the authoritative R2 manifest. Accept it even if an
        // older concurrent fallback temporarily rewrote storageVersion.
        if (Array.isArray(remote.monthKeys) && remote.monthKeys.length > 0) {
          const monthlyRows = [];
          for (const monthKey of remote.monthKeys) {
            const monthResponse = await postSalesReportApi({
              mode: 'loadMonth',
              userId: user?.id,
              dealerCode: user?.dealerCode,
              monthKey,
            });
            const monthResult = await monthResponse.json();
            monthlyRows.push(...decompressTransactions(monthResult.compressedData));
          }
          remote = { ...remote, transactions: monthlyRows };
        }
      }
    }
  } catch (apiErr) {
    console.warn('SalesReport server API load unreachable; falling back to direct Firestore read.', apiErr);
  }

  // Secondary Fallback: Direct Firestore getDoc
  if (!remote) {
    try {
      const targetDocRef = await resolveFirestoreUserDocRef(user);
      const snap = await getDoc(targetDocRef);
      if (snap.exists()) {
        remote = snap.data()?.salesReportData;
      }
    } catch (error) {
      console.warn('SalesReport direct Firestore read failed; using local copy.', error);
    }
  }

  if (remote) {
    // Hydrate transactions from cloud compressedData if available
    let remoteTransactions = [];
    if (remote.compressedData) {
      remoteTransactions = decompressTransactions(remote.compressedData);
    } else if (remote.compressedTransactions) {
      remoteTransactions = decompressTransactions(remote.compressedTransactions);
    } else if (Array.isArray(remote.transactions) && remote.transactions.length > 0) {
      remoteTransactions = remote.transactions;
    }

    const localTxCount = Array.isArray(localData.transactions) ? localData.transactions.length : 0;
    const remoteTxCount = remoteTransactions.length;

    const remoteHasReal = !isSampleStore(remote) && remoteTxCount > 0;
    const localHasReal = !isSampleStore(localData) && localTxCount > 0;

    let useRemoteTransactions = false;
    let shouldSyncLocalToCloud = false;

    if (remote.isReset) {
      useRemoteTransactions = true;
    } else if (localHasReal && !remoteHasReal) {
      // Local has user's real uploaded data (which may have failed earlier due to permissions),
      // while remote only has the default 40-row sample dump. DO NOT overwrite real data!
      useRemoteTransactions = false;
      shouldSyncLocalToCloud = true;
    } else if (!localHasReal && remoteHasReal) {
      // Local is empty/sample (e.g. System 2 fresh machine), remote has real uploaded data
      useRemoteTransactions = true;
    } else if (localHasReal && remoteHasReal) {
      // Both have real data. Compare updatedAt timestamps
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      const localTime = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

      if (remoteTime >= localTime) {
        useRemoteTransactions = true;
      } else {
        useRemoteTransactions = false;
        shouldSyncLocalToCloud = true;
      }
    } else {
      // Both are sample or empty
      useRemoteTransactions = remoteTxCount > 0;
    }

    if (useRemoteTransactions) {
      const merged = normalizeSalesReportData({
        ...localData,
        ...remote,
        transactions: remoteTransactions,
      });

      // Ensure each monthlyUpload has its rows populated from finalTransactions
      Object.keys(merged.monthlyUploads || {}).forEach((ym) => {
        if (!merged.monthlyUploads[ym].rows || merged.monthlyUploads[ym].rows.length === 0) {
          merged.monthlyUploads[ym].rows = merged.transactions.filter((t) => {
            const rowYm = `${t.year}-${String(t.monthNo).padStart(2, '0')}`;
            return rowYm === ym;
          });
        }
      });

      // Cache merged copy into local IndexedDB and localStorage
      await saveSalesReportToIndexedDB(key, merged);
      try {
        localStorage.setItem(key, JSON.stringify(createLightweightCacheCopy(merged)));
      } catch {
        // localStorage quota safety
      }

      return merged;
    } else {
      if (shouldSyncLocalToCloud && user) {
        // Auto-heal: push real local data to cloud
        try {
          await saveSalesReportData(user, localData);
        } catch (err) {
          console.warn('Auto-syncing real local sales data to cloud failed:', err);
        }
      }
      return localData;
    }
  }

  return idbData ? normalizeSalesReportData(idbData) : localData;
};

/**
 * Save sales report data safely using high-capacity IndexedDB,
 * with quota-safe lightweight localStorage and full compressed cloud persistence in Firestore.
 */
export const saveSalesReportData = async (user, data) => {
  const normalized = normalizeSalesReportData(data);
  const nowIso = new Date().toISOString();
  normalized.updatedAt = normalized.updatedAt || nowIso;
  const key = getStorageKey(user);

  // 1. Primary Storage: Save FULL dataset (all 5,000+ rows) into high-capacity IndexedDB
  await saveSalesReportToIndexedDB(key, normalized);

  // 2. Secondary Storage: Best-effort write lightweight metadata into localStorage (safe against 5MB quota)
  try {
    const lightCopy = createLightweightCacheCopy(normalized);
    localStorage.setItem(key, JSON.stringify(lightCopy));
  } catch (storageErr) {
    console.warn('localStorage quota exceeded; full dataset is safely stored in IndexedDB.', storageErr);
  }

  // 3. Cloud Storage: Save metadata and COMPRESSED full transactions to Firestore (safe against 1MB doc limit)
  if (!user) return true;

  const lightMonthly = {};
  if (normalized.monthlyUploads) {
    Object.entries(normalized.monthlyUploads).forEach(([ym, up]) => {
      lightMonthly[ym] = {
        fileName: up.fileName,
        fileSize: up.fileSize,
        uploadedAt: up.uploadedAt,
        uploadedBy: up.uploadedBy,
        confirmed: up.confirmed,
        confirmedAt: up.confirmedAt || null,
        confirmedBy: up.confirmedBy || null,
        summary: up.summary,
        rows: [], // Omit duplicate rows array in monthlyUploads; all rows are in compressedData
      };
    });
  }

  const compressed = compressTransactions(normalized.transactions);

  const cloudPayload = {
    isReset: normalized.isReset || false,
    settings: normalized.settings,
    batches: normalized.batches,
    monthlyUploads: lightMonthly,
    compressedData: compressed,
    updatedAt: nowIso,
  };

  // R2 stores each month independently so annual data is never sent as one
  // oversized object and a changed month does not depend on Firestore limits.
  try {
    const rowsByMonth = {};
    normalized.transactions.forEach((row) => {
      const monthKey = `${row.year}-${String(row.monthNo).padStart(2, '0')}`;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return;
      if (!rowsByMonth[monthKey]) rowsByMonth[monthKey] = [];
      rowsByMonth[monthKey].push(row);
    });
    const monthKeys = Object.keys(rowsByMonth).sort();
    for (const monthKey of monthKeys) {
      await postSalesReportApi({
        mode: 'saveMonth',
        userId: user?.id,
        dealerCode: user?.dealerCode,
        monthKey,
        compressedData: compressTransactions(rowsByMonth[monthKey]),
      });
    }
    await postSalesReportApi({
      mode: 'saveManifest',
      userId: user?.id,
      dealerCode: user?.dealerCode,
      salesReportData: {
        isReset: normalized.isReset || false,
        settings: normalized.settings,
        batches: normalized.batches,
        monthlyUploads: lightMonthly,
        storageVersion: 3,
        monthKeys,
        updatedAt: nowIso,
      },
    });
    return true;
  } catch (r2Error) {
    console.warn('SalesReport R2 sync unavailable; trying Firestore cloud storage.', r2Error);
  }

  // Primary Cloud Path: Trusted Server API (uses Firebase Admin SDK, bypasses security rules, works for Admin & Dealers)
  try {
    const resp = await postSalesReportApi({
      mode: 'save',
      userId: user?.id,
      dealerCode: user?.dealerCode,
      salesReportData: cloudPayload,
    });
    if (resp.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('SalesReport server API save unreachable; falling back to direct Firestore write.', apiErr);
  }

  // A single Firestore document has a hard 1 MiB limit. Large reports are
  // persisted by the API as chunk documents and cannot use this legacy path.
  if (compressed.length > MAX_INLINE_CLOUD_DATA_LENGTH) {
    console.warn('SalesReport cloud API did not save the chunked report; local IndexedDB copy retained.');
    return false;
  }

  // Fallback Cloud Path: Direct client Firestore write
  try {
    const targetDocRef = await resolveFirestoreUserDocRef(user);
    await setDoc(targetDocRef, {
      salesReportData: {
        ...cloudPayload,
        updatedAt: serverTimestamp(),
      },
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('SalesReport cloud write failed; local IndexedDB copy retained.', error);
    return false;
  }
};

/**
 * Import a new validated batch into the store
 */
export const importSalesBatch = async (user, currentStore, batchRecord, validRows = []) => {
  // Check if any month in the imported rows is locked
  const lockedMonths = currentStore.settings?.lockedMonths || {};
  const userRole = String(user?.role || user?.userType || '').toLowerCase();
  const isAdmin = !userRole || userRole.includes('admin') || userRole.includes('dealer') || userRole.includes('owner');

  const affectedMonths = new Set();
  validRows.forEach((r) => {
    if (r.year && r.monthNo) {
      affectedMonths.add(`${r.year}-${String(r.monthNo).padStart(2, '0')}`);
    }
  });

  const now = new Date();
  const realCurrentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allowSalesReupload = user?.userAccess?.allowSalesReupload === true;

  for (const ym of affectedMonths) {
    // Current month sales data upload MUST NEVER be locked
    const isLocked = ym !== realCurrentYm && (lockedMonths[ym]?.confirmed || currentStore.monthlyUploads?.[ym]?.confirmed);
    if (isLocked && !isAdmin && !allowSalesReupload) {
      throw new Error(`Month ${ym} is confirmed and locked. Admin approval is required to re-upload.`);
    }
  }

  const existingTx = Array.isArray(currentStore.transactions) ? currentStore.transactions : [];
  let baseTx = existingTx;

  // If user requested overwriteMonth (or re-uploading confirmed month), remove prior records for affected months
  if (batchRecord.overwriteMonth && affectedMonths.size > 0) {
    baseTx = existingTx.filter((t) => {
      const ym = `${t.year}-${String(t.monthNo).padStart(2, '0')}`;
      return !affectedMonths.has(ym);
    });
  }

  const existingKeys = new Set(baseTx.map((t) => t.uniqueKey));

  let newRows = [];
  if (batchRecord.importTarget === 'allRows') {
    // "Total Rows in File" selected: import all transactions to preserve repeat refills by the same consumer
    newRows = validRows.map((r, idx) => ({
      ...r,
      // Unique composite key per transaction record so nothing gets dropped or collided
      uniqueKey: `${r.uniqueKey}_row_${idx}`,
    }));
  } else {
    // "Valid & Ready to Import" selected: skip duplicate keys
    newRows = validRows.filter((r) => !existingKeys.has(r.uniqueKey));
  }

  const updatedTransactions = [...baseTx, ...newRows];

  const updatedBatches = [
    { ...batchRecord, importedRows: newRows.length, status: 'completed' },
    ...(Array.isArray(currentStore.batches) ? currentStore.batches : [])
  ];

  // Also update monthlyUploads grouping
  const updatedMonthlyUploads = { ...(currentStore.monthlyUploads || {}) };

  // If overwriteMonth was set, clear out the affected months in updatedMonthlyUploads
  if (batchRecord.overwriteMonth) {
    affectedMonths.forEach((ym) => {
      delete updatedMonthlyUploads[ym];
    });
  }

  const ymGroups = {};
  newRows.forEach((r) => {
    const ym = `${r.year}-${String(r.monthNo).padStart(2, '0')}`;
    if (!ymGroups[ym]) ymGroups[ym] = [];
    ymGroups[ym].push(r);
  });

  Object.entries(ymGroups).forEach(([ym, rows]) => {
    const prev = (!batchRecord.overwriteMonth && updatedMonthlyUploads[ym]?.rows) ? updatedMonthlyUploads[ym].rows : [];
    const combined = [...prev, ...rows];
    const totalCylinders = combined.reduce((s, r) => s + (r.orderQuantity || 1), 0);
    const totalRevenue = combined.reduce((s, r) => s + (r.salesValue || 0), 0);
    const dacCount = combined.filter((r) => r.dacVerified).reduce((s, r) => s + (r.orderQuantity || 1), 0);
    const dacPercent = totalCylinders > 0 ? ((dacCount / totalCylinders) * 100).toFixed(1) : '0.0';

    const wasConfirmed = updatedMonthlyUploads[ym]?.confirmed || false;

    updatedMonthlyUploads[ym] = {
      fileName: batchRecord.fileName,
      fileSize: batchRecord.fileSize || 0,
      uploadedAt: batchRecord.uploadedAt,
      uploadedBy: batchRecord.uploadedBy,
      confirmed: wasConfirmed,
      summary: {
        totalRows: combined.length,
        totalCylinders,
        totalRevenue,
        dacCount,
        dacPercent: parseFloat(dacPercent),
      },
      rows: combined,
    };
  });

  const nextStore = {
    ...currentStore,
    batches: updatedBatches,
    transactions: updatedTransactions,
    monthlyUploads: updatedMonthlyUploads,
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Rollback / Delete an entire import batch
 */
export const rollbackSalesBatch = async (user, currentStore, batchId) => {
  const existingBatches = Array.isArray(currentStore.batches) ? currentStore.batches : [];
  const updatedBatches = existingBatches.filter((b) => b.batchId !== batchId);

  const existingTx = Array.isArray(currentStore.transactions) ? currentStore.transactions : [];
  const updatedTransactions = existingTx.filter((r) => r.importBatchId !== batchId);

  // Rebuild monthlyUploads from remaining transactions
  const updatedMonthlyUploads = {};
  updatedTransactions.forEach((r) => {
    const ym = `${r.year}-${String(r.monthNo).padStart(2, '0')}`;
    if (!updatedMonthlyUploads[ym]) {
      updatedMonthlyUploads[ym] = {
        fileName: 'Aggregated Store',
        uploadedAt: new Date().toISOString(),
        rows: [],
      };
    }
    updatedMonthlyUploads[ym].rows.push(r);
  });

  Object.keys(updatedMonthlyUploads).forEach((ym) => {
    const rows = updatedMonthlyUploads[ym].rows;
    const totalCylinders = rows.reduce((s, r) => s + r.orderQuantity, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.salesValue, 0);
    const dacCount = rows.filter((r) => r.dacVerified).length;
    const dacPercent = rows.length > 0 ? ((dacCount / rows.length) * 100).toFixed(1) : '0.0';

    updatedMonthlyUploads[ym].summary = {
      totalRows: rows.length,
      totalCylinders,
      totalRevenue,
      dacCount,
      dacPercent: parseFloat(dacPercent),
    };
  });

  const nextStore = {
    ...currentStore,
    batches: updatedBatches,
    transactions: updatedTransactions,
    monthlyUploads: updatedMonthlyUploads,
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Confirm a month's data to lock it against accidental re-uploads without admin approval
 */
export const confirmMonthData = async (user, currentStore, ym, confirmedBy = 'User') => {
  const updatedMonthly = { ...(currentStore.monthlyUploads || {}) };
  if (updatedMonthly[ym]) {
    updatedMonthly[ym] = {
      ...updatedMonthly[ym],
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy,
    };
  }

  const updatedSettings = {
    ...currentStore.settings,
    lockedMonths: {
      ...(currentStore.settings?.lockedMonths || {}),
      [ym]: {
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        confirmedBy,
      },
    },
  };

  const nextStore = {
    ...currentStore,
    monthlyUploads: updatedMonthly,
    settings: updatedSettings,
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Admin unlocks a confirmed month to allow re-upload
 */
export const unlockMonthData = async (user, currentStore, ym, unlockedBy = 'Admin') => {
  const updatedMonthly = { ...(currentStore.monthlyUploads || {}) };
  if (updatedMonthly[ym]) {
    updatedMonthly[ym] = {
      ...updatedMonthly[ym],
      confirmed: false,
      unlockedAt: new Date().toISOString(),
      unlockedBy,
    };
  }

  const updatedLocked = { ...(currentStore.settings?.lockedMonths || {}) };
  delete updatedLocked[ym];

  const updatedSettings = {
    ...currentStore.settings,
    lockedMonths: updatedLocked,
  };

  const nextStore = {
    ...currentStore,
    monthlyUploads: updatedMonthly,
    settings: updatedSettings,
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Toggle product type enabled/disabled status in settings
 */
export const updateProductSettings = async (user, currentStore, products) => {
  const nextStore = {
    ...currentStore,
    settings: {
      ...currentStore.settings,
      products,
    },
  };
  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Toggle upload enabled flag
 */
export const toggleUploadStatus = async (user, currentStore, uploadEnabled) => {
  const nextStore = {
    ...currentStore,
    settings: {
      ...currentStore.settings,
      uploadEnabled,
    },
  };
  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Toggle allowDataReset setting (Enable / Disable data reset protection)
 */
export const toggleAllowDataReset = async (user, currentStore, allowDataReset) => {
  const nextStore = {
    ...currentStore,
    settings: {
      ...currentStore.settings,
      allowDataReset: Boolean(allowDataReset),
    },
  };
  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Reset / Delete uploaded sales data for a specific month (ym = 'YYYY-MM')
 */
export const resetMonthSalesData = async (user, currentStore, ym) => {
  const existingTx = Array.isArray(currentStore.transactions) ? currentStore.transactions : [];
  const updatedTransactions = existingTx.filter((r) => {
    const rowYm = `${r.year}-${String(r.monthNo).padStart(2, '0')}`;
    return rowYm !== ym;
  });

  const updatedMonthly = { ...(currentStore.monthlyUploads || {}) };
  delete updatedMonthly[ym];

  const updatedLocked = { ...(currentStore.settings?.lockedMonths || {}) };
  delete updatedLocked[ym];

  const existingBatches = Array.isArray(currentStore.batches) ? currentStore.batches : [];
  const updatedBatches = existingBatches.filter((b) => {
    const bYm = b.monthKey || b.targetMonth || (b.year && b.month ? `${b.year}-${String(b.month).padStart(2, '0')}` : null);
    return bYm !== ym;
  });

  const nextStore = {
    ...currentStore,
    isReset: updatedTransactions.length === 0,
    batches: updatedBatches,
    transactions: updatedTransactions,
    monthlyUploads: updatedMonthly,
    settings: {
      ...currentStore.settings,
      lockedMonths: updatedLocked,
    },
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};

/**
 * Reset / Delete ALL uploaded sales data across all months
 */
export const resetAllSalesData = async (user, currentStore) => {
  const nextStore = {
    ...currentStore,
    isReset: true,
    batches: [],
    transactions: [],
    monthlyUploads: {},
    settings: {
      ...currentStore.settings,
      lockedMonths: {},
    },
  };

  await saveSalesReportData(user, nextStore);
  return nextStore;
};
