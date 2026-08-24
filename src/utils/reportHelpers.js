import {
  isOnlinePaidStatus,
  isEkycNotDoneStatus,
  isAadhaarNotSeededStatus,
  isRegisteredMobileRow,
  isOrderSourceCategoryMatch,
  isConsumerStatusMatch,
  isCashMemoNotGeneratedRow,
  isPendingSvRow,
} from './filterHelpers';
import { getElapsedDays, getStartOfDay } from './dateHelpers';

/**
 * Determines whether a single data row matches a named report filter key.
 *
 * @param {object} row - A single parsed data row.
 * @param {string} reportKey - The report filter key to match against.
 * @returns {boolean}
 */
export const matchesReportFilter = (row, reportKey) => {
  const ageInDays = getElapsedDays(row['Order Date']);
  const orderDate = getStartOfDay(row['Order Date']);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (reportKey) {
    case 'onlinePaid':
      return isOnlinePaidStatus(row['Online Refill Payment status']);
    case 'eKycNotDone':
      return isEkycNotDoneStatus(row['EKYC Status']);
    case 'aadhaarNotSeeded':
      return isAadhaarNotSeededStatus(row['EKYC Status']);
    case 'unregisteredNumber':
      return !isRegisteredMobileRow(row);
    case 'distributorManual':
      return isOrderSourceCategoryMatch(row['Order Source'], 'Distributor Manual');
    case 'vitranManual':
      return isOrderSourceCategoryMatch(row['Order Source'], 'Vitran Manual');
    case 'natureDomestic':
      return isConsumerStatusMatch(row['Consumer Nature'], '1 - Domestic');
    case 'natureUjjwala':
      return isConsumerStatusMatch(row['Consumer Nature'], '16-Scheme Ujjwala');
    case 'natureBpl':
      return isConsumerStatusMatch(row['Consumer Nature'], '11 - Scheme-BPL');
    case 'natureNonDomesticNonEssential':
      return isConsumerStatusMatch(row['Consumer Nature'], '4 - Non Domestic Non Essential');
    case 'natureNonDomesticExempted':
      return isConsumerStatusMatch(row['Consumer Nature'], '2 - Non Domestic Exempted');
    case 'sbcBooking':
      return isConsumerStatusMatch(row['Consumer Type'], 'SBC');
    case 'dbcBooking':
      return isConsumerStatusMatch(row['Consumer Type'], 'DBC');
    case 'pending01To02Days':
      return ageInDays !== null && ageInDays >= 1 && ageInDays <= 2;
    case 'pending02To05Days':
      return ageInDays !== null && ageInDays >= 3 && ageInDays <= 5;
    case 'pending05To10Days':
      return ageInDays !== null && ageInDays >= 6 && ageInDays <= 10;
    case 'freshPendingToday':
      return ageInDays === 0;
    case 'freshPending1To2Days':
      return ageInDays !== null && ageInDays >= 1 && ageInDays <= 2;
    case 'oldPending3To5Days':
      return ageInDays !== null && ageInDays >= 3 && ageInDays <= 5;
    case 'oldPending6To10Days':
      return ageInDays !== null && ageInDays >= 6 && ageInDays <= 10;
    case 'oldPendingAbove10Days':
      return ageInDays !== null && ageInDays > 10;
    case 'pendingDay1':
      return ageInDays === 1;
    case 'pendingDay2':
      return ageInDays === 2;
    case 'pendingDay3':
      return ageInDays === 3;
    case 'pendingDay4':
      return ageInDays === 4;
    case 'pendingDay5':
      return ageInDays === 5;
    case 'pendingDay6':
      return ageInDays === 6;
    case 'pendingDay7':
      return ageInDays === 7;
    case 'pendingDay8':
      return ageInDays === 8;
    case 'pendingDay9':
      return ageInDays === 9;
    case 'pendingDay10':
      return ageInDays === 10;
    case 'pendingAbove21Days':
      return ageInDays !== null && ageInDays > 21;
    case 'pendingAbove15Days':
      return ageInDays !== null && ageInDays > 15;
    case 'pendingAbove10Days':
      return ageInDays !== null && ageInDays > 10;
    case 'pendingAbove7Days':
      return ageInDays !== null && ageInDays > 7;
    case 'pendingAbove5Days':
      return ageInDays !== null && ageInDays > 5;
    case 'pendingAbove3Days':
      return ageInDays !== null && ageInDays > 3;
    case 'todayBooking':
      return orderDate && orderDate.getTime() === today.getTime();
    case 'cashMemoNotGenerated':
      return isCashMemoNotGeneratedRow(row);
    case 'pendingSv':
      return isPendingSvRow(row);
    default:
      return true;
  }
};

/**
 * Builds a comprehensive booking report from a set of data rows.
 *
 * @param {Array<object>} rows - The data rows to analyze.
 * @param {Date} [now] - Optional reference date (defaults to current time).
 * @returns {{ metrics: object, topPendingAreas: Array<object> }}
 */
