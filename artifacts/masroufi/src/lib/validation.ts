export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateRequiredAmount(value: string): ValidationResult {
  const normalized = value.trim().replace(/,/g, '').replace('٫', '.');
  if (!normalized) {
    return { valid: false, message: 'أدخل المبلغ أولاً.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { valid: false, message: 'أدخل مبلغًا صالحًا بحد أقصى منزلتين عشريتين.' };
  }
  return { valid: true };
}

export function validateRequiredDate(value: string): ValidationResult {
  if (!value) return { valid: false, message: 'اختر التاريخ.' };
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? { valid: false, message: 'أدخل تاريخًا صالحًا.' }
    : { valid: true };
}