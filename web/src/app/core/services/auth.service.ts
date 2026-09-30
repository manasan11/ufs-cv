import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthUser } from '../models/cv.model';
import { TOKEN_STORAGE_KEY } from './auth.interceptor';
import { CvApiService } from './cv-api.service';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // The session simply will not survive a refresh if storage is unavailable.
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/** Client-side session state; the API remains the source of truth. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(CvApiService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly tokenSignal = signal<string | null>(readStoredToken());

  readonly user = this.userSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  register(input: { fullName: string; email: string; password: string }) {
    return this.api.register(input).pipe(tap((result) => this.storeSession(result)));
  }

  login(input: { email: string; password: string }) {
    return this.api.login(input).pipe(tap((result) => this.storeSession(result)));
  }

  /** Revalidates a stored token on start-up, clearing it if it is no longer valid. */
  restoreSession(): void {
    if (!this.tokenSignal()) return;

    this.api.me().subscribe({
      next: (user) => this.userSignal.set(user),
      error: () => this.logout(),
    });
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  private storeSession(result: { token: string; user: AuthUser }): void {
    this.tokenSignal.set(result.token);
    this.userSignal.set(result.user);
    storeToken(result.token);
  }

  private clearSession(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    clearToken();
  }
}
