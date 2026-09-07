import { UniversalDocument, BlockType } from '../types';

export function exportLocalDocument(doc: UniversalDocument, format: 'txt' | 'csv' | 'pdf' | 'docx') {
  const safeTitle = (doc.title || 'dokument').replace(/[^a-zA-Z0-9_\-\u0400-\u04FF\u0100-\u017F]/g, '_');

  if (format === 'txt') {
    let txt = `${doc.title}\n${'='.repeat(doc.title.length || 10)}\n\n`;
    for (const b of doc.blocks) {
      if (b.type === 'title') txt += `\n# ${b.content}\n\n`;
      else if (b.type === 'heading') txt += `\n## ${b.content}\n\n`;
      else if (b.type === 'list_item') txt += `• ${b.content}\n`;
      else if (b.type === 'field') txt += `${b.key || ''}: ${b.value || b.content}\n`;
      else if (b.type === 'table') {
        if (b.headers) txt += b.headers.join('\t') + '\n' + '-'.repeat(30) + '\n';
        if (b.rows) b.rows.forEach(r => txt += r.join('\t') + '\n');
      } else {
        txt += `${b.content}\n\n`;
      }
    }
    downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${safeTitle}.txt`);
  } else if (format === 'csv') {
    let csv = '';
    let foundTable = false;
    for (const b of doc.blocks) {
      if (b.type === 'table') {
        foundTable = true;
        if (b.headers) csv += b.headers.map(escapeCsv).join(',') + '\n';
        if (b.rows) b.rows.forEach(r => csv += r.map(escapeCsv).join(',') + '\n');
      } else if (b.type === 'field') {
        csv += `${escapeCsv(b.key || '')},${escapeCsv(b.value || b.content || '')}\n`;
      }
    }
    if (!foundTable) {
      for (const b of doc.blocks) {
        csv += `${escapeCsv(b.type)},${escapeCsv(b.content)}\n`;
      }
    }
    downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${safeTitle}.csv`);
  } else if (format === 'pdf' || format === 'docx') {
    // Generiši formatiran HTML dokument i pokreni print/save dijalog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let bodyContent = `<h1>${doc.title}</h1>`;
      for (const b of doc.blocks) {
        if (b.type === 'title') bodyContent += `<h2>${escapeHtml(b.content)}</h2>`;
        else if (b.type === 'heading') bodyContent += `<h3>${escapeHtml(b.content)}</h3>`;
        else if (b.type === 'list_item') bodyContent += `<li>${escapeHtml(b.content)}</li>`;
        else if (b.type === 'field') bodyContent += `<p><strong>${escapeHtml(b.key || '')}:</strong> ${escapeHtml(b.value || b.content)}</p>`;
        else if (b.type === 'table') {
          bodyContent += '<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;margin:12px 0;">';
          if (b.headers) bodyContent += '<tr>' + b.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
          if (b.rows) b.rows.forEach(r => bodyContent += '<tr>' + r.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>');
          bodyContent += '</table>';
        } else {
          bodyContent += `<p>${escapeHtml(b.content)}</p>`;
        }
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(doc.title)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            h1 { font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
            h2 { font-size: 18px; color: #1e293b; margin-top: 20px; }
            h3 { font-size: 15px; color: #334155; margin-top: 14px; }
            table { border-color: #cbd5e1; }
            th { background-color: #f1f5f9; text-align: left; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${bodyContent}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  }
}

function escapeCsv(str: string): string {
  if (str == null) return '';
  const s = String(str).replace(/"/g, '""');
  return `"${s}"`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
