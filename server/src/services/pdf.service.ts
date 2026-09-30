import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import type { Cv, Education, Experience, Skill } from '../types/cv.js';
import { logger } from '../utils/logger.js';

const PAGE = {
  size: 'A4' as const,
  margins: { top: 56, bottom: 64, left: 56, right: 56 },
};

const COLORS = {
  text: '#1b1f24',
  muted: '#5b6570',
  accent: '#1f5f8b',
  rule: '#d5dbe1',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
};

const CONTENT_WIDTH =
  PAGE.size === 'A4' ? 595.28 - PAGE.margins.left - PAGE.margins.right : 0;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatRange(start: string | null, end: string | null, isCurrent = false): string {
  const render = (value: string | null): string => {
    if (!value) return 'Present';
    const [year, month] = value.split('-');
    const monthName = MONTHS[Number(month) - 1];
    return monthName ? `${monthName} ${year}` : year ?? '';
  };

  if (!start && !end) return '';
  if (isCurrent || !end) return `${render(start)} - Present`;
  return `${render(start)} - ${render(end)}`;
}

export function toFileName(fullName: string): string {
  const base = fullName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || 'cv'}.pdf`;
}

type PdfDocument = InstanceType<typeof PDFDocument>;

/** Subset of PDFKit text options used for measuring text. */
type MeasureOptions = {
  font?: string;
  fontSize?: number;
  width?: number;
  lineGap?: number;
};

class PdfWriter {
  private readonly doc: PdfDocument;
  private pages: number;

  constructor() {
    this.doc = new PDFDocument({
      size: PAGE.size,
      margins: PAGE.margins,
      bufferPages: true,
      info: { Title: 'Curriculum Vitae', Author: 'CV Generator', Creator: 'CV Generator' },
    });
    this.pages = 1;
    this.doc.on('pageAdded', () => {
      this.pages += 1;
    });
  }

  get stream(): PdfDocument {
    return this.doc;
  }

  get pageCount(): number {
    return this.pages;
  }

  get contentWidth(): number {
    return this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
  }

  get cursorY(): number {
    return this.doc.y;
  }

  measureWidth(text: string, options: MeasureOptions = {}): number {
    return this.doc.widthOfString(text, { width: this.contentWidth, ...options });
  }

  spaceNeeded(height: number): boolean {
    const bottomLimit = this.doc.page.height - this.doc.page.margins.bottom;
    return this.doc.y + height > bottomLimit;
  }

  addPageIfNeeded(height: number): void {
    if (this.spaceNeeded(height)) this.doc.addPage();
  }

  sectionHeading(label: string): void {
    this.addPageIfNeeded(46);
    this.doc.moveDown(0.9);
    this.doc
      .font(FONTS.bold)
      .fontSize(11.5)
      .fillColor(COLORS.accent)
      .text(label.toUpperCase(), { width: this.contentWidth, characterSpacing: 1.1 });
    const ruleY = this.doc.y + 4;
    this.doc
      .moveTo(this.doc.page.margins.left, ruleY)
      .lineTo(this.doc.page.width - this.doc.page.margins.right, ruleY)
      .lineWidth(0.8)
      .strokeColor(COLORS.rule)
      .stroke();
    this.doc.y = ruleY + 10;
  }

  entryHeading(leftText: string, rightText: string): void {
    const boldSize = 10.5;
    const regularSize = 9.5;

    const leftWidth = this.measureWidth(leftText, { font: FONTS.bold, fontSize: boldSize });
    const rightWidth = this.measureWidth(rightText, { font: FONTS.regular, fontSize: regularSize });
    const available = this.contentWidth;

    if (leftWidth + rightWidth + 18 <= available) {
      const startY = this.doc.y;
      const rightY = startY + 1.2;

      this.doc
        .font(FONTS.bold)
        .fontSize(boldSize)
        .fillColor(COLORS.text)
        .text(leftText, this.doc.page.margins.left, startY, { width: available - rightWidth - 18, lineBreak: false });

      this.doc
        .font(FONTS.regular)
        .fontSize(regularSize)
        .fillColor(COLORS.muted)
        .text(rightText, this.doc.page.margins.left, rightY, { width: available, align: 'right', lineBreak: false });

      this.doc.y = Math.max(this.doc.y, startY + boldSize + 2.5);
      return;
    }

    this.doc.font(FONTS.bold).fontSize(boldSize).fillColor(COLORS.text).text(leftText);
    this.doc
      .font(FONTS.regular)
      .fontSize(regularSize)
      .fillColor(COLORS.muted)
      .text(rightText, { align: 'right' });
    this.doc.moveDown(0.15);
  }

  entrySubLine(text: string): void {
    this.doc
      .font(FONTS.oblique)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(text);
  }

  body(text: string, options: PDFKit.Mixins.TextOptions = {}): void {
    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(text, { align: 'left', lineGap: 1.6, ...options });
  }

  bullets(lines: string[]): void {
    const indent = 10;
    for (const line of lines) {
      const height = this.doc.heightOfString(line, { width: this.contentWidth - indent, lineGap: 1.6 });
      this.addPageIfNeeded(height + 3);

      const startY = this.doc.y;
      this.doc
        .circle(this.doc.page.margins.left + 2.5, startY + 4.6, 1.6)
        .fillColor(COLORS.muted)
        .fill();
      this.doc
        .font(FONTS.regular)
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(line, this.doc.page.margins.left + indent, startY, {
          width: this.contentWidth - indent,
          lineGap: 1.6,
        });
      this.doc.y = startY + height + 1;
    }
  }

  /**
   * Renders one "Category: value" row, reserving a shared label column so
   * multiple categories stay aligned and the value never overlaps the label.
   */
  categoryRow(label: string, value: string, labelWidth: number): void {
    const gap = 12;
    const valueWidth = this.contentWidth - labelWidth - gap;
    const valueHeight = this.doc.heightOfString(value, { width: valueWidth, lineGap: 1.4 });
    this.addPageIfNeeded(valueHeight + 4);

    const y = this.doc.y;
    const left = this.doc.page.margins.left;

    this.doc
      .font(FONTS.bold)
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(label, left, y, { width: labelWidth, lineBreak: false });

    this.doc
      .font(FONTS.regular)
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(value, left + labelWidth + gap, y, { width: valueWidth, lineGap: 1.4 });

    this.doc.y = Math.max(this.doc.y, y + valueHeight) + 3;
  }

  space(amount: number): void {
    this.doc.y += amount;
  }

  header(cv: Cv): void {
    const { personal } = cv;
    this.doc.font(FONTS.bold).fontSize(22).fillColor(COLORS.text).text(personal.fullName);

    if (personal.headline) {
      this.doc
        .font(FONTS.regular)
        .fontSize(11.5)
        .fillColor(COLORS.accent)
        .text(personal.headline);
    }

    const contact = [personal.email, personal.phone, personal.location]
      .filter((value): value is string => Boolean(value))
      .join('  |  ');

    if (contact) {
      this.doc.font(FONTS.regular).fontSize(9.5).fillColor(COLORS.muted).text(contact);
    }

    const ruleY = this.doc.y + 8;
    this.doc
      .moveTo(this.doc.page.margins.left, ruleY)
      .lineTo(this.doc.page.width - this.doc.page.margins.right, ruleY)
      .lineWidth(1.4)
      .strokeColor(COLORS.accent)
      .stroke();
    this.doc.y = ruleY + 12;
  }

  private drawFooters(): void {
    const range = this.doc.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      this.doc.switchToPage(index);

      // The footer sits below the normal bottom margin, so the margin is
      // collapsed for the duration of the write. Without this, PDFKit treats
      // the footer as overflow and appends a spurious extra page.
      const bottomMargin = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;

      const y = this.doc.page.height - bottomMargin + 22;
      this.doc
        .moveTo(this.doc.page.margins.left, y - 12)
        .lineTo(this.doc.page.width - this.doc.page.margins.right, y - 12)
        .lineWidth(0.6)
        .strokeColor(COLORS.rule)
        .stroke();

      this.doc
        .font(FONTS.regular)
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(`Page ${index - range.start + 1} of ${range.count}`, this.doc.page.margins.left, y, {
          width: this.contentWidth,
          align: 'center',
          lineBreak: false,
        });

      this.doc.page.margins.bottom = bottomMargin;
    }
  }

  async finalise(cv: Cv): Promise<Buffer> {
    this.drawFooters();
    this.doc.end();

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', resolve);
      this.doc.on('error', reject);
    });

    logger.debug(`Rendered PDF for CV ${cv.id} (${this.pageCount} pages)`);
    return Buffer.concat(chunks);
  }
}

function renderExperience(writer: PdfWriter, experience: Experience): void {
  const heading = experience.company ? `${experience.jobTitle} — ${experience.company}` : experience.jobTitle;
  const range = formatRange(experience.startDate, experience.endDate, experience.isCurrent);
  const title = experience.location ? `${heading} · ${experience.location}` : heading;

  writer.addPageIfNeeded(34);
  writer.entryHeading(title, range);

  if (experience.description) {
    const lines = experience.description
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
      .filter((line) => line.length > 0);

    if (lines.length > 1) {
      writer.bullets(lines);
    } else {
      writer.body(lines[0] ?? experience.description);
    }
  }

  writer.space(5);
}

function renderEducation(writer: PdfWriter, entry: Education): void {
  const degree = [entry.degree, entry.fieldOfStudy].filter(Boolean).join(', ');
  const heading = degree ? `${degree} — ${entry.institution}` : entry.institution;
  const range = formatRange(entry.startDate, entry.endDate);

  writer.addPageIfNeeded(30);
  writer.entryHeading(heading, range);

  const details = [entry.grade ? `Grade: ${entry.grade}` : null].filter(
    (value): value is string => Boolean(value),
  );

  if (details.length > 0) writer.entrySubLine(details.join('  |  '));
  if (entry.description) writer.body(entry.description);

  writer.space(5);
}

function renderSkills(writer: PdfWriter, skills: Skill[]): void {
  const grouped = new Map<string, Skill[]>();
  for (const skill of skills) {
    const key = skill.category?.trim() || 'Skills';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(skill);
    else grouped.set(key, [skill]);
  }

  const labelWidth = Math.max(
    ...[...grouped.keys()].map((key) =>
      writer.measureWidth(key, { font: FONTS.bold, fontSize: 9.5 }),
    ),
  );

  for (const [category, items] of grouped) {
    const value = items
      .map((skill) => (skill.proficiency ? `${skill.name} (${skill.proficiency}/5)` : skill.name))
      .join(', ');
    writer.categoryRow(category, value, labelWidth);
  }
}

export function renderCvPdf(cv: Cv): Promise<Buffer> {
  const writer = new PdfWriter();
  const { personal } = cv;

  writer.header(cv);

  writer.sectionHeading('Professional Summary');
  writer.body(personal.summary);

  if (cv.experiences.length > 0) {
    writer.sectionHeading('Experience');
    for (const experience of cv.experiences) renderExperience(writer, experience);
  }

  if (cv.education.length > 0) {
    writer.sectionHeading('Education');
    for (const entry of cv.education) renderEducation(writer, entry);
  }

  if (cv.skills.length > 0) {
    writer.sectionHeading('Skills');
    renderSkills(writer, cv.skills);
  }

  return writer.finalise(cv);
}

export async function streamCvPdf(cv: Cv, res: Response): Promise<void> {
  const buffer = await renderCvPdf(cv);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${toFileName(cv.personal.fullName)}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

export const pdfConstants = { PAGE, COLORS, FONTS, CONTENT_WIDTH };
