import { Router } from 'express';
import * as cvController from '../controllers/cv.controller.js';
import { authGuard } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCvSchema,
  cvIdParamSchema,
  listCvsQuerySchema,
  updateCvSchema,
} from '../validation/schemas.js';

export const cvRouter = Router();

const guard = authGuard();

cvRouter.get('/', guard, validate({ query: listCvsQuerySchema }), cvController.listCvs);
cvRouter.post('/', guard, validate({ body: createCvSchema }), cvController.createCv);
cvRouter.get('/:id/pdf', guard, validate({ params: cvIdParamSchema }), cvController.downloadCvPdf);
cvRouter.get('/:id', guard, validate({ params: cvIdParamSchema }), cvController.getCv);
cvRouter.put(
  '/:id',
  guard,
  validate({ params: cvIdParamSchema, body: updateCvSchema }),
  cvController.updateCv,
);
cvRouter.delete('/:id', guard, validate({ params: cvIdParamSchema }), cvController.deleteCv);
