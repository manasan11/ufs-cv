import { z } from 'zod';

const trimmed = (max: number, label: string) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .nullish()
    .transform((value) => (value === undefined || value === '' ? null : value));

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const month = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .regex(monthPattern, `${label} must use the YYYY-MM format`);

const optionalMonth = (label: string) =>
  z
    .string()
    .regex(monthPattern, `${label} must use the YYYY-MM format`)
    .nullish()
    .transform((value) => (value === undefined || value === '' ? null : value));

const isCurrent = z.boolean({ invalid_type_error: 'isCurrent must be a boolean' });

const experienceSchema = z
  .object({
    jobTitle: trimmed(120, 'Job title'),
    company: trimmed(120, 'Company'),
    location: optionalText(120, 'Location'),
    startDate: month('Start date'),
    endDate: optionalMonth('End date'),
    isCurrent,
    description: optionalText(2000, 'Description'),
  })
  .refine((value) => !value.isCurrent || value.endDate === null, {
    message: 'End date must be empty while the role is marked as current',
    path: ['endDate'],
  })
  .refine((value) => value.endDate === null || value.endDate >= value.startDate, {
    message: 'End date must not be earlier than the start date',
    path: ['endDate'],
  });

const educationSchema = z
  .object({
    institution: trimmed(160, 'Institution'),
    degree: optionalText(120, 'Degree'),
    fieldOfStudy: optionalText(120, 'Field of study'),
    startDate: optionalMonth('Start date'),
    endDate: optionalMonth('End date'),
    grade: optionalText(60, 'Grade'),
    description: optionalText(2000, 'Description'),
  })
  .refine(
    (value) => value.startDate === null || value.endDate === null || value.endDate >= value.startDate,
    { message: 'End date must not be earlier than the start date', path: ['endDate'] },
  );

const skillSchema = z.object({
  name: trimmed(60, 'Skill name'),
  category: optionalText(40, 'Category'),
  proficiency: z
    .number({ invalid_type_error: 'Proficiency must be a number between 1 and 5' })
    .int('Proficiency must be a whole number')
    .min(1, 'Proficiency must be between 1 and 5')
    .max(5, 'Proficiency must be between 1 and 5')
    .nullish()
    .transform((value) => (value === undefined ? null : value)),
});

export const createCvSchema = z.object({
  personal: z.object({
    fullName: trimmed(120, 'Full name'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .min(1, 'Email is required')
      .max(200, 'Email must be 200 characters or fewer')
      .email('Email must be a valid email address'),
    phone: optionalText(40, 'Phone'),
    headline: optionalText(160, 'Headline'),
    location: optionalText(160, 'Location'),
    summary: optionalText(2000, 'Summary'),
  }),
  experiences: z
    .array(experienceSchema)
    .min(1, 'At least one experience entry is required')
    .max(30, 'A CV can hold at most 30 experience entries'),
  education: z
    .array(educationSchema)
    .max(20, 'A CV can hold at most 20 education entries')
    .default([]),
  skills: z
    .array(skillSchema)
    .min(1, 'At least one skill is required')
    .max(50, 'A CV can hold at most 50 skills'),
});

export const updateCvSchema = createCvSchema;

export const listCvsQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1, 'limit must be 1 or greater').max(100, 'limit must be 100 or less').default(10),
  search: z.string().trim().max(160, 'search must be 160 characters or fewer').optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name'])
    .default('-createdAt'),
});

export const cvIdParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be 200 characters or fewer');

export const registerSchema = z.object({
  fullName: trimmed(120, 'Full name'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Email must be a valid email address'),
  password,
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Email must be a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export type CreateCvInput = z.infer<typeof createCvSchema>;
export type ListCvsQuery = z.infer<typeof listCvsQuerySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
