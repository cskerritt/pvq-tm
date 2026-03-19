/**
 * Shared currency / wage formatting utilities.
 *
 * All money values should flow through these helpers so formatting is
 * consistent across the UI, PDF reports, and API responses.
 *
 * Rules:
 *   - Annual amounts:  $100,000 (commas, no decimals, no abbreviations)
 *   - Hourly amounts:  $25.50/hr (two decimals)
 *   - Never use "k" or "K" abbreviations
 */

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatHourlyWage(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toFixed(2)}/hr`;
}

export function formatAnnualFromHourly(hourly: number | null | undefined): string {
  if (hourly == null) return "\u2014";
  return formatCurrency(hourly * 2080);
}
