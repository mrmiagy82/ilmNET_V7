// ilmNet API client — talks to Fastify+Prisma backend at /api
// When running via `vite dev`, requests are proxied to http://localhost:3001 (see vite.config.ts)
// In production set VITE_API_URL to the backend origin.

const BASE = (import.meta as any).env?.VITE_API_URL ?? "";
const ADMIN_TOKEN = (import.meta as any).env?.VITE_ADMIN_TOKEN ?? "";

// ── helpers ──
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const baseHeaders: Record<string, string> = {};
  if (opts.body) baseHeaders["Content-Type"] = "application/json";
  if (ADMIN_TOKEN && path.startsWith("/api/admin")) {
    baseHeaders["x-admin-token"] = ADMIN_TOKEN;
  }
  const res = await fetch(url, {
    headers: { ...baseHeaders, ...((opts.headers as Record<string, string>) ?? {}) },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as any)?.error?.message ?? (body as any)?.error?.details ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body as T;
}

// ── raw backend shapes ──
export type BackendContent = {
  id: string;
  type: "lecture" | "book" | "audio" | "video" | "document";
  title: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  language: string | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  series: string | null;
  provider: "youtube" | "archive" | "external" | "google_books" | "pdf";
  sourceUrl: string;
  externalIdentifier: string | null;
  embedUrl: string | null;
  collectionIdentifier: string | null;
  collectionTitle: string | null;
  durationMin: number | null;
  episodes: number | null;
  pages: number | null;
  year: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: any;
  scholars: { scholarId: string; scholar: BackendScholar }[];
  subjects: { subjectId: string; subject: BackendSubject }[];
};

export type BackendScholar = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  specialtyId: string | null;
  bio: string | null;
  accent: "rose" | "olive";
  status: "published" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type BackendSubject = {
  id: string;
  slug: string;
  name: string;
  group: "Revelation" | "Practice" | "Belief" | "History" | "Language" | "Character";
  description: string | null;
  accent: "rose" | "olive" | "plain";
  status: "published" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
};

// ── paginated wrappers ──
type Paginated<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
type Single<T> = { data: T };

