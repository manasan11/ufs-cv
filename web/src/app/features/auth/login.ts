import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { isApiRequestError } from '../../core/models/api-error.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './auth.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly submitting = signal(false);
  readonly formError = signal('');

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    this.formError.set('');

    if (this.form.invalid) return;

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login({ email, password }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.notifications.success(`Welcome back, ${result.user.fullName}`);
        void this.router.navigate(['/cvs']);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.formError.set(
          isApiRequestError(error) ? error.message : 'Could not sign in',
        );
      },
    });
  }
}
