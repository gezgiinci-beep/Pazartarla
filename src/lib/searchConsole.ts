export type SearchConsolePeriod = 7 | 30 | 90;

export type SearchConsoleMetric = {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
};

export type SearchConsoleReport = {
  siteUrl: string;
  periodDays: SearchConsolePeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: SearchConsoleMetric & { averagePosition: number | null };
  daily: Array<SearchConsoleMetric & { date: string }>;
  queries: Array<SearchConsoleMetric & { query: string }>;
  pages: Array<SearchConsoleMetric & { page: string }>;
  countries: Array<SearchConsoleMetric & { country: string }>;
};

const isDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const isDateTime = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isMetric = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function validateMetric(value: any): value is SearchConsoleMetric {
  return value && typeof value === 'object' &&
    isMetric(value.clicks) && isMetric(value.impressions) &&
    isMetric(value.ctr) && value.ctr <= 100 &&
    isMetric(value.averagePosition);
}

export function parseSearchConsoleReport(value: unknown, expectedDays?: SearchConsolePeriod): SearchConsoleReport {
  const report = value as SearchConsoleReport;
  const validPeriod = report && [7, 30, 90].includes(report.periodDays);
  if (!report || !validPeriod || expectedDays !== undefined && report.periodDays !== expectedDays ||
      report.siteUrl !== 'https://www.pazartarla.com.tr/' ||
      !isDate(report.startDate) || !isDate(report.endDate) || !isDateTime(report.generatedAt) ||
      report.startDate > report.endDate ||
      !report.summary || typeof report.summary !== 'object' ||
      !isMetric(report.summary.clicks) || !isMetric(report.summary.impressions) ||
      !isMetric(report.summary.ctr) || report.summary.ctr > 100 ||
      !(report.summary.averagePosition === null || isMetric(report.summary.averagePosition)) ||
      !Array.isArray(report.daily) || report.daily.length !== report.periodDays ||
      !report.daily.every(row => row && isDate(row.date) && validateMetric(row)) ||
      !Array.isArray(report.queries) || report.queries.length > 10 ||
      !report.queries.every(row => row && typeof row.query === 'string' && row.query.length <= 500 && validateMetric(row)) ||
      !Array.isArray(report.pages) || report.pages.length > 10 ||
      !report.pages.every(row => row && typeof row.page === 'string' && row.page.length <= 2048 && validateMetric(row)) ||
      !Array.isArray(report.countries) || report.countries.length > 10 ||
      !report.countries.every(row => row && /^[A-Z]{3}$/.test(row.country) && validateMetric(row))) {
    throw new Error('Search Console geçerli bir rapor döndürmedi.');
  }
  return report;
}
