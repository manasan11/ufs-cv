import { describe, expect, it } from 'vitest';
import { renderCvPdf, toFileName } from '../src/services/pdf.service.js';
import { api, makeCvPayload } from './helpers.js';
import type { Cv, CvInput } from '../src/types/cv.js';

interface PdfTextItem {
  str: string;
}

async function loadPdf(buffer: Buffer): Promise<{ pages: number; text: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    verbosity: 0,
  });

  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = (content.items as unknown as PdfTextItem[])
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
  }

  return { pages: document.numPages, text: pages };
}

function cvFrom(input: CvInput): Cv {
  return {
    id: 1,
    ownerId: null,
    personal: input.personal,
    experiences: input.experiences.map((experience, position) => ({ id: position + 1, ...experience })),
    education: input.education.map((entry, position) => ({ id: position + 1, ...entry })),
    skills: input.skills.map((skill, position) => ({ id: position + 1, ...skill })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('renderCvPdf', () => {
  it('produces a valid single-page PDF', async () => {
    const buffer = await renderCvPdf(cvFrom(makeCvPayload()));

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.subarray(-6).toString()).toContain('EOF');

    const { pages, text } = await loadPdf(buffer);
    expect(pages).toBe(1);
    expect(text[0]).toContain('Ada Lovelace');
  });

  it('includes the contact line, sections and entries', async () => {
    const buffer = await renderCvPdf(cvFrom(makeCvPayload()));
    const { text } = await loadPdf(buffer);
    const content = text.join(' ');

    expect(content).toContain('PROFESSIONAL SUMMARY');
    expect(content).toContain('EXPERIENCE');
    expect(content).toContain('EDUCATION');
    expect(content).toContain('SKILLS');
    expect(content).toContain('Analytical Engines Ltd');
    expect(content).toContain('University of London');
    expect(content).toContain('TypeScript');
  });

  it('renders a current role as "Present"', async () => {
    const buffer = await renderCvPdf(cvFrom(makeCvPayload()));
    const { text } = await loadPdf(buffer);
    expect(text[0]).toContain('Present');
  });

  it('formats month precision dates as short month names', async () => {
    const buffer = await renderCvPdf(cvFrom(makeCvPayload()));
    const { text } = await loadPdf(buffer);
    expect(text[0]).toContain('Mar 2020');
    expect(text[0]).toContain('Oct 2014');
  });

  it('shows proficiency for skills that define one', async () => {
    const buffer = await renderCvPdf(cvFrom(makeCvPayload()));
    const { text } = await loadPdf(buffer);
    expect(text[0]).toContain('TypeScript (5/5)');
    expect(text[0]).toContain('SQL (4/5)');
  });

  it('keeps skill category labels and values from overlapping', async () => {
    const input = makeCvPayload();
    input.skills = [
      { name: 'Kubernetes', category: 'Cloud & DevOps', proficiency: 5 },
      { name: 'Terraform', category: 'Cloud & DevOps', proficiency: 4 },
    ];

    const buffer = await renderCvPdf(cvFrom(input));
    const { text } = await loadPdf(buffer);

    expect(text[0]).toContain('Cloud & DevOps');
    expect(text[0]).toContain('Kubernetes (5/5), Terraform (4/5)');
  });

  it('groups skills under an "Skills" label when no category is set', async () => {
    const input = makeCvPayload();
    input.skills = [{ name: 'Fortran', category: null, proficiency: null }];

    const buffer = await renderCvPdf(input && cvFrom(input));
    const { text } = await loadPdf(buffer);
    expect(text[0]).toContain('Skills');
    expect(text[0]).toContain('Fortran');
  });

  it('paginates a long CV and numbers every page', async () => {
    const input = makeCvPayload();
    input.experiences = Array.from({ length: 12 }, (_, index) => ({
      jobTitle: `Role number ${index + 1}`,
      company: `Company ${index + 1}`,
      location: 'Remote',
      startDate: '2015-01',
      endDate: index === 11 ? null : '2016-01',
      isCurrent: index === 11,
      description: 'A line of achievement text that takes up horizontal space.\nA second bullet for the same role.',
    }));

    const buffer = await renderCvPdf(cvFrom(input));
    const { pages, text } = await loadPdf(buffer);

    expect(pages).toBeGreaterThan(1);

    text.forEach((pageText, index) => {
      expect(pageText).toContain(`Page ${index + 1} of ${pages}`);
    });

    // Regression: the footer pass must not append an extra empty page.
    const lastPage = text[pages - 1]!;
    expect(lastPage.length).toBeGreaterThan(0);
    expect(lastPage).toContain(`Page ${pages} of ${pages}`);
  });

  it('does not emit a trailing footer-only page for a short CV', async () => {
    const input = makeCvPayload();
    input.skills = [{ name: 'Go', category: 'Languages', proficiency: 4 }];
    input.education = [];
    input.experiences = [
      {
        jobTitle: 'Engineer',
        company: 'Example',
        location: null,
        startDate: '2020-01',
        endDate: null,
        isCurrent: true,
        description: 'Short description.',
      },
    ];

    const buffer = await renderCvPdf(cvFrom(input));
    const { pages, text } = await loadPdf(buffer);

    expect(pages).toBe(1);
    expect(text).toHaveLength(1);
  });

  it('renders bullet lines when a description spans multiple lines', async () => {
    const input = makeCvPayload();
    input.experiences[0] = {
      ...input.experiences[0]!,
      description: 'First achievement\nSecond achievement\nThird achievement',
    };

    const buffer = await renderCvPdf(cvFrom(input));
    const { text } = await loadPdf(buffer);
    const content = text.join(' ');

    expect(content).toContain('First achievement');
    expect(content).toContain('Second achievement');
    expect(content).toContain('Third achievement');
  });

  it('handles a CV with no education or skills', async () => {
    const input = makeCvPayload();
    input.education = [];
    input.skills = [{ name: 'SQL', category: null, proficiency: null }];

    const buffer = await renderCvPdf(cvFrom(input));
    const { text } = await loadPdf(buffer);
    const content = text.join(' ');

    expect(content).not.toContain('EDUCATION');
    expect(content).toContain('SKILLS');
  });
});

describe('toFileName', () => {
  it('slugifies a name', () => {
    expect(toFileName('Ada Lovelace')).toBe('Ada-Lovelace.pdf');
  });

  it('strips accents and punctuation', () => {
    expect(toFileName('José María Núñez')).toBe('Jose-Maria-Nunez.pdf');
  });

  it('collapses whitespace and trims', () => {
    expect(toFileName('  Grace   Brewster  Hopper ')).toBe('Grace-Brewster-Hopper.pdf');
  });

  it('falls back when nothing usable remains', () => {
    expect(toFileName('!!!')).toBe('cv.pdf');
  });

  it('caps a very long name', () => {
    const name = toFileName('A'.repeat(300));
    expect(name.length).toBeLessThanOrEqual(84);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('GET /api/cvs/:id/pdf', () => {
  it('returns a PDF attachment with a slugged filename', async () => {
    const created = await api().post('/api/cvs').send(makeCvPayload()).expect(201);
    const id = created.body.data.id as number;

    const response = await api()
      .get(`/api/cvs/${id}/pdf`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', 'application/pdf');

    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Ada-Lovelace.pdf"',
    );

    const buffer = response.body as Buffer;
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns 404 for a missing CV', async () => {
    await api().get('/api/cvs/999999/pdf').expect(404);
  });

  it('returns a JSON error rather than a PDF when the CV is missing', async () => {
    const response = await api().get('/api/cvs/999999/pdf').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
