import { inject, Injectable } from '@angular/core';
import { CvApiService } from './cv-api.service';
import { isApiRequestError } from '../models/api-error.model';

/** Triggers a browser download for a blob without leaving the page. */
@Injectable({ providedIn: 'root' })
export class PdfDownloadService {
  private readonly api = inject(CvApiService);

  download(cvId: number, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.downloadPdf(cvId).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          resolve();
        },
        error: (error: unknown) => {
          reject(
            isApiRequestError(error)
              ? error
              : Object.assign(new Error('Failed to generate the PDF'), { cause: error }),
          );
        },
      });
    });
  }
}
