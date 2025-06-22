/**
 * Utility functions for date handling in KAIROS
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TradingHours {
  start: string; // Format: "HH:MM"
  end: string; // Format: "HH:MM"
  timezone: string;
}

/**
 * Checks if the current time is within trading hours
 */
export function isWithinTradingHours(
  tradingHours: TradingHours = {
    start: '09:30',
    end: '16:00',
    timezone: 'America/New_York',
  },
): boolean {
  const now = new Date();
  const nyTime = new Date(
    now.toLocaleString('en-US', { timeZone: tradingHours.timezone }),
  );

  const currentTime = nyTime.getHours() * 60 + nyTime.getMinutes();
  const startMinutes =
    parseInt(tradingHours.start.split(':')[0]) * 60 +
    parseInt(tradingHours.start.split(':')[1]);
  const endMinutes =
    parseInt(tradingHours.end.split(':')[0]) * 60 +
    parseInt(tradingHours.end.split(':')[1]);

  return currentTime >= startMinutes && currentTime <= endMinutes;
}

/**
 * Checks if the current day is a trading day (Monday-Friday)
 */
export function isTradingDay(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Gets the last trading day
 */
export function getLastTradingDay(): Date {
  const today = new Date();
  const lastTradingDay = new Date(today);

  // Go back until we find a trading day
  while (lastTradingDay.getDay() === 0 || lastTradingDay.getDay() === 6) {
    lastTradingDay.setDate(lastTradingDay.getDate() - 1);
  }

  return lastTradingDay;
}

/**
 * Gets the next trading day
 */
export function getNextTradingDay(): Date {
  const today = new Date();
  const nextTradingDay = new Date(today);

  // Go forward until we find a trading day
  while (nextTradingDay.getDay() === 0 || nextTradingDay.getDay() === 6) {
    nextTradingDay.setDate(nextTradingDay.getDate() + 1);
  }

  return nextTradingDay;
}

/**
 * Calculates the number of trading days between two dates
 */
export function getTradingDaysBetween(startDate: Date, endDate: Date): number {
  let tradingDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isTradingDay()) {
      tradingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return tradingDays;
}

/**
 * Formats a date for API requests (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parses a date string from API responses
 */
export function parseDateFromAPI(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Gets a date range for the last N days
 */
export function getDateRangeForDays(days: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return { start, end };
}

/**
 * Gets a date range for the last N trading days
 */
export function getTradingDateRangeForDays(days: number): DateRange {
  const end = getLastTradingDay();
  const start = new Date(end);

  let tradingDaysFound = 0;
  while (tradingDaysFound < days) {
    start.setDate(start.getDate() - 1);
    if (isTradingDay()) {
      tradingDaysFound++;
    }
  }

  return { start, end };
}

/**
 * Validates if a date is in the future
 */
export function isDateInFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Validates if a date is in the past
 */
export function isDateInPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Gets the start of the day (00:00:00)
 */
export function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Gets the end of the day (23:59:59)
 */
export function getEndOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Checks if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Adds business days to a date
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let businessDaysAdded = 0;

  while (businessDaysAdded < days) {
    result.setDate(result.getDate() + 1);
    if (isTradingDay()) {
      businessDaysAdded++;
    }
  }

  return result;
}

/**
 * Subtracts business days from a date
 */
export function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let businessDaysSubtracted = 0;

  while (businessDaysSubtracted < days) {
    result.setDate(result.getDate() - 1);
    if (isTradingDay()) {
      businessDaysSubtracted++;
    }
  }

  return result;
}

/**
 * Gets the current market status
 */
export function getMarketStatus():
  | 'OPEN'
  | 'CLOSED'
  | 'PRE_MARKET'
  | 'AFTER_HOURS' {
  if (!isTradingDay()) {
    return 'CLOSED';
  }

  const now = new Date();
  const nyTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  );
  const currentTime = nyTime.getHours() * 60 + nyTime.getMinutes();

  const preMarketStart = 4 * 60; // 4:00 AM
  const marketStart = 9 * 60 + 30; // 9:30 AM
  const marketEnd = 16 * 60; // 4:00 PM
  const afterHoursEnd = 20 * 60; // 8:00 PM

  if (currentTime >= preMarketStart && currentTime < marketStart) {
    return 'PRE_MARKET';
  } else if (currentTime >= marketStart && currentTime <= marketEnd) {
    return 'OPEN';
  } else if (currentTime > marketEnd && currentTime <= afterHoursEnd) {
    return 'AFTER_HOURS';
  } else {
    return 'CLOSED';
  }
}
