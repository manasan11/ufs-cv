import { Injectable, signal } from '@angular/core';

export type NoticeTone = 'success' | 'error' | 'info';

export interface Notice {
  id: number;
  tone: NoticeTone;
  message: string;
}

const DEFAULT_DURATION_MS = 5000;

/** Lightweight toast queue used to report API outcomes. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly noticesSignal = signal<Notice[]>([]);

  readonly notices = this.noticesSignal.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message, 8000);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.noticesSignal.update((notices) => notices.filter((notice) => notice.id !== id));
  }

  private push(tone: NoticeTone, message: string, durationMs = DEFAULT_DURATION_MS): void {
    const notice: Notice = { id: this.nextId++, tone, message };
    this.noticesSignal.update((notices) => [...notices, notice]);
    setTimeout(() => this.dismiss(notice.id), durationMs);
  }
}
