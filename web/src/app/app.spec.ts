import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('hides primary navigation links when not authenticated', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('CV Generator');
    expect(text).not.toContain('CVs');
    expect(text).not.toContain('Add User');
  });

  it('renders primary navigation links when authenticated', () => {
    const fixture = TestBed.createComponent(App);
    const auth = TestBed.inject(AuthService);
    // Simulate authenticated user
    (auth as any).userSignal.set({ id: 1, email: 'user@example.com', fullName: 'Test User' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('CV Generator');
    expect(text).toContain('CVs');
    expect(text).toContain('Add User');
  });
});
