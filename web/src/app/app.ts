import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly notifications = inject(NotificationService);
  readonly auth = inject(AuthService);

  readonly notices = this.notifications.notices;

  ngOnInit(): void {
    this.auth.restoreSession();
  }

  dismiss(id: number): void {
    this.notifications.dismiss(id);
  }
}
