import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CvFormFactory, EducationForm, ExperienceForm, SkillForm } from '../../core/forms/cv-form.factory';
import { isApiRequestError } from '../../core/models/api-error.model';
import { CvApiService } from '../../core/services/cv-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { PdfDownloadService } from '../../core/services/pdf-download.service';
import { slugifyName } from '../../core/utils/filename';

@Component({
  selector: 'app-cv-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cv-form.html',
  styleUrl: './cv-form.scss',
})
export class CvFormComponent implements OnInit {
  private readonly api = inject(CvApiService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly pdf = inject(PdfDownloadService);
  private readonly forms = inject(CvFormFactory);

  /** Bound from the route by withComponentInputBinding. */
  readonly id = input<string | undefined>(undefined);

  readonly form = this.forms.emptyForm();
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly isEdit = computed(() => this.id() !== undefined);

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;

    this.loading.set(true);
    this.api.getById(Number(id)).subscribe({
      next: (response) => {
        this.forms.patch(this.form, response.data);
        this.loading.set(false);
        this.form.markAllAsTouched();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.notifications.error(
          isApiRequestError(error) ? error.message : 'Could not load that CV',
        );
        void this.router.navigate(['/cvs']);
      },
    });
  }

  get experiences(): FormArray<ExperienceForm> {
    return this.form.controls.experiences;
  }

  get education(): FormArray<EducationForm> {
    return this.form.controls.education;
  }

  get skills(): FormArray<SkillForm> {
    return this.form.controls.skills;
  }

  addExperience(): void {
    this.experiences.push(this.forms.experience());
  }

  removeExperience(index: number): void {
    // The API requires at least one experience entry.
    if (this.experiences.length <= 1) {
      this.notifications.info('A CV needs at least one experience entry');
      return;
    }
    this.experiences.removeAt(index);
  }

  addEducation(): void {
    this.education.push(this.forms.education());
  }

  removeEducation(index: number): void {
    this.education.removeAt(index);
  }

  addSkill(): void {
    this.skills.push(this.forms.skill());
  }

  removeSkill(index: number): void {
    // The API requires at least one skill.
    if (this.skills.length <= 1) {
      this.notifications.info('A CV needs at least one skill');
      return;
    }
    this.skills.removeAt(index);
  }

  save(): void {
    this.form.markAllAsTouched();
    this.serverErrors.set({});

    if (this.form.invalid) {
      this.notifications.error('Please fix the highlighted fields');
      this.focusFirstInvalid();
      return;
    }

    this.saving.set(true);
    const payload = this.forms.toPayload(this.form);
    const id = this.id();

    const request = id
      ? this.api.update(Number(id), payload)
      : this.api.create(payload);

    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.notifications.success(
          id ? 'CV updated' : `Created ${response.data.personal.fullName}'s CV`,
        );
        void this.router.navigate(['/cvs']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.handleError(error);
      },
    });
  }

  generatePdf(): void {
    const id = this.id();
    if (!id) {
      this.notifications.info('Save the CV before generating a PDF');
      return;
    }

    this.generating.set(true);
    const name = this.form.controls.personal.controls.fullName.value || 'cv';

    this.pdf
      .download(Number(id), `${slugifyName(name)}.pdf`)
      .then(() => this.notifications.success('PDF generated'))
      .catch((error: unknown) =>
        this.notifications.error(
          isApiRequestError(error) ? error.message : 'Could not generate the PDF',
        ),
      )
      .finally(() => this.generating.set(false));
  }

  cancel(): void {
    void this.router.navigate(['/cvs']);
  }

  controlInvalid(group: FormGroup, name: string): boolean {
    const control = group.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private handleError(error: unknown): void {
    if (!isApiRequestError(error)) {
      this.notifications.error('Something went wrong while saving');
      return;
    }

    this.notifications.error(error.message);

    if (error.isValidation) {
      this.serverErrors.set(error.issuesByField);
      this.form.markAllAsTouched();
    }
  }

  private focusFirstInvalid(): void {
    const element = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    element?.focus();
  }
}
