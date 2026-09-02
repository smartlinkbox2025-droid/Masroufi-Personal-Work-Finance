import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

function safeFilename(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'masroufi-report';
}

export async function exportReportElementToPdf(element: HTMLElement, title: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
    windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const margin = 8;
  const pageWidth = 210;
  const pageHeight = 297;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = pageHeight - margin * 2;
  const sourceSliceHeight = Math.max(1, Math.floor((canvas.width * imageHeight) / imageWidth));
  let offset = 0;
  let page = 0;
  while (offset < canvas.height) {
    const sliceHeight = Math.min(sourceSliceHeight, canvas.height - offset);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز صورة التقرير');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, imageWidth, (sliceHeight * imageWidth) / canvas.width);
    offset += sliceHeight;
    page += 1;
  }
  pdf.save(`masroufi-${safeFilename(title)}.pdf`);
}