import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { isApiRequestError } from '../../core/models/api-error.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './auth.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly submitting = signal(false);
  readonly formError = signal('');

  readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    });

  submit(): void {
    this.form.markAllAsTouched();
    this.formError.set('');

    const { fullName, email, password, confirmPassword } = this.form.getRawValue();

    if (password !== confirmPassword) {
      this.form.controls.confirmPassword.setErrors({ mismatch: true });
      this.formError.set('The passwords do not match');
      return;
    }

    if (this.form.invalid) return;

    this.submitting.set(true);
    this.auth.register({ fullName, email, password }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.notifications.success(`Account created for ${result.user.email}`);
        void this.router.navigate(['/cvs']);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.formError.set(
          isApiRequestError(error) ? error.message : 'Could not create the account',
        );
      },
    });
  }
}
