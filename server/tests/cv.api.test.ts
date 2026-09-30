import { describe, expect, it } from 'vitest';
import { api, createCvViaApi, makeCvPayload } from './helpers.js';

describe('GET /api/health', () => {
  it('reports the database as reachable', async () => {
    const response = await api().get('/api/health').expect(200);

    expect(response.body.data).toMatchObject({
      status: 'ok',
      database: 'up',
      environment: 'test',
    });
    expect(typeof response.body.data.uptimeSeconds).toBe('number');
  });
});

describe('POST /api/cvs', () => {
  it('creates a CV and returns the persisted shape', async () => {
    const payload = makeCvPayload();
    const response = await api().post('/api/cvs').send(payload).expect(201);

    const { data } = response.body;
    expect(data.id).toBeGreaterThan(0);
    expect(data.ownerId).toBeNull();
    expect(data.personal).toMatchObject(payload.personal);
    expect(data.experiences).toHaveLength(1);
    expect(data.experiences[0]).toMatchObject({
      jobTitle: 'Senior Engineer',
      company: 'Analytical Engines Ltd',
      startDate: '2020-03',
      endDate: null,
      isCurrent: true,
    });
    expect(data.education[0]).toMatchObject({ institution: 'University of London' });
    expect(data.skills).toHaveLength(3);
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stores month precision dates as the first of the month', async () => {
    const id = await createCvViaApi();
    const response = await api().get(`/api/cvs/${id}`).expect(200);

    expect(response.body.data.experiences[0].startDate).toBe('2020-03');
    expect(response.body.data.education[0].startDate).toBe('2014-10');
  });

  it('normalises empty optional strings to null', async () => {
    const payload = makeCvPayload();
    payload.personal.phone = '';
    payload.personal.headline = '';

    const response = await api().post('/api/cvs').send(payload).expect(201);
    expect(response.body.data.personal.phone).toBeNull();
    expect(response.body.data.personal.headline).toBeNull();
  });

  it('defaults education to an empty list when omitted', async () => {
    const payload = makeCvPayload();
    delete (payload as { education?: unknown }).education;

    const response = await api().post('/api/cvs').send(payload).expect(201);
    expect(response.body.data.education).toEqual([]);
  });

  it('trims whitespace around text fields', async () => {
    const payload = makeCvPayload();
    payload.personal.fullName = '  Grace Hopper  ';

    const response = await api().post('/api/cvs').send(payload).expect(201);
    expect(response.body.data.personal.fullName).toBe('Grace Hopper');
  });

  it('rejects a payload with no experience entries', async () => {
    const payload = makeCvPayload();
    payload.experiences = [];

    const response = await api().post('/api/cvs').send(payload).expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'experiences' })]),
    );
  });

  it('rejects a payload with no skills', async () => {
    const payload = makeCvPayload();
    payload.skills = [];

    await api().post('/api/cvs').send(payload).expect(422);
  });

  it('rejects an invalid email address', async () => {
    const payload = makeCvPayload();
    payload.personal.email = 'not-an-email';

    const response = await api().post('/api/cvs').send(payload).expect(422);
    const fields = (response.body.error.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('personal.email');
  });

  it('rejects an end date before the start date', async () => {
    const payload = makeCvPayload();
    payload.experiences[0] = {
      ...payload.experiences[0]!,
      isCurrent: false,
      startDate: '2022-01',
      endDate: '2021-01',
    };

    const response = await api().post('/api/cvs').send(payload).expect(422);
    const issues = response.body.error.details as Array<{ field: string }>;
    expect(issues.map((issue) => issue.field)).toContain('experiences.0.endDate');
  });

  it('rejects an end date on a current role', async () => {
    const payload = makeCvPayload();
    payload.experiences[0] = {
      ...payload.experiences[0]!,
      isCurrent: true,
      endDate: '2024-01',
    };

    await api().post('/api/cvs').send(payload).expect(422);
  });

  it('rejects a malformed month value', async () => {
    const payload = makeCvPayload();
    payload.experiences[0] = { ...payload.experiences[0]!, startDate: '2020-13' };

    await api().post('/api/cvs').send(payload).expect(422);
  });

  it('rejects a proficiency outside 1-5', async () => {
    const payload = makeCvPayload();
    payload.skills[0] = { ...payload.skills[0]!, proficiency: 9 };

    await api().post('/api/cvs').send(payload).expect(422);
  });

  it('rejects a body that is not valid JSON', async () => {
    const response = await api()
      .post('/api/cvs')
      .set('Content-Type', 'application/json')
      .send('{ not json')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/cvs', () => {
  it('returns an empty page with correct meta', async () => {
    const response = await api().get('/api/cvs').expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('summarises each row with child counts', async () => {
    await createCvViaApi();

    const response = await api().get('/api/cvs').expect(200);
    const row = response.body.data[0];

    expect(row).toMatchObject({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      experienceCount: 1,
      educationCount: 1,
      skillCount: 3,
    });
    expect(row.phone).toBe('+44 20 7946 0000');
  });

  it('paginates results', async () => {
    for (let index = 0; index < 5; index += 1) {
      const payload = makeCvPayload();
      payload.personal.fullName = `Person ${index}`;
      payload.personal.email = `person${index}@example.com`;
      await api().post('/api/cvs').send(payload).expect(201);
    }

    const first = await api().get('/api/cvs?page=1&limit=2').expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });

    const last = await api().get('/api/cvs?page=3&limit=2').expect(200);
    expect(last.body.data).toHaveLength(1);
    expect(last.body.meta).toMatchObject({ hasNext: false, hasPrev: true });
  });

  it('searches by name, email and headline', async () => {
    await createCvViaApi();
    const payload = makeCvPayload();
    payload.personal.fullName = 'Grace Hopper';
    payload.personal.email = 'grace@example.com';
    payload.personal.headline = 'Compiler Pioneer';
    await api().post('/api/cvs').send(payload).expect(201);

    const byName = await api().get('/api/cvs?search=Hopper').expect(200);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].fullName).toBe('Grace Hopper');

    const byEmail = await api().get('/api/cvs?search=grace@example').expect(200);
    expect(byEmail.body.data).toHaveLength(1);

    const byHeadline = await api().get('/api/cvs?search=Compiler').expect(200);
    expect(byHeadline.body.data).toHaveLength(1);

    const noMatch = await api().get('/api/cvs?search=nobody').expect(200);
    expect(noMatch.body.data).toEqual([]);
  });

  it('sorts by name in both directions', async () => {
    for (const name of ['Charlie', 'Alice', 'Bob']) {
      const payload = makeCvPayload();
      payload.personal.fullName = name;
      payload.personal.email = `${name.toLowerCase()}@example.com`;
      await api().post('/api/cvs').send(payload).expect(201);
    }

    const ascending = await api().get('/api/cvs?sort=name').expect(200);
    expect(ascending.body.data.map((row: { fullName: string }) => row.fullName)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ]);

    const descending = await api().get('/api/cvs?sort=-name').expect(200);
    expect(descending.body.data.map((row: { fullName: string }) => row.fullName)).toEqual([
      'Charlie',
      'Bob',
      'Alice',
    ]);
  });

  it('rejects an out-of-range limit', async () => {
    await api().get('/api/cvs?limit=1000').expect(422);
  });

  it('rejects a page below 1', async () => {
    await api().get('/api/cvs?page=0').expect(422);
  });

  it('rejects an unknown sort key', async () => {
    await api().get('/api/cvs?sort=secret').expect(422);
  });
});

