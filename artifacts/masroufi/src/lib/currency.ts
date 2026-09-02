const SAR_NUMBER_FORMAT = new Intl.NumberFormat('ar-SA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseAmountToHalalas(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '').replace('٫', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [riyals, halalas = ''] = normalized.split('.');
  const amount = Number(riyals) * 100 + Number(halalas.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function formatSAR(amountHalalas: number): string {
  if (!Number.isSafeInteger(amountHalalas)) return '—';
  return `${SAR_NUMBER_FORMAT.format(amountHalalas / 100)} ر.س`;
}

export function formatHalalas(amountHalalas: number): string {
  if (!Number.isSafeInteger(amountHalalas)) return '—';
  return SAR_NUMBER_FORMAT.format(amountHalalas / 100);
}

export function formatAmountInput(amountHalalas: number): string {
  if (!Number.isSafeInteger(amountHalalas)) return '';
  const absolute = Math.abs(amountHalalas);
  const riyals = Math.floor(absolute / 100);
  const halalas = String(absolute % 100).padStart(2, '0');
  return `${amountHalalas < 0 ? '-' : ''}${riyals}.${halalas}`;
}