export const buildBookingReport = (rows, now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const metrics = {
    totalPendingBooking: rows.length,
    onlinePaid: 0,
    eKycNotDone: 0,
    aadhaarNotSeeded: 0,
    unregisteredNumber: 0,
    distributorManual: 0,
    vitranManual: 0,
    natureDomestic: 0,
    natureUjjwala: 0,
    natureBpl: 0,
    natureNonDomesticNonEssential: 0,
    natureNonDomesticExempted: 0,
    sbcBooking: 0,
    dbcBooking: 0,
    cashMemoNotGenerated: 0,
    freshPendingToday: 0,
    freshPending1To2Days: 0,
    oldPending3To5Days: 0,
    oldPending6To10Days: 0,
    oldPendingAbove10Days: 0,
    pending01To02Days: 0,
    pending02To05Days: 0,
    pending05To10Days: 0,
    pendingDay1: 0,
    pendingDay2: 0,
    pendingDay3: 0,
    pendingDay4: 0,
    pendingDay5: 0,
    pendingDay6: 0,
    pendingDay7: 0,
    pendingDay8: 0,
    pendingDay9: 0,
    pendingDay10: 0,
    pendingAbove21Days: 0,
    pendingAbove15Days: 0,
    pendingAbove10Days: 0,
    pendingAbove7Days: 0,
    pendingAbove5Days: 0,
    pendingAbove3Days: 0,
    todayBooking: 0,
    pendingSv: 0,
  };

  const areaPendingCounts = new Map();

  rows.forEach((row) => {
    const ageInDays = getElapsedDays(row['Order Date'], now);
    const orderDate = getStartOfDay(row['Order Date']);
    const deliveryArea = String(row['Delivery Area'] || '').trim();

    if (deliveryArea) {
      areaPendingCounts.set(deliveryArea, (areaPendingCounts.get(deliveryArea) || 0) + 1);
    }

    if (isOnlinePaidStatus(row['Online Refill Payment status'])) {
      metrics.onlinePaid += 1;
    }

    if (isEkycNotDoneStatus(row['EKYC Status'])) {
      metrics.eKycNotDone += 1;
    }

    if (isAadhaarNotSeededStatus(row['EKYC Status'])) {
      metrics.aadhaarNotSeeded += 1;
    }

    if (!isRegisteredMobileRow(row)) {
      metrics.unregisteredNumber += 1;
    }

    if (isOrderSourceCategoryMatch(row['Order Source'], 'Distributor Manual')) {
      metrics.distributorManual += 1;
    }

    if (isOrderSourceCategoryMatch(row['Order Source'], 'Vitran Manual')) {
      metrics.vitranManual += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Nature'], '1 - Domestic')) {
      metrics.natureDomestic += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Nature'], '16-Scheme Ujjwala')) {
      metrics.natureUjjwala += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Nature'], '11 - Scheme-BPL')) {
      metrics.natureBpl += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Nature'], '4 - Non Domestic Non Essential')) {
      metrics.natureNonDomesticNonEssential += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Nature'], '2 - Non Domestic Exempted')) {
      metrics.natureNonDomesticExempted += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Type'], 'SBC')) {
      metrics.sbcBooking += 1;
    }

    if (isConsumerStatusMatch(row['Consumer Type'], 'DBC')) {
      metrics.dbcBooking += 1;
    }

    if (isCashMemoNotGeneratedRow(row)) {
      metrics.cashMemoNotGenerated += 1;
    }

    if (ageInDays !== null) {
      if (ageInDays === 0) metrics.freshPendingToday += 1;
      if (ageInDays >= 1 && ageInDays <= 2) metrics.freshPending1To2Days += 1;
      if (ageInDays >= 3 && ageInDays <= 5) metrics.oldPending3To5Days += 1;
      if (ageInDays >= 6 && ageInDays <= 10) metrics.oldPending6To10Days += 1;
      if (ageInDays > 10) metrics.oldPendingAbove10Days += 1;
      if (ageInDays >= 1 && ageInDays <= 2) metrics.pending01To02Days += 1;
      if (ageInDays >= 3 && ageInDays <= 5) metrics.pending02To05Days += 1;
      if (ageInDays >= 6 && ageInDays <= 10) metrics.pending05To10Days += 1;
      if (ageInDays === 1) metrics.pendingDay1 += 1;
      if (ageInDays === 2) metrics.pendingDay2 += 1;
      if (ageInDays === 3) metrics.pendingDay3 += 1;
      if (ageInDays === 4) metrics.pendingDay4 += 1;
      if (ageInDays === 5) metrics.pendingDay5 += 1;
      if (ageInDays === 6) metrics.pendingDay6 += 1;
      if (ageInDays === 7) metrics.pendingDay7 += 1;
      if (ageInDays === 8) metrics.pendingDay8 += 1;
      if (ageInDays === 9) metrics.pendingDay9 += 1;
      if (ageInDays === 10) metrics.pendingDay10 += 1;
      if (ageInDays > 21) metrics.pendingAbove21Days += 1;
      if (ageInDays > 15) metrics.pendingAbove15Days += 1;
      if (ageInDays > 10) metrics.pendingAbove10Days += 1;
      if (ageInDays > 7) metrics.pendingAbove7Days += 1;
      if (ageInDays > 5) metrics.pendingAbove5Days += 1;
      if (ageInDays > 3) metrics.pendingAbove3Days += 1;
    }

    if (isPendingSvRow(row)) {
      metrics.pendingSv += 1;
    }

    if (orderDate) {
      if (orderDate.getTime() === today.getTime()) {
        metrics.todayBooking += 1;
      }
    }
  });

  const topPendingAreas = [...areaPendingCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true });
    })
    .slice(0, 3)
    .map(([areaName, value], index) => ({
      key: `highestPb${index + 1}`,
      label: `Highest PB ${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}`,
      areaName,
      value,
    }));

  return { metrics, topPendingAreas };
};
