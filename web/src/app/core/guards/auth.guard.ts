import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protects routes requiring authentication. Redirects to /login if unauthenticated. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() || auth.token()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
