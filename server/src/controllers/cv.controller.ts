import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ownerIdOrNull } from '../middleware/auth.js';
import * as cvService from '../services/cv.service.js';
import { streamCvPdf } from '../services/pdf.service.js';
import type { CvInput } from '../types/cv.js';
import type { ListCvsQuery } from '../validation/schemas.js';

export const listCvs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, sort } = req.query as unknown as ListCvsQuery;
  const result = await cvService.listCvs({ page, limit, search, sort }, req);
  res.json({ data: result.rows, meta: result.meta });
});

export const getCv = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  const cv = await cvService.getCv(id, req);
  res.json({ data: cv });
});

export const createCv = asyncHandler(async (req: Request, res: Response) => {
  const cv = await cvService.createCv(req.body as CvInput, req);
  res.status(201).json({ data: cv });
});

export const updateCv = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  const cv = await cvService.updateCv(id, req.body as CvInput, req);
  res.json({ data: cv });
});

export const deleteCv = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  await cvService.removeCv(id, req);
  res.status(204).send();
});

export const downloadCvPdf = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  const cv = await cvService.getCv(id, req);
  await streamCvPdf(cv, res);
});

export { ownerIdOrNull };
