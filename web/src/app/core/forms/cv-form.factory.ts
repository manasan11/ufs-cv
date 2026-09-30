import { inject, Injectable } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Cv, CvPayload } from '../models/cv.model';
import { dateRangeValidator, monthValidator } from '../validators/cv.validators';

export type ExperienceForm = FormGroup<{
  jobTitle: FormControl<string>;
  company: FormControl<string>;
  location: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  isCurrent: FormControl<boolean>;
  description: FormControl<string>;
}>;

export type EducationForm = FormGroup<{
  institution: FormControl<string>;
  degree: FormControl<string>;
  fieldOfStudy: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  grade: FormControl<string>;
  description: FormControl<string>;
}>;

export type SkillForm = FormGroup<{
  name: FormControl<string>;
  category: FormControl<string>;
  proficiency: FormControl<number | null>;
}>;

export type CvForm = FormGroup<{
  personal: FormGroup<{
    fullName: FormControl<string>;
    email: FormControl<string>;
    phone: FormControl<string>;
    headline: FormControl<string>;
    location: FormControl<string>;
    summary: FormControl<string>;
  }>;
  experiences: FormArray<ExperienceForm>;
  education: FormArray<EducationForm>;
  skills: FormArray<SkillForm>;
}>;

/** Builds the CV form and the row forms used by its three collections. */
@Injectable({ providedIn: 'root' })
export class CvFormFactory {
  private readonly fb = inject(FormBuilder).nonNullable;

  buildForm(): CvForm {
    return this.fb.group({
      personal: this.fb.group({
        fullName: ['', [Validators.required, Validators.maxLength(120)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
        phone: ['', [Validators.maxLength(40)]],
        headline: ['', [Validators.maxLength(160)]],
        location: ['', [Validators.maxLength(160)]],
        summary: ['', [Validators.maxLength(2000)]],
      }),
      experiences: this.fb.array<ExperienceForm>([]),
      education: this.fb.array<EducationForm>([]),
      skills: this.fb.array<SkillForm>([]),
    });
  }

  experience(): ExperienceForm {
    return this.fb.group({
      jobTitle: ['', [Validators.required, Validators.maxLength(120)]],
      company: ['', [Validators.required, Validators.maxLength(120)]],
      location: ['', [Validators.maxLength(120)]],
      startDate: ['', [Validators.required, monthValidator()]],
      endDate: this.fb.control('', [monthValidator(), dateRangeValidator('startDate', 'endDate')]),
      isCurrent: this.fb.control(false),
      description: ['', [Validators.maxLength(2000)]],
    });
  }

  education(): EducationForm {
    return this.fb.group({
      institution: ['', [Validators.required, Validators.maxLength(160)]],
      degree: ['', [Validators.maxLength(120)]],
      fieldOfStudy: ['', [Validators.maxLength(120)]],
      startDate: this.fb.control('', monthValidator()),
      endDate: this.fb.control('', [monthValidator(), dateRangeValidator('startDate', 'endDate')]),
      grade: ['', [Validators.maxLength(60)]],
      description: ['', [Validators.maxLength(2000)]],
    });
  }

  skill(): SkillForm {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(60)]],
      category: ['', [Validators.maxLength(40)]],
      proficiency: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(5)]),
    });
  }

  /** Fills the form from a CV, replacing every collection row. */
  patch(form: CvForm, cv: Cv): void {
    form.patchValue(
      {
        personal: {
          fullName: cv.personal.fullName,
          email: cv.personal.email,
          phone: cv.personal.phone ?? '',
          headline: cv.personal.headline ?? '',
          location: cv.personal.location ?? '',
          summary: cv.personal.summary,
        },
      },
      { emitEvent: false },
    );

    const experiences = form.controls.experiences;
    experiences.clear({ emitEvent: false });
    for (const experience of cv.experiences) {
      const row = this.experience();
      row.patchValue(
        {
          jobTitle: experience.jobTitle,
          company: experience.company,
          location: experience.location ?? '',
          startDate: experience.startDate,
          endDate: experience.endDate ?? '',
          isCurrent: experience.isCurrent,
          description: experience.description ?? '',
        },
        { emitEvent: false },
      );
      experiences.push(row);
    }

    const education = form.controls.education;
    education.clear({ emitEvent: false });
    for (const entry of cv.education) {
      const row = this.education();
      row.patchValue(
        {
          institution: entry.institution,
          degree: entry.degree ?? '',
          fieldOfStudy: entry.fieldOfStudy ?? '',
          startDate: entry.startDate ?? '',
          endDate: entry.endDate ?? '',
          grade: entry.grade ?? '',
          description: entry.description ?? '',
        },
        { emitEvent: false },
      );
      education.push(row);
    }

    const skills = form.controls.skills;
    skills.clear({ emitEvent: false });
    for (const skill of cv.skills) {
      const row = this.skill();
      row.patchValue(
        {
          name: skill.name,
          category: skill.category ?? '',
          proficiency: skill.proficiency,
        },
        { emitEvent: false },
      );
      skills.push(row);
    }
  }

  /** Converts the form value into the API payload, dropping empty strings. */
  toPayload(form: CvForm): CvPayload {
    const value = form.getRawValue();
    const optional = (raw: string): string | undefined =>
      raw.trim() === '' ? undefined : raw.trim();

    return {
      personal: {
        fullName: value.personal.fullName.trim(),
        email: value.personal.email.trim(),
        phone: optional(value.personal.phone),
        headline: optional(value.personal.headline),
        location: optional(value.personal.location),
        summary: value.personal.summary.trim(),
      },
      experiences: value.experiences.map((experience) => ({
        jobTitle: experience.jobTitle.trim(),
        company: experience.company.trim(),
        location: optional(experience.location),
        startDate: experience.startDate,
        endDate: experience.isCurrent ? undefined : optional(experience.endDate),
        isCurrent: experience.isCurrent,
        description: optional(experience.description),
      })),
      education: value.education.map((entry) => ({
        institution: entry.institution.trim(),
        degree: optional(entry.degree),
        fieldOfStudy: optional(entry.fieldOfStudy),
        startDate: optional(entry.startDate),
        endDate: optional(entry.endDate),
        grade: optional(entry.grade),
        description: optional(entry.description),
      })),
      skills: value.skills.map((skill) => ({
        name: skill.name.trim(),
        category: optional(skill.category),
        proficiency: skill.proficiency ?? undefined,
      })),
    };
  }

  /** A new form pre-seeded with the rows the API requires; education is optional. */
  emptyForm(): CvForm {
    const form = this.buildForm();
    form.controls.experiences.push(this.experience());
    form.controls.skills.push(this.skill());
    return form;
  }
}
