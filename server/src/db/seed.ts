import { pathToFileURL } from 'node:url';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { closePool, createServerPool, execute, queryOne, withTransaction } from './pool.js';
import { logger } from '../utils/logger.js';
import type { CvInput } from '../types/cv.js';
import { toStorageDate } from '../utils/dates.js';
import { migrate } from './migrate.js';

const FIRST_NAMES = [
  'Amara', 'Lukas', 'Priya', 'Noah', 'Sofia', 'Kenji', 'Zara', 'Mateo', 'Ines', 'Tomas',
  'Aisha', 'Diego', 'Freya', 'Rohan', 'Elena', 'Samuel', 'Nadia', 'Victor', 'Leila', 'Owen',
  'Clara', 'Hassan', 'Mei', 'Gabriel', 'Anika',
];

const LAST_NAMES = [
  'Okonkwo', 'Berger', 'Raman', 'Lindqvist', 'Moreau', 'Tanaka', 'Haddad', 'Silva', 'Costa', 'Novak',
  'Rahman', 'Morales', 'Dahl', 'Kapoor', 'Petrova', 'Adeyemi', 'Kovacs', 'Almeida', 'Nasser', 'Fitzgerald',
  'Bianchi', 'Farouk', 'Chen', 'Rossi', 'Weber',
];

const TITLES = [
  'Senior Backend Engineer', 'Frontend Engineer', 'Full Stack Developer', 'Data Analyst',
  'DevOps Engineer', 'Product Designer', 'QA Engineer', 'Machine Learning Engineer',
  'Mobile Engineer', 'Business Analyst', 'Solutions Architect', 'Technical Lead',
];

const COMPANIES = [
  'Northwind Logistics', 'Helios Analytics', 'Brightline Media', 'Corvus Health', 'Atlas Pay',
  'Verdant Energy', 'Cobalt Systems', 'Meridian Retail', 'Sable Insurance', 'Orbital Freight',
  'Lumen Education', 'Harborstone Group', 'Quarry Software', 'Fernway Foods', 'Solstice Travel',
];

const LOCATIONS = [
  'Berlin, Germany', 'Lisbon, Portugal', 'Toronto, Canada', 'Nairobi, Kenya',
  'Singapore', 'Austin, USA', 'Krakow, Poland', 'Bogota, Colombia', 'Osaka, Japan', 'Manchester, UK',
];

const DEGREES = [
  ['BSc', 'Computer Science'], ['BEng', 'Software Engineering'], ['BSc', 'Mathematics'],
  ['BA', 'Economics'], ['MSc', 'Data Science'], ['BSc', 'Information Systems'], ['MA', 'Design'],
];

const INSTITUTIONS = [
  'University of Cape Town', 'TU Berlin', 'University of Toronto', 'Kyoto Institute of Technology',
  'Universidad Nacional', 'University of Manchester', 'Warsaw University of Technology',
  'National University of Singapore', 'Delft University of Technology',
];

