import { describe, expect, it } from 'vitest';
import { netCashFlow, sumHalalas } from './calculations';
import { formatAmountInput, formatHalalas, parseAmountToHalalas } from './currency';

describe('الحسابات المالية بالهللات', () => {
  it('يحسب صافي الدخل بعد المصروفات', () => {
    expect(netCashFlow(1_000_000, 325_000)).toBe(675_000);
  });

  it('يجمع مصروفات العمل والشخصية', () => {
    expect(sumHalalas([400_000, 150_000])).toBe(550_000);
  });

  it('يحسب التدفق النقدي للمشروع', () => {
    expect(netCashFlow(5_000_000, 3_275_000)).toBe(1_725_000);
  });

  it('يحافظ على الدقة المالية', () => {
    const first = parseAmountToHalalas('100.10');
    const second = parseAmountToHalalas('200.20');
    expect(first).toBe(10_010);
    expect(second).toBe(20_020);
    expect(sumHalalas([first!, second!])).toBe(30_030);
  });

  it('يحافظ على دقة 0.10 + 0.20 بالهللات', () => {
    expect(parseAmountToHalalas('0.10')).toBe(10);
    expect(parseAmountToHalalas('0.20')).toBe(20);
    expect(sumHalalas([10, 20])).toBe(30);
    expect(formatHalalas(30)).toBe('٠٫٣٠');
  });

  it('يعيد قيمة قابلة للتحرير دون أرقام عربية أو فواصل آلاف', () => {
    expect(formatAmountInput(125075)).toBe('1250.75');
    expect(parseAmountToHalalas(formatAmountInput(125075))).toBe(125075);
  });

  it('لا يعتبر قيمة العقد دخلًا مستلمًا', () => {
    const actualReceived = 4_000_000;
    const expenses = 2_500_000;
    expect(netCashFlow(actualReceived, expenses)).toBe(1_500_000);
  });
});