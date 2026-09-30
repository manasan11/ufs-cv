import { describe, expect, it } from 'vitest';
import { api, makeCvPayload } from './helpers.js';

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse-battery' };

async function register(overrides: Partial<typeof CREDENTIALS & { fullName: string }> = {}) {
  return api()
    .post('/api/auth/register')
    .send({ fullName: 'Ada Lovelace', ...CREDENTIALS, ...overrides })
    .expect(201);
}

describe('GET /api/auth/config', () => {
  it('reports whether authentication is required', async () => {
    const response = await api().get('/api/auth/config').expect(200);
    expect(response.body.data).toEqual({ authRequired: false, registrationOpen: true });
  });
});

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token', async () => {
    const response = await register();

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.token.split('.')).toHaveLength(3);
    expect(response.body.data.user).toMatchObject({
      id: expect.any(Number),
      email: CREDENTIALS.email,
      fullName: 'Ada Lovelace',
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('normalises the email to lower case', async () => {
    const response = await register({ email: 'MiXeD@Example.COM' });
    expect(response.body.data.user.email).toBe('mixed@example.com');
  });

  it('rejects a duplicate email', async () => {
    await register();
    const response = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Someone Else', ...CREDENTIALS })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects a short password', async () => {
    const response = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Ada', email: 'short@example.com', password: 'abc' })
      .expect(422);

    const fields = (response.body.error.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('password');
  });

  it('rejects a missing full name', async () => {
    await api()
      .post('/api/auth/register')
      .send({ email: 'noname@example.com', password: 'longenoughpassword' })
      .expect(422);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    await register();
    const response = await api().post('/api/auth/login').send(CREDENTIALS).expect(200);

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe(CREDENTIALS.email);
  });

  it('rejects a wrong password', async () => {
    await register();
    await api()
      .post('/api/auth/login')
      .send({ ...CREDENTIALS, password: 'wrong-password' })
      .expect(401);
  });

  it('rejects an unknown email without revealing which part failed', async () => {
    await register();
    const unknown = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever-long' })
      .expect(401);
    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ ...CREDENTIALS, password: 'whatever-long' })
      .expect(401);

    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in account', async () => {
    const registered = await register();

    const response = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.token}`)
      .expect(200);

    expect(response.body.data.email).toBe(CREDENTIALS.email);
  });

  it('rejects a missing token', async () => {
    await api().get('/api/auth/me').expect(401);
  });

  it('rejects a malformed header', async () => {
    await api().get('/api/auth/me').set('Authorization', 'Basic abc').expect(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const forged = jwt.sign({ sub: 1, email: 'a@b.com' }, 'a-completely-different-secret');

    await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});

describe('ownership with a token', () => {
  it('records the owner when a token is supplied', async () => {
    const registered = await register();
    const token = registered.body.data.token as string;

    const created = await api()
      .post('/api/cvs')
      .set('Authorization', `Bearer ${token}`)
      .send(makeCvPayload())
      .expect(201);

    expect(created.body.data.ownerId).toBe(registered.body.data.user.id);
  });

  it('leaves ownerId null without a token', async () => {
    const created = await api().post('/api/cvs').send(makeCvPayload()).expect(201);
    expect(created.body.data.ownerId).toBeNull();
  });

  it('lets the owner read and delete their own CV', async () => {
    const registered = await register();
    const token = registered.body.data.token as string;

    const created = await api()
      .post('/api/cvs')
      .set('Authorization', `Bearer ${token}`)
      .send(makeCvPayload())
      .expect(201);
    const id = created.body.data.id as number;

    await api().get(`/api/cvs/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
    await api().delete(`/api/cvs/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
  });

  it('forbids a different user from reading or updating the CV', async () => {
    const owner = await register();
    const ownerToken = owner.body.data.token as string;

    const created = await api()
      .post('/api/cvs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(makeCvPayload())
      .expect(201);
    const id = created.body.data.id as number;

    const other = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Other', email: 'other@example.com', password: 'anotherpassword' })
      .expect(201);
    const otherToken = other.body.data.token as string;

    const read = await api().get(`/api/cvs/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');

    const write = await api()
      .put(`/api/cvs/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send(makeCvPayload({ personal: { ...makeCvPayload().personal, fullName: 'Hijacked' } }));
    expect(write.status).toBe(403);

    const remove = await api()
      .delete(`/api/cvs/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(remove.status).toBe(403);
  });
});
