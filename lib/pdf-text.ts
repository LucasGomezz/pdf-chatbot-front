// Extrae el texto de un PDF en el navegador. Así al backend solo viaja el texto
// (unos cientos de KB) y no el PDF entero, que en Vercel choca con el límite de
// ~4.5 MB por request.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        text += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(text);
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally {
    await pdf.destroy();
  }
}