const SKILL_GROUPS: Array<{ category: string; names: string[] }> = [
  { category: 'Languages', names: ['TypeScript', 'Python', 'Go', 'Java', 'SQL', 'Rust', 'C#'] },
  { category: 'Frontend', names: ['Angular', 'React', 'TypeScript', 'CSS', 'Accessibility'] },
  { category: 'Backend', names: ['Node.js', 'NestJS', 'Spring Boot', 'PostgreSQL', 'Redis'] },
  { category: 'Cloud & DevOps', names: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD'] },
  { category: 'Data', names: ['dbt', 'Airflow', 'Pandas', 'Power BI', 'Snowflake'] },
  { category: 'Practices', names: ['Code review', 'Mentoring', 'TDD', 'Agile delivery'] },
];

const ACHIEVEMENTS = [
  'Cut p95 latency by 42% by introducing a read-through cache and query batching',
  'Led the migration of a monolithic service into twelve independently deployable modules',
  'Designed the ingestion pipeline that now processes 4.2M events per day without data loss',
  'Raised automated coverage from 31% to 89% across the payments domain',
  'Shipped an accessibility overhaul that closed all outstanding WCAG 2.1 AA findings',
  'Mentored four junior engineers, three of whom were promoted within a year',
  'Reduced infrastructure spend by 27% through right-sizing and spot capacity adoption',
  'Introduced contract testing between six teams, removing a recurring release blocker',
  'Owned the data model behind a self-service reporting suite used by 300+ analysts',
  'Drove the localisation launch into three new markets ahead of schedule',
];

const SUMMARIES = [
  'Backend engineer with a focus on reliable distributed systems and clear API contracts. Comfortable owning a service end to end, from schema design through on-call.',
  'Product-minded frontend developer who cares about accessible interfaces, fast first paint, and design systems that stay consistent as teams grow.',
  'Data practitioner bridging analytics and engineering, comfortable modelling warehouses and shipping the pipelines that keep them trustworthy.',
  'Infrastructure engineer focused on making deployments boring: reproducible builds, automated rollbacks, and observability that answers questions.',
  'Full stack developer who enjoys small teams and ambiguous problems, with a bias toward shipping working software and iterating quickly.',
  'Quality engineer who treats automation as a product, building suites that are fast enough that engineers actually run them.',
];

/** Deterministic PRNG so repeated seeds produce identical data. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = createRandom(20260930);

function pick<T>(items: readonly T[]): T {
  const value = items[Math.floor(random() * items.length)];
  if (value === undefined) throw new Error('pick() called with an empty list');
  return value;
}

function intBetween(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function monthOf(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function buildCv(index: number): CvInput {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const last = LAST_NAMES[index % LAST_NAMES.length]!;
  const fullName = `${first} ${last}`;
  const title = pick(TITLES);
  const location = pick(LOCATIONS);
  const currentYear = 2026;
  const startYear = intBetween(2008, 2016);

  const experienceCount = intBetween(1, 4);
  const experiences: CvInput['experiences'] = [];

  for (let i = 0; i < experienceCount; i += 1) {
    const roleStartYear = startYear + i * intBetween(2, 3);
    const isCurrent = i === experienceCount - 1 && random() > 0.25;
    const startMonth = intBetween(1, 12);
    const hasEnd = !isCurrent && roleStartYear + intBetween(1, 4) <= currentYear;

    const bulletCount = intBetween(1, 3);
    const bullets: string[] = [];
    for (let b = 0; b < bulletCount; b += 1) {
      bullets.push(ACHIEVEMENTS[(index * 3 + b * 5 + i) % ACHIEVEMENTS.length]!);
    }

    experiences.push({
      jobTitle: i === 0 ? title : pick(TITLES),
      company: pick(COMPANIES),
      location,
      startDate: monthOf(roleStartYear, startMonth),
      endDate: hasEnd ? monthOf(roleStartYear + intBetween(1, 3), intBetween(1, 12)) : null,
      isCurrent,
      description: bullets.join('\n'),
    });
  }

  const educationCount = intBetween(1, 2);
  const education: CvInput['education'] = [];
  for (let i = 0; i < educationCount; i += 1) {
    const [degree, field] = pick(DEGREES);
    const gradYear = startYear - intBetween(0, 2);
    education.push({
      institution: pick(INSTITUTIONS),
      degree: degree!,
      fieldOfStudy: field!,
      startDate: monthOf(gradYear - intBetween(3, 4), intBetween(8, 10)),
      endDate: monthOf(gradYear, intBetween(5, 7)),
      grade: random() > 0.55 ? pick(['First Class Honours', 'Distinction', '3.8 / 4.0', 'Merit']) : null,
      description: null,
    });
  }

  const groupCount = intBetween(2, 4);
  const skills: CvInput['skills'] = [];
  for (let i = 0; i < groupCount; i += 1) {
    const group = SKILL_GROUPS[(index + i) % SKILL_GROUPS.length]!;
    const take = intBetween(2, Math.min(4, group.names.length));
    for (let s = 0; s < take; s += 1) {
      const name = group.names[(s + i) % group.names.length]!;
      if (skills.some((skill) => skill.name === name)) continue;
      skills.push({
        name,
        category: group.category,
        proficiency: intBetween(3, 5),
      });
    }
  }

  return {
    personal: {
      fullName,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `+${intBetween(1, 99)} ${intBetween(100, 999)} ${intBetween(100, 999)} ${intBetween(100, 999)}`,
      headline: title,
      location,
      summary: pick(SUMMARIES),
    },
    experiences,
    education,
    skills,
  };
}

async function insertCv(connection: PoolConnection, input: CvInput): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO cvs (owner_id, full_name, email, phone, headline, location, summary)
     VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
    [
      input.personal.fullName,
      input.personal.email,
      input.personal.phone,
      input.personal.headline,
      input.personal.location,
      input.personal.summary,
    ],
  );

  const cvId = result.insertId;

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

  return cvId;
}

const DEMO_USER = {
  email: 'demo@example.com',
  fullName: 'Demo User',
  password: 'demo-password-123',
};

export async function seed(count = 25): Promise<void> {
  const { default: bcrypt } = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);

  // TRUNCATE is non-transactional in MySQL and forces an implicit commit, so the
  // reset runs on its own before the transactional insert phase begins.
  await withForeignKeyChecksDisabled(async () => {
    await execute('TRUNCATE TABLE cv_skills');
    await execute('TRUNCATE TABLE cv_education');
    await execute('TRUNCATE TABLE cv_experiences');
    await execute('TRUNCATE TABLE cvs');
    await execute('TRUNCATE TABLE users');
  });

  await withTransaction(async (connection) => {
    await connection.execute(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [DEMO_USER.email, passwordHash, DEMO_USER.fullName],
    );

    for (let index = 0; index < count; index += 1) {
      await insertCv(connection, buildCv(index));
    }
  });

  logger.info(`Seeded ${count} CVs and the demo account ${DEMO_USER.email}`);
  logger.info(`Demo password: ${DEMO_USER.password}`);
}

async function withForeignKeyChecksDisabled(fn: () => Promise<void>): Promise<void> {
  await execute('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await fn();
  } finally {
    await execute('SET FOREIGN_KEY_CHECKS = 1');
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const run = async (): Promise<void> => {
    try {
      await migrate();
      await seed(Number(process.env.SEED_COUNT ?? 25));

      const row = await queryOne<RowDataPacket & { total: number }>(
        'SELECT COUNT(*) AS total FROM cvs',
      );
      logger.info(`Verification: cvs table now holds ${row?.total ?? 0} rows`);
    } finally {
      // Always release connections so the process can exit on success or failure.
      await closePool();
    }
  };

  run().catch((error: unknown) => {
    logger.error('Seeding failed', error);
    process.exitCode = 1;
  });
}

export { execute, createServerPool, closePool };
