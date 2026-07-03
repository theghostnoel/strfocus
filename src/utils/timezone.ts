/**
 * Helper utilities for working with Vietnam Timezone (UTC+7)
 */

export function getVNDate(date?: Date): Date {
  const d = date || new Date();
  // UTC time plus 7 hours for VN Time
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
}

export function getVNDateString(date?: Date): string {
  const vnDate = getVNDate(date);
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, "0");
  const day = String(vnDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getVNYesterdayDateString(date?: Date): string {
  const vnDate = getVNDate(date);
  vnDate.setDate(vnDate.getDate() - 1);
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, "0");
  const day = String(vnDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getVNTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  // Get current Vietnam time
  const vnNow = getVNDate();
  
  // Create midnight in Vietnam time
  const vnMidnight = new Date(vnNow);
  vnMidnight.setHours(24, 0, 0, 0); // Next midnight
  
  const diffMs = vnMidnight.getTime() - vnNow.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
}
