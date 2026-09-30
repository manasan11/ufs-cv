import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { execute, query, queryOne, withTransaction, type SqlParam } from '../db/pool.js';
import { toMonth, toStorageDate } from '../utils/dates.js';
import type { Cv, CvInput, CvSort, CvSummary, ListCvsParams, PageMeta } from '../types/cv.js';

const SORT_COLUMNS: Record<CvSort, string> = {
  createdAt: 'c.created_at ASC',
  '-createdAt': 'c.created_at DESC',
  updatedAt: 'c.updated_at ASC',
  '-updatedAt': 'c.updated_at DESC',
  name: 'c.full_name ASC',
  '-name': 'c.full_name DESC',
};

interface CvRow extends RowDataPacket {
  id: number;
  owner_id: number | null;
  full_name: string;
  email: string;
  phone: string | null;
  headline: string | null;
  location: string | null;
  summary: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ExperienceRow extends RowDataPacket {
  id: number;
  cv_id: number;
  job_title: string;
  company: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: number;
  description: string | null;
  position: number;
}

interface EducationRow extends RowDataPacket {
  id: number;
  cv_id: number;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  grade: string | null;
  description: string | null;
  position: number;
}

interface SkillRow extends RowDataPacket {
  id: number;
  cv_id: number;
  name: string;
  category: string | null;
  proficiency: number | null;
  position: number;
}

interface SummaryRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  headline: string | null;
  experience_count: number;
  education_count: number;
  skill_count: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

export function mapCv(
  row: CvRow,
  experiences: ExperienceRow[],
  education: EducationRow[],
  skills: SkillRow[],
): Cv {
  return {
    id: row.id,
    ownerId: row.owner_id,
    personal: {
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      headline: row.headline,
      location: row.location,
      summary: row.summary,
    },
    experiences: experiences.map((experience) => ({
      id: experience.id,
      jobTitle: experience.job_title,
      company: experience.company,
      location: experience.location,
      startDate: toMonth(experience.start_date)!,
      endDate: toMonth(experience.end_date),
      isCurrent: experience.is_current === 1,
      description: experience.description,
    })),
    education: education.map((entry) => ({
      id: entry.id,
      institution: entry.institution,
      degree: entry.degree,
      fieldOfStudy: entry.field_of_study,
      startDate: toMonth(entry.start_date),
      endDate: toMonth(entry.end_date),
      grade: entry.grade,
      description: entry.description,
    })),
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      proficiency: skill.proficiency,
    })),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapSummary(row: SummaryRow): CvSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    headline: row.headline,
    experienceCount: row.experience_count,
    educationCount: row.education_count,
    skillCount: row.skill_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function loadChildren(cvId: number): Promise<{
  experiences: ExperienceRow[];
  education: EducationRow[];
  skills: SkillRow[];
}> {
  const [experiences, education, skills] = await Promise.all([
    query<ExperienceRow[]>('SELECT * FROM cv_experiences WHERE cv_id = ? ORDER BY position ASC, id ASC', [cvId]),
    query<EducationRow[]>('SELECT * FROM cv_education WHERE cv_id = ? ORDER BY position ASC, id ASC', [cvId]),
    query<SkillRow[]>('SELECT * FROM cv_skills WHERE cv_id = ? ORDER BY position ASC, id ASC', [cvId]),
  ]);
  return { experiences, education, skills };
}

export async function findAllCvs(params: ListCvsParams): Promise<{ rows: CvSummary[]; meta: PageMeta }> {
  const filters: string[] = [];
  const values: SqlParam[] = [];

  if (params.search) {
    filters.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.headline LIKE ?)');
    const like = `%${params.search}%`;
    values.push(like, like, like);
  }

  if (params.ownerId !== null) {
    filters.push('c.owner_id = ?');
    values.push(params.ownerId);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderBy = SORT_COLUMNS[params.sort];
  const offset = (params.page - 1) * params.limit;

  const countRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM cvs c ${where}`,
    values,
  );
  const total = countRow?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  const rows = await query<SummaryRow[]>(
    `SELECT c.id, c.full_name, c.email, c.phone, c.headline, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM cv_experiences e WHERE e.cv_id = c.id) AS experience_count,
            (SELECT COUNT(*) FROM cv_education d WHERE d.cv_id = c.id) AS education_count,
            (SELECT COUNT(*) FROM cv_skills s WHERE s.cv_id = c.id) AS skill_count
       FROM cvs c
       ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [...values, params.limit, offset],
  );

  return {
    rows: rows.map(mapSummary),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

export async function findCvById(id: number): Promise<Cv | null> {
  const row = await queryOne<CvRow>('SELECT * FROM cvs WHERE id = ?', [id]);
  if (!row) return null;

  const { experiences, education, skills } = await loadChildren(id);
  return mapCv(row, experiences, education, skills);
}

export async function insertCv(input: CvInput, ownerId: number | null): Promise<number> {
  return withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO cvs (owner_id, full_name, email, phone, headline, location, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        input.personal.fullName,
        input.personal.email,
        input.personal.phone,
        input.personal.headline,
        input.personal.location,
        input.personal.summary,
      ],
    );

    const cvId = result.insertId;
    await insertChildren(connection, cvId, input);
    return cvId;
  });
}

export async function updateCv(id: number, input: CvInput): Promise<boolean> {
  return withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE cvs
          SET full_name = ?, email = ?, phone = ?, headline = ?, location = ?, summary = ?
        WHERE id = ?`,
      [
        input.personal.fullName,
        input.personal.email,
        input.personal.phone,
        input.personal.headline,
        input.personal.location,
        input.personal.summary,
        id,
      ],
    );

    if (result.affectedRows === 0) return false;

    await connection.execute('DELETE FROM cv_experiences WHERE cv_id = ?', [id]);
    await connection.execute('DELETE FROM cv_education WHERE cv_id = ?', [id]);
    await connection.execute('DELETE FROM cv_skills WHERE cv_id = ?', [id]);
    await insertChildren(connection, id, input);
    return true;
  });
}

export async function deleteCv(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM cvs WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function insertChildren(
  connection: import('mysql2/promise').PoolConnection,
  cvId: number,
  input: CvInput,
): Promise<void> {
  for (const [position, experience] of input.experiences.entries()) {
    await connection.execute(
      `INSERT INTO cv_experiences
         (cv_id, position, job_title, company, location, start_date, end_date, is_current, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cvId,
        position,
        experience.jobTitle,
        experience.company,
        experience.location,
        toStorageDate(experience.startDate),
        experience.isCurrent ? null : toStorageDate(experience.endDate),
        experience.isCurrent ? 1 : 0,
        experience.description,
      ],
    );
  }

  for (const [position, entry] of input.education.entries()) {
    await connection.execute(
      `INSERT INTO cv_education
         (cv_id, position, institution, degree, field_of_study, start_date, end_date, grade, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cvId,
        position,
        entry.institution,
        entry.degree,
        entry.fieldOfStudy,
        toStorageDate(entry.startDate),
        toStorageDate(entry.endDate),
        entry.grade,
        entry.description,
      ],
    );
  }

  for (const [position, skill] of input.skills.entries()) {
    await connection.execute(
      'INSERT INTO cv_skills (cv_id, position, name, category, proficiency) VALUES (?, ?, ?, ?, ?)',
      [cvId, position, skill.name, skill.category, skill.proficiency],
    );
  }
}
