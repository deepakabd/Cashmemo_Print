export const getRateMonth = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const indianMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (indianMatch) return `${indianMatch[3]}-${String(indianMatch[2]).padStart(2, '0')}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : getRateMonth(parsed);
};

export const resolveRatesForDate = (rates, date) => {
  if (!Array.isArray(rates)) return [];
  const targetDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : String(date || '').slice(0, 10);
  const legacyRates = rates.filter((rate) => !rate?.RateEffectiveFrom && !getRateMonth(rate?.RateMonth));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return legacyRates.length ? legacyRates : rates;
  const effectiveDates = [...new Set(rates.map((rate) => (
    rate?.RateEffectiveFrom || (getRateMonth(rate?.RateMonth) ? `${getRateMonth(rate.RateMonth)}-01` : '')
  )).filter((effectiveDate) => effectiveDate && effectiveDate <= targetDate))].sort();
  const effectiveDate = effectiveDates.at(-1);
  if (effectiveDate) {
    return rates.filter((rate) => (
      rate?.RateEffectiveFrom || (getRateMonth(rate?.RateMonth) ? `${getRateMonth(rate.RateMonth)}-01` : '')
    ) === effectiveDate);
  }
  return legacyRates;
};
