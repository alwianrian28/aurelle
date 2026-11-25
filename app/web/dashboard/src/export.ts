/**
 * One table, three files: PDF (a report to read or print), Excel (a formatted sheet to work
 * in) and CSV (plain data for other programs). Every list in the dashboard describes what it
 * shows as a `Report`; this module only knows how to write one out.
 */

/** How a column's values are written. Money is whole rupiah; dates are ISO strings. */
export type Kind = 'text' | 'int' | 'money' | 'datetime' | 'date';
export interface Column {
  header: string;
  kind?: Kind;
  /** Width in characters, in Excel. */
  width: number;
  /** The column that may wrap in the PDF and takes the room the others leave. The rest are
   *  as wide as their longest value, so an order number or a date never breaks in two. */
  flex?: boolean;
  /** Left out of the PDF, where the page is only so wide. Excel and CSV keep every column. */
  wide?: boolean;
}
export type Cell = string | number | null;
export interface Report {
  /** File name without extension or date, e.g. "aurelle-orders". */
  file: string;
  title: string;
  /** What is in the file, in words: "18 orders in the last 30 days". */
  subtitle: string;
  columns: Column[];
  rows: Cell[][];
  /** A last row of sums, one entry per column (null where there is nothing to add up). */
  totals?: Cell[];
}
export type Format = 'pdf' | 'xlsx' | 'csv';

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** A date-only value ("2026-11-25") is a calendar day, not midnight UTC. */
const toDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
const human = (d: Date, withTime: boolean) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${withTime ? `, ${clock(d)}` : ''}`;
const money = (n: number) => `Rp ${n.toLocaleString('en-US')}`;
const numeric = (c: Column) => c.kind === 'int' || c.kind === 'money';

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReport(report: Report, format: Format): Promise<void> {
  const name = `${report.file}-${stamp(new Date())}.${format}`;
  if (format === 'csv') save(new Blob([csv(report)], { type: 'text/csv;charset=utf-8' }), name);
  else if (format === 'xlsx') save(new Blob([xlsx(report)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  else save(await pdf(report), name);
}

/* -------------------------------------------------------------------- CSV */

/**
 * Data only, one header row: what other programs expect. Amounts are plain numbers and dates
 * are YYYY-MM-DD HH:MM in the admin's time zone, so a spreadsheet sorts both correctly. Cells
 * a spreadsheet could run as a formula are neutralised.
 */
function csv(report: Report): string {
  const value = (cell: Cell, c: Column): string => {
    if (cell === null || cell === '') return '';
    if (typeof cell === 'number') return String(cell);
    if (c.kind === 'datetime' || c.kind === 'date') { const d = toDate(cell); return c.kind === 'date' ? stamp(d) : `${stamp(d)} ${clock(d)}`; }
    return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  };
  const quote = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const header = report.columns.map((c) => quote(c.kind === 'money' ? `${c.header} (IDR)` : c.header));
  const lines = [header, ...report.rows.map((row) => row.map((cell, i) => quote(value(cell, report.columns[i]))))];
  // The byte order mark tells Excel the file is UTF-8.
  return `﻿${lines.map((line) => line.join(',')).join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------------ Excel */

/** XML allows tab, line breaks and printable characters only; a stray control character would make Excel refuse the file. */
const printable = (text: string) => Array.from(text).filter((ch) => { const c = ch.codePointAt(0)!; return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xfffe && c !== 0xffff); }).join('');
const xml = (text: string) => printable(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const letter = (index: number): string => (index < 26 ? '' : letter(Math.floor(index / 26) - 1)) + String.fromCharCode(65 + (index % 26));

// Cell formats, by their position in <cellXfs> below.
const STYLE = { head: 1, headRight: 2, int: 3, money: 4, datetime: 5, date: 6, title: 7, note: 8, sum: 9, sumInt: 10, sumMoney: 11 } as const;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0"/><numFmt numFmtId="165" formatCode="dd mmm yyyy hh:mm"/><numFmt numFmtId="166" formatCode="dd mmm yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5B6270"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECEDEF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF9AA1AB"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF9AA1AB"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="3" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * A real .xlsx workbook: title and description on top, a bold header row that stays in view
 * while scrolling and carries filter buttons, amounts as numbers shown as "Rp 1,234,567",
 * dates as dates, columns sized to their content, and the totals row in bold.
 */
function xlsx(report: Report): Uint8Array<ArrayBuffer> {
  const { columns, rows, totals } = report;
  const HEAD = 4; // title, description, a blank row, then the header
  const text = (ref: string, value: string, style = 0) => `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const number = (ref: string, value: number, style: number) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  // Excel counts days since 1900; the date is written as the admin's local wall-clock time.
  const serial = (d: Date) => (d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000 + 25_569;

  const cell = (value: Cell, c: Column, ref: string, sum: boolean): string => {
    if (value === null || value === '') return sum ? `<c r="${ref}" s="${STYLE.sum}"/>` : '';
    if (typeof value === 'number') return number(ref, value, c.kind === 'money' ? (sum ? STYLE.sumMoney : STYLE.money) : sum ? STYLE.sumInt : STYLE.int);
    if (c.kind === 'datetime' || c.kind === 'date') {
      const d = toDate(value);
      if (!Number.isNaN(d.getTime())) return number(ref, serial(d), c.kind === 'date' ? STYLE.date : STYLE.datetime);
    }
    return text(ref, value, sum ? STYLE.sum : 0);
  };
  const row = (n: number, cells: string, height?: number) => `<row r="${n}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`;

  const exported = new Date();
  const last = `${letter(columns.length - 1)}${HEAD + rows.length}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${HEAD}" topLeftCell="A${HEAD + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>
<sheetData>
${row(1, text('A1', `Aurelle · ${report.title}`, STYLE.title), 22)}
${row(2, text('A2', `${report.subtitle} · exported ${human(exported, true)}`, STYLE.note))}
${row(HEAD, columns.map((c, i) => text(`${letter(i)}${HEAD}`, c.header, numeric(c) ? STYLE.headRight : STYLE.head)).join(''), 20)}
${rows.map((r, n) => row(HEAD + 1 + n, r.map((value, i) => cell(value, columns[i], `${letter(i)}${HEAD + 1 + n}`, false)).join(''))).join('\n')}
${totals ? row(HEAD + 1 + rows.length, totals.map((value, i) => cell(value, columns[i], `${letter(i)}${HEAD + 1 + rows.length}`, true)).join(''), 20) : ''}
</sheetData>
${rows.length ? `<autoFilter ref="A${HEAD}:${last}"/>` : ''}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

  const name = xml(report.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>${rows.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$${HEAD}:$${letter(columns.length - 1)}$${HEAD + rows.length}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${name.replace(/'/g, "''")}'!$${HEAD}:$${HEAD}</definedName></definedNames>` : ''}</workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive with the files stored as they are (no compression): all an .xlsx needs. */
function zip(files: [string, string][]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const [path, content] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const crc = crc32(data);
    // Fields shared by the local header and the directory entry: version, flags (UTF-8 names), method, time, date, crc, sizes, name length, extra length.
    const common = (view: DataView, at: number) => {
      view.setUint16(at, 20, true); view.setUint16(at + 2, 0x0800, true); view.setUint16(at + 4, 0, true);
      view.setUint16(at + 6, time, true); view.setUint16(at + 8, date, true); view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, data.length, true); view.setUint32(at + 18, data.length, true); view.setUint16(at + 22, name.length, true); view.setUint16(at + 24, 0, true);
    };
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    common(lv, 4);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint16(4, 20, true);
    common(ev, 6);
    ev.setUint32(42, offset, true);
    entry.set(name, 46);
    parts.push(local, data);
    directory.push(entry);
    offset += local.length + data.length;
  }
  const size = directory.reduce((n, d) => n + d.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const part of [...parts, ...directory, end]) { out.set(part, at); at += part.length; }
  return out;
}

