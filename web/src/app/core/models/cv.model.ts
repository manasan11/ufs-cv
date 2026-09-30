export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string | null;
  headline: string | null;
  location: string | null;
  summary: string;
}

export interface Experience {
  id: number;
  jobTitle: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface Education {
  id: number;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  grade: string | null;
  description: string | null;
}

export interface Skill {
  id: number;
  name: string;
  category: string | null;
  proficiency: number | null;
}

export interface Cv {
  id: number;
  ownerId: number | null;
  personal: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
}

export interface CvSummary {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  headline: string | null;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CvSort = 'createdAt' | '-createdAt' | 'updatedAt' | '-updatedAt' | 'name' | '-name';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface DataResponse<T> {
  data: T;
}

export interface CvPayload {
  personal: {
    fullName: string;
    email: string;
    phone?: string;
    headline?: string;
    location?: string;
    summary: string;
  };
  experiences: Array<{
    jobTitle: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    grade?: string;
    description?: string;
  }>;
  skills: Array<{
    name: string;
    category?: string;
    proficiency?: number;
  }>;
}

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export interface AuthConfig {
  authRequired: boolean;
  registrationOpen: boolean;
}
