import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { CvInput } from '../src/types/cv.js';

export const app: Express = createApp();

export const api = () => request(app);

/** Minimal valid CV payload, overridable per test. */
export function makeCvPayload(overrides: Partial<CvInput> = {}): CvInput {
  return {
    personal: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      headline: 'Software Engineer',
      location: 'London, UK',
      summary: 'Analytical engine enthusiast with a knack for formalising problems.',
      ...overrides.personal,
    },
    experiences: overrides.experiences ?? [
      {
        jobTitle: 'Senior Engineer',
        company: 'Analytical Engines Ltd',
        location: 'London, UK',
        startDate: '2020-03',
        endDate: null,
        isCurrent: true,
        description: 'Designed the first program\nReduced punch-card waste by 40%',
      },
    ],
    education: overrides.education ?? [
      {
        institution: 'University of London',
        degree: 'BSc',
        fieldOfStudy: 'Mathematics',
        startDate: '2014-10',
        endDate: '2018-06',
        grade: 'First Class Honours',
        description: null,
      },
    ],
    skills: overrides.skills ?? [
      { name: 'TypeScript', category: 'Languages', proficiency: 5 },
      { name: 'SQL', category: 'Languages', proficiency: 4 },
      { name: 'Angular', category: 'Frontend', proficiency: 4 },
    ],
  };
}

/** Creates a CV through the API and returns its id. */
export async function createCvViaApi(payload: CvInput = makeCvPayload()): Promise<number> {
  const response = await api().post('/api/cvs').send(payload).expect(201);
  return response.body.data.id as number;
}