/* -------------------------------------------------------------------- PDF */

/** The PDF's built-in font covers Western European text; anything else would print as garbage. */
const latin = (text: string) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF–—•]/g, '?');

/**
 * A report for reading and printing: A4 (sideways when the table is wide), the store name and
 * what the report covers on top, a dark header row repeated on every page, amounts
 * right-aligned, totals at the end, and "Page x of y" with the export time at the bottom.
 * The PDF library is fetched only when a PDF is first asked for.
 */
async function pdf(report: Report): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const shown = report.columns.map((c, i) => ({ c, i })).filter(({ c }) => !c.wide);
  const doc = new jsPDF({ orientation: shown.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const MARGIN = 40;
  const INK: [number, number, number] = [21, 25, 34];
  const SOFT: [number, number, number] = [91, 98, 112];
  const exported = human(new Date(), true);

  const show = (value: Cell, c: Column): string => {
    if (value === null || value === '') return '';
    if (typeof value === 'number') return c.kind === 'money' ? money(value) : value.toLocaleString('en-US');
    if (c.kind === 'datetime' || c.kind === 'date') { const d = toDate(value); return Number.isNaN(d.getTime()) ? value : human(d, c.kind === 'datetime'); }
    return latin(value);
  };

  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...INK).setCharSpace(3.2);
  doc.text('AURELLE', MARGIN, 44);
  doc.setCharSpace(0).setFont('helvetica', 'bold').setFontSize(17);
  doc.text(latin(report.title), MARGIN, 72);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...SOFT);
  doc.text(latin(report.subtitle), MARGIN, 89);
  doc.setDrawColor(231, 232, 235).setLineWidth(0.75).line(MARGIN, 100, width - MARGIN, 100);

  // The totals are bold, so a sum can be wider than every value above it: give its column that much room.
  doc.setFont('helvetica', 'bold').setFontSize(8.5);
  const totalWidth = (i: number, c: Column) => (report.totals ? doc.getTextWidth(show(report.totals[i], c)) + 14 : 0);

  autoTable(doc, {
    startY: 112,
    margin: { left: MARGIN, right: MARGIN, top: 48, bottom: 48 },
    head: [shown.map(({ c }) => ({ content: c.header, styles: { halign: numeric(c) ? 'right' as const : 'left' as const } }))],
    body: report.rows.map((row) => shown.map(({ c, i }) => show(row[i], c))),
    foot: report.totals ? [shown.map(({ c, i }) => ({ content: show(report.totals![i], c), styles: { halign: numeric(c) ? 'right' as const : 'left' as const } }))] : undefined,
    showFoot: 'lastPage',
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, lineColor: [231, 232, 235], lineWidth: { bottom: 0.5 }, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
    footStyles: { fillColor: [236, 237, 239], fontStyle: 'bold', lineWidth: 0 },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: Object.fromEntries(shown.map(({ c, i }, n) => [n, { minCellWidth: totalWidth(i, c), cellWidth: c.flex ? 'auto' as const : 'wrap' as const, halign: numeric(c) ? 'right' as const : 'left' as const }])),
    tableWidth: shown.some(({ c }) => c.flex) ? 'auto' : 'wrap',
    rowPageBreak: 'avoid',
  });
  if (report.rows.length === 0) {
    doc.setFontSize(10).setTextColor(...SOFT);
    doc.text('Nothing to list for this selection.', MARGIN, 160);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...SOFT);
    doc.text(`Aurelle · ${latin(report.title)} · exported ${exported}`.replace(/·/g, '-'), MARGIN, height - 24);
    doc.text(`Page ${page} of ${pages}`, width - MARGIN, height - 24, { align: 'right' });
  }
  return doc.output('blob');
}
