import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  AuthConfig,
  AuthResult,
  AuthUser,
  Cv,
  CvPayload,
  CvSort,
  CvSummary,
  DataResponse,
  PaginatedResponse,
} from '../models/cv.model';

const API_BASE = '/api';

export interface ListCvsParams {
  page: number;
  limit: number;
  search: string;
  sort: CvSort;
}

@Injectable({ providedIn: 'root' })
export class CvApiService {
  private readonly http = inject(HttpClient);

  list(params: ListCvsParams): Observable<PaginatedResponse<CvSummary>> {
    let query = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit)
      .set('sort', params.sort);

    if (params.search) query = query.set('search', params.search);

    return this.http.get<PaginatedResponse<CvSummary>>(`${API_BASE}/cvs`, { params: query });
  }

  getById(id: number): Observable<DataResponse<Cv>> {
    return this.http.get<DataResponse<Cv>>(`${API_BASE}/cvs/${id}`);
  }

  create(payload: CvPayload): Observable<DataResponse<Cv>> {
    return this.http.post<DataResponse<Cv>>(`${API_BASE}/cvs`, payload);
  }

  update(id: number, payload: CvPayload): Observable<DataResponse<Cv>> {
    return this.http.put<DataResponse<Cv>>(`${API_BASE}/cvs/${id}`, payload);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/cvs/${id}`);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${API_BASE}/cvs/${id}/pdf`, { responseType: 'blob' });
  }

  authConfig(): Observable<AuthConfig> {
    return this.http
      .get<DataResponse<AuthConfig>>(`${API_BASE}/auth/config`)
      .pipe(map((response) => response.data));
  }

  register(input: { fullName: string; email: string; password: string }): Observable<AuthResult> {
    return this.http
      .post<DataResponse<AuthResult>>(`${API_BASE}/auth/register`, input)
      .pipe(map((response) => response.data));
  }

  login(input: { email: string; password: string }): Observable<AuthResult> {
    return this.http
      .post<DataResponse<AuthResult>>(`${API_BASE}/auth/login`, input)
      .pipe(map((response) => response.data));
  }

  me(): Observable<AuthUser> {
    return this.http.get<DataResponse<AuthUser>>(`${API_BASE}/auth/me`).pipe(map((r) => r.data));
  }
}
