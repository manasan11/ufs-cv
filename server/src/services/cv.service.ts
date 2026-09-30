import type { Request } from 'express';
import { config } from '../config/env.js';
import { assertCanAccess, ownerIdOrNull } from '../middleware/auth.js';
import {
  deleteCv as deleteCvRecord,
  findAllCvs,
  findCvById,
  insertCv,
  updateCv as updateCvRecord,
} from '../repositories/cv.repository.js';
import type { Cv, CvSummary, ListCvsParams, PageMeta } from '../types/cv.js';
import type { CvInput } from '../types/cv.js';
import { ApiError } from '../utils/ApiError.js';

export async function listCvs(
  params: Omit<ListCvsParams, 'ownerId'>,
  req: Request,
): Promise<{ rows: CvSummary[]; meta: PageMeta }> {
  // When auth is mandatory, a signed-in user only ever sees their own CVs.
  const ownerId = config.authRequired ? ownerIdOrNull(req) : null;
  return findAllCvs({ ...params, ownerId });
}

export async function getCv(id: number, req: Request): Promise<Cv> {
  const cv = await findCvById(id);
  if (!cv) throw ApiError.notFound(`No CV exists with id ${id}`);
  assertCanAccess(req, cv.ownerId);
  return cv;
}

export async function createCv(input: CvInput, req: Request): Promise<Cv> {
  const id = await insertCv(input, ownerIdOrNull(req));
  const created = await findCvById(id);
  if (!created) throw ApiError.internal('Failed to load the created CV');
  return created;
}

export async function updateCv(id: number, input: CvInput, req: Request): Promise<Cv> {
  const existing = await findCvById(id);
  if (!existing) throw ApiError.notFound(`No CV exists with id ${id}`);
  assertCanAccess(req, existing.ownerId);

  const updated = await updateCvRecord(id, input);
  if (!updated) throw ApiError.notFound(`No CV exists with id ${id}`);

  const result = await findCvById(id);
  if (!result) throw ApiError.internal('Failed to load the updated CV');
  return result;
}

export async function removeCv(id: number, req: Request): Promise<void> {
  const existing = await findCvById(id);
  if (!existing) throw ApiError.notFound(`No CV exists with id ${id}`);
  assertCanAccess(req, existing.ownerId);

  const deleted = await deleteCvRecord(id);
  if (!deleted) throw ApiError.notFound(`No CV exists with id ${id}`);
}
