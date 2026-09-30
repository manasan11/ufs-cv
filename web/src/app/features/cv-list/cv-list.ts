import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CvSort, CvSummary, PageMeta } from '../../core/models/cv.model';
import { isApiRequestError } from '../../core/models/api-error.model';
import { CvApiService } from '../../core/services/cv-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { PdfDownloadService } from '../../core/services/pdf-download.service';
import { slugifyName } from '../../core/utils/filename';

const PAGE_SIZES = [5, 10, 25] as const;

const EMPTY_META: PageMeta = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

@Component({
  selector: 'app-cv-list',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './cv-list.html',
  styleUrl: './cv-list.scss',
})
export class CvListComponent implements OnInit {
  private readonly api = inject(CvApiService);
  private readonly notifications = inject(NotificationService);
  private readonly pdf = inject(PdfDownloadService);

  readonly rows = signal<CvSummary[]>([]);
  readonly meta = signal<PageMeta>(EMPTY_META);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly sort = signal<CvSort>('-createdAt');
  readonly pageSize = signal(10);
  readonly pageSizes = PAGE_SIZES;
  readonly pendingId = signal<number | null>(null);
  readonly pdfId = signal<number | null>(null);

  readonly pageNumbers = computed(() => {
    const { page, totalPages } = this.meta();
    if (totalPages <= 1) return [];

    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);

    const numbers: number[] = [];
    for (let index = start; index <= end; index += 1) numbers.push(index);
    return numbers;
  });

  private currentPage = 1;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.load(1);
  }

  load(page: number): void {
    this.currentPage = page;
    this.loading.set(true);

    this.api
      .list({
        page,
        limit: this.pageSize(),
        search: this.search().trim(),
        sort: this.sort(),
      })
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.notifications.error(
            isApiRequestError(error) ? error.message : 'Could not load the CV list',
          );
        },
      });
  }

  onSearchInput(value: string): void {
    this.search.set(value);

    // Debounce so each keystroke does not fire a request.
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 300);
  }

  onSortChange(value: CvSort): void {
    this.sort.set(value);
    this.load(1);
  }

  onPageSizeChange(value: number): void {
    this.pageSize.set(value);
    this.load(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.meta().totalPages || page === this.currentPage) return;
    this.load(page);
  }

  generatePdf(row: CvSummary): void {
    this.pdfId.set(row.id);
    this.pdf
      .download(row.id, `${slugifyName(row.fullName)}.pdf`)
      .then(() => this.notifications.success(`Generated ${row.fullName}'s CV`))
      .catch((error: unknown) =>
        this.notifications.error(
          isApiRequestError(error) ? error.message : 'Could not generate the PDF',
        ),
      )
      .finally(() => this.pdfId.set(null));
  }

  remove(row: CvSummary): void {
    const confirmed = window.confirm(
      `Delete the CV for ${row.fullName}? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.pendingId.set(row.id);
    this.api.remove(row.id).subscribe({
      next: () => {
        this.pendingId.set(null);
        this.notifications.success(`Deleted ${row.fullName}'s CV`);

        const { page, totalPages } = this.meta();
        const remaining = this.rows().length - 1;
        const nextPage = remaining === 0 && page > 1 ? page - 1 : page;
        this.load(nextPage > totalPages ? Math.max(1, totalPages) : nextPage);
      },
      error: (error: unknown) => {
        this.pendingId.set(null);
        this.notifications.error(
          isApiRequestError(error) ? error.message : 'Could not delete the CV',
        );
      },
    });
  }

  trackById(_index: number, row: CvSummary): number {
    return row.id;
  }
}