describe('GET /api/cvs/:id', () => {
  it('returns a full CV with nested collections', async () => {
    const id = await createCvViaApi();
    const response = await api().get(`/api/cvs/${id}`).expect(200);

    expect(response.body.data.id).toBe(id);
    expect(response.body.data.experiences[0].id).toBeGreaterThan(0);
    expect(response.body.data.skills[0]).toMatchObject({ name: 'TypeScript', proficiency: 5 });
  });

  it('returns 404 for a missing id', async () => {
    const response = await api().get('/api/cvs/999999').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 for a non-numeric id', async () => {
    await api().get('/api/cvs/abc').expect(422);
  });
});

describe('PUT /api/cvs/:id', () => {
  it('replaces personal data and child collections', async () => {
    const id = await createCvViaApi();

    const updated = makeCvPayload();
    updated.personal.fullName = 'Ada King';
    updated.experiences = [
      {
        jobTitle: 'Principal Engineer',
        company: 'Difference Engine Co',
        location: null,
        startDate: '2015-01',
        endDate: '2019-12',
        isCurrent: false,
        description: 'Single description',
      },
    ];
    updated.education = [];
    updated.skills = [{ name: 'Go', category: null, proficiency: null }];

    const response = await api().put(`/api/cvs/${id}`).send(updated).expect(200);

    expect(response.body.data.personal.fullName).toBe('Ada King');
    expect(response.body.data.experiences).toHaveLength(1);
    expect(response.body.data.experiences[0]).toMatchObject({
      jobTitle: 'Principal Engineer',
      endDate: '2019-12',
      isCurrent: false,
    });
    expect(response.body.data.education).toEqual([]);
    expect(response.body.data.skills).toHaveLength(1);
    expect(response.body.data.updatedAt).toBeTruthy();
  });

  it('does not leave orphaned child rows', async () => {
    const id = await createCvViaApi();
    const updated = makeCvPayload();
    updated.experiences = [];
    updated.skills = [{ name: 'Rust', category: 'Languages', proficiency: 3 }];

    // experiences must hold at least one entry, so this must be rejected.
    await api().put(`/api/cvs/${id}`).send(updated).expect(422);

    const after = await api().get(`/api/cvs/${id}`).expect(200);
    expect(after.body.data.experiences).toHaveLength(1);
    expect(after.body.data.skills).toHaveLength(3);
  });

  it('returns 404 for a missing id', async () => {
    await api().put('/api/cvs/999999').send(makeCvPayload()).expect(404);
  });

  it('validates the body', async () => {
    const id = await createCvViaApi();
    await api().put(`/api/cvs/${id}`).send({ personal: {} }).expect(422);
  });
});

describe('DELETE /api/cvs/:id', () => {
  it('deletes a CV and cascades to its children', async () => {
    const id = await createCvViaApi();

    await api().delete(`/api/cvs/${id}`).expect(204);
    await api().get(`/api/cvs/${id}`).expect(404);

    const list = await api().get('/api/cvs').expect(200);
    expect(list.body.meta.total).toBe(0);
  });

  it('returns 404 when deleting twice', async () => {
    const id = await createCvViaApi();
    await api().delete(`/api/cvs/${id}`).expect(204);
    await api().delete(`/api/cvs/${id}`).expect(404);
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const response = await api().get('/api/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
