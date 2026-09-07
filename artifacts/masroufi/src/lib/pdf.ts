import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

function safeFilename(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'masroufi-report';
}

export async function exportReportElementToPdf(element: HTMLElement, title: string): Promise<void> {
  const exportRoot = buildPdfLayout(element, title);
  document.body.appendChild(exportRoot);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(exportRoot, {
      backgroundColor: '#ffffff',
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)),
      useCORS: true,
      logging: false,
      width: 1080,
      windowWidth: 1080,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    exportRoot.remove();
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const margin = 10;
  const footerHeight = 8;
  const pageWidth = 297;
  const pageHeight = 210;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = pageHeight - margin * 2 - footerHeight;
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
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imageWidth, (sliceHeight * imageWidth) / canvas.width);
    offset += sliceHeight;
    page += 1;
  }
  const totalPages = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setDrawColor(216, 229, 224);
    pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdf.setFontSize(8);
    pdf.setTextColor(76, 101, 92);
    pdf.text(`MASROUFI  •  ${pageNumber} / ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
  pdf.save(`masroufi-${safeFilename(title)}.pdf`);
}

function buildPdfLayout(element: HTMLElement, title: string): HTMLDivElement {
  const root = document.createElement('div');
  root.dir = 'rtl';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    'width:1080px',
    'padding:32px',
    'box-sizing:border-box',
    'background:#fff',
    'color:#18332b',
    'font-family:inherit',
  ].join(';');

  const header = document.createElement('header');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding:22px 26px;border-radius:18px;background:linear-gradient(135deg,#2f8069,#1e594a);color:#fff';
  const generatedAt = new Date().toLocaleString('ar-SA');
  header.innerHTML = `<div><div style="font-size:13px;font-weight:700;opacity:.85">مصروفي · تقرير مالي</div><h1 style="margin:7px 0 0;font-size:25px;font-weight:900">${escapeHtml(title)}</h1></div><div style="font-size:12px;text-align:left;direction:rtl"><strong style="display:block;font-size:18px">مصروفي</strong><span style="opacity:.82">${escapeHtml(generatedAt)}</span></div>`;

  const content = element.cloneNode(true) as HTMLElement;
  content.querySelectorAll('[data-export-exclude]').forEach((node) => node.remove());
  content.querySelectorAll<HTMLElement>('.overflow-x-auto').forEach((node) => {
    node.style.overflow = 'visible';
  });
  content.querySelectorAll<HTMLElement>('table').forEach((table) => {
    table.style.width = '100%';
    table.style.minWidth = '0';
    table.style.fontSize = '11px';
  });
  content.querySelectorAll<HTMLElement>('section').forEach((section) => {
    section.style.breakInside = 'avoid';
  });

  root.append(header, content);
  return root;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}