// ── Contents ──
export function listAdminContents(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Paginated<BackendContent>>(`/api/admin/contents${suffix}`);
}
export function listPublishedContents(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Paginated<BackendContent>>(`/api/contents${suffix}`);
}
export function getAdminContent(idOrSlug: string) {
  return apiFetch<Single<BackendContent>>(`/api/admin/contents/${encodeURIComponent(idOrSlug)}`);
}
export function createContent(payload: Record<string, any>) {
  return apiFetch<Single<BackendContent>>(`/api/admin/contents`, { method: "POST", body: JSON.stringify(payload) });
}
export function patchContent(id: string, patch: Record<string, any>) {
  return apiFetch<Single<BackendContent>>(`/api/admin/contents/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteContent(id: string, hard = false) {
  const qs = hard ? "?hard=true" : "";
  return apiFetch<{ data: any }>(`/api/admin/contents/${encodeURIComponent(id)}${qs}`, { method: "DELETE" });
}
export function publishContent(id: string) {
  return apiFetch<Single<BackendContent>>(`/api/admin/contents/${encodeURIComponent(id)}/publish`, { method: "POST" });
}
export function unpublishContent(id: string) {
  return apiFetch<Single<BackendContent>>(`/api/admin/contents/${encodeURIComponent(id)}/unpublish`, { method: "POST" });
}

// ── Scholars ──
export function listAdminScholars() {
  return apiFetch<{ data: BackendScholar[] }>(`/api/admin/scholars`);
}
export function createScholar(payload: Record<string, any>) {
  return apiFetch<Single<BackendScholar>>(`/api/admin/scholars`, { method: "POST", body: JSON.stringify(payload) });
}
export function patchScholar(id: string, patch: Record<string, any>) {
  return apiFetch<Single<BackendScholar>>(`/api/admin/scholars/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteScholar(id: string) {
  return apiFetch<{ data: any }>(`/api/admin/scholars/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Subjects ──
export function listAdminSubjects() {
  return apiFetch<{ data: BackendSubject[] }>(`/api/admin/subjects`);
}
export function createSubject(payload: Record<string, any>) {
  return apiFetch<Single<BackendSubject>>(`/api/admin/subjects`, { method: "POST", body: JSON.stringify(payload) });
}
export function patchSubject(id: string, patch: Record<string, any>) {
  return apiFetch<Single<BackendSubject>>(`/api/admin/subjects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteSubject(id: string) {
  return apiFetch<{ data: any }>(`/api/admin/subjects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Archive imports ──
export type ArchivePreviewResponse = {
  jobId: string;
  sourceUrl: string;
  identifier: string;
  title: string;
  description?: string;
  totalItems: number;
  items: import('@/admin/data').ArchiveDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'archive';
  kindsSummary: Record<string, number>;
};
export function previewArchive(sourceUrl: string) {
  return apiFetch<ArchivePreviewResponse>(`/api/admin/imports/archive/preview`, {
    method: 'POST',
    body: JSON.stringify({ sourceUrl }),
  });
}
export function confirmArchive(jobId: string, drafts: import('@/admin/data').ArchiveImportDraft[]) {
  const items = drafts.map((d) => ({
    identifier: d.detected.identifier,
    selected: d.selected,
    customTitle: d.customTitle,
    customDescription: d.customDescription,
    contentType: d.contentType,
    scholarIds: d.scholarIds,
    subjectIds: d.subjectIds,
    language: d.language,
    series: d.series,
    category: d.category,
    status: d.status,
  }));
  return apiFetch<{ jobId: string; summary: { totalFound: number; totalRequested: number; created: number; duplicates: number; errors: number; skipped: number }; results: Array<{ identifier: string; status: string; contentId?: string; slug?: string; message?: string }> }>(
    `/api/admin/imports/archive/confirm`,
    { method: 'POST', body: JSON.stringify({ jobId, items }) }
  );
}


// ── YouTube imports ──
export type YouTubePreviewResponse = {
  jobId: string;
  sourceUrl: string;
  identifier: string;
  title: string;
  description?: string;
  totalItems: number;
  items: import('@/admin/data').YouTubeDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'youtube';
  kindsSummary: Record<string, number>;
};
export function previewYouTube(sourceUrl: string) {
  return apiFetch<YouTubePreviewResponse>(`/api/admin/imports/youtube/preview`, {
    method: 'POST',
    body: JSON.stringify({ sourceUrl }),
  });
}
export function confirmYouTube(jobId: string, drafts: import('@/admin/data').YouTubeImportDraft[]) {
  const items = drafts.map((d) => ({
    identifier: d.detected.identifier,
    selected: d.selected,
    customTitle: d.customTitle,
    customDescription: d.customDescription,
    contentType: d.contentType,
    scholarIds: d.scholarIds,
    subjectIds: d.subjectIds,
    language: d.language,
    series: d.series,
    category: d.category,
    status: d.status,
  }));
  return apiFetch<{ jobId: string; summary: { totalFound: number; totalRequested: number; created: number; duplicates: number; errors: number; skipped: number }; results: Array<{ identifier: string; status: string; contentId?: string; slug?: string; message?: string }> }>(
    `/api/admin/imports/youtube/confirm`,
    { method: 'POST', body: JSON.stringify({ jobId, items }) }
  );
}


// ── Public Scholars / Subjects (only published visible, but we fetch all and filter counts on frontend) ──
export function listPublicScholars() {
  return apiFetch<{ data: BackendScholar[] }>(`/api/scholars`);
}
export function getPublicScholar(idOrSlug: string) {
  return apiFetch<{ data: BackendScholar & { contents?: any[] } }>(`/api/scholars/${encodeURIComponent(idOrSlug)}`);
}
export function listPublicSubjects() {
  return apiFetch<{ data: BackendSubject[] }>(`/api/subjects`);
}
export function getPublicSubject(idOrSlug: string) {
  return apiFetch<{ data: BackendSubject }>(`/api/subjects/${encodeURIComponent(idOrSlug)}`);
}
export function getPublishedContent(idOrSlug: string) {
  return apiFetch<Single<BackendContent>>(`/api/contents/${encodeURIComponent(idOrSlug)}`);
}

// ── Health ──
export function health() {
  return apiFetch<{ status: string; service: string }>(`/api/health`);
}

// ── Mappers: BackendContent <-> AdminLecture/AdminBook ──
import type { AdminBook, AdminLecture, PublishStatus } from "@/admin/data";

export function backendToAdminLecture(c: BackendContent): AdminLecture {
  const scholarIds = c.scholars.map((s) => s.scholarId);
  const ytUrl = c.provider === "youtube" ? c.sourceUrl : "";
  return {
    id: c.id,
    title: c.title,
    youtubeUrl: ytUrl,
    sourceType: c.provider === "youtube" && c.embedUrl?.includes("videoseries") ? "youtube-playlist" : "youtube-video",
    provider: (c.provider === "archive" ? "archive" : c.provider === "youtube" ? "youtube" : "external") as any,
    sourceUrl: c.sourceUrl,
    archiveIdentifier: c.externalIdentifier ?? c.collectionIdentifier ?? undefined,
    mediaTypes: (c.metadata?.archive?.available_media as string[]) ?? undefined,
    scholarId: scholarIds[0] ?? "",
    scholarIds,
    subjectIds: c.subjects.map((s) => s.subjectId),
    description: c.description ?? "",
    series: c.series ?? "",
    format: (c as any).format ?? (c.type === "audio" ? "Audio" : "Video"),
    level: (c as any).level ?? "Beginner",
    // geen kunstmatige 30 — null betekent onbekend (DB: null)
    durationMin: (c.durationMin ?? null) as any,
    episodes: c.episodes ?? 1,
    status: (c.status === "published" ? "published" : "draft") as PublishStatus,
    updatedAt: new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    coverUrl: c.coverUrl ?? undefined,
    language: c.language ?? "English",
    tags: (c.metadata?.tags as string[]) ?? [],
  };
}

export function backendToAdminBook(c: BackendContent): AdminBook {
  const scholarIds = c.scholars.map((s) => s.scholarId);
  const provMap: Record<string, any> = { archive: "archive", google_books: "google-books", pdf: "pdf", external: "external", youtube: "external" };
  return {
    id: c.id,
    title: c.title,
    archiveUrl: c.sourceUrl,
    sourceUrl: c.sourceUrl,
    sourceType: (provMap[c.provider] ?? "archive") as any,
    provider: (provMap[c.provider] ?? "archive") as any,
    archiveIdentifier: c.externalIdentifier ?? undefined,
    mediaTypes: (c.metadata?.archive?.available_media as string[]) ?? undefined,
    scholarId: scholarIds[0] ?? "",
    scholarIds,
    subjectIds: c.subjects.map((s) => s.subjectId),
    description: c.description ?? "",
    format: (c as any).format ?? "Translation",
    // geen kunstmatige 120 — null betekent onbekend (DB: null)
    pages: (c.pages ?? null) as any,
    year: c.year ?? new Date().getFullYear(),
    status: (c.status === "published" ? "published" : "draft") as PublishStatus,
    updatedAt: new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    coverUrl: c.coverUrl ?? undefined,
    publisher: (c.metadata?.publisher as string) ?? c.collectionTitle ?? undefined,
    language: c.language ?? "English",
    isbn: (c.metadata?.isbn as string) ?? undefined,
    tags: (c.metadata?.tags as string[]) ?? [],
  };
}

// Build payload for createContent from admin forms
export function adminLectureToPayload(l: AdminLecture): Record<string, any> {
  const isArchive = (l as any).provider === "archive";
  return {
    // type resolved via spread below — no artificial default
    ...(() => {
      if (isArchive) {
        if (l.format === "Audio") return { type: "audio" };
        if (l.format === "Video") return { type: "video" };
        return { type: "lecture" };
      }
      return { type: "lecture" as const };
    })(),
    title: l.title,
    description: l.description,
    status: l.status,
    language: l.language,
    thumbnailUrl: l.thumbnailUrl || null,
    coverUrl: l.coverUrl || null,
    series: l.series || null,
    provider: isArchive ? "archive" : "youtube",
    sourceUrl: isArchive ? (l as any).sourceUrl || l.youtubeUrl : l.youtubeUrl || (l as any).sourceUrl,
    externalIdentifier: (l as any).archiveIdentifier || null,
    collectionIdentifier: null,
    collectionTitle: null,
    durationMin: l.durationMin || null,
    episodes: l.episodes || null,
    scholarIds: l.scholarIds?.length ? l.scholarIds : l.scholarId ? [l.scholarId] : [],
    subjectIds: l.subjectIds,
    metadata: l.tags?.length ? { tags: l.tags } : null,
  };
}

export function adminBookToPayload(b: AdminBook): Record<string, any> {
  const providerMap: Record<string, string> = { archive: "archive", "google-books": "google_books", pdf: "pdf", external: "external" };
  const prov = providerMap[b.sourceType ?? b.provider ?? "archive"] ?? "archive";
  const typeMap: Record<string, any> = { archive: "book", "google_books": "book", pdf: "document", external: "document" };
  return {
    type: (typeMap[b.sourceType ?? "archive"] ?? "book") as any,
    title: b.title,
    description: b.description,
    status: b.status,
    language: b.language,
    thumbnailUrl: null,
    coverUrl: b.coverUrl || null,
    series: null,
    provider: prov,
    sourceUrl: b.sourceUrl || b.archiveUrl,
    externalIdentifier: (b as any).archiveIdentifier || null,
    pages: b.pages || null,
    year: b.year || null,
    scholarIds: b.scholarIds?.length ? b.scholarIds : b.scholarId ? [b.scholarId] : [],
    subjectIds: b.subjectIds,
    metadata: { ...(b.publisher ? { publisher: b.publisher } : {}), ...(b.isbn ? { isbn: b.isbn } : {}), ...(b.tags?.length ? { tags: b.tags } : {}) },
  };
}
