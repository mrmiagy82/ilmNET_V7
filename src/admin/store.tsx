import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  todayStamp,
  uid,
  type Activity,
  type AdminBook,
  type AdminLecture,
  type AdminScholar,
  type AdminSubject,
  type PublishStatus,
} from './data';
import * as api from '@/lib/api';

type Kind = Activity['kind'];

interface AdminStore {
  lectures: AdminLecture[];
  books: AdminBook[];
  scholars: AdminScholar[];
  subjects: AdminSubject[];
  activity: Activity[];
  notice: string | null;
  apiOnline: boolean;
  loading: boolean;
  clearNotice: () => void;
  flash: (msg: string) => void;
  refresh: () => Promise<void>;
  upsertLecture: (item: AdminLecture, verb: Activity['verb']) => void;
  deleteLecture: (id: string) => void;
  setLectureStatus: (id: string, status: PublishStatus) => void;
  upsertBook: (item: AdminBook, verb: Activity['verb']) => void;
  deleteBook: (id: string) => void;
  setBookStatus: (id: string, status: PublishStatus) => void;
  upsertScholar: (item: AdminScholar, verb: Activity['verb']) => void;
  deleteScholar: (id: string) => void;
  setScholarStatus: (id: string, status: PublishStatus) => void;
  upsertSubject: (item: AdminSubject, verb: Activity['verb']) => void;
  deleteSubject: (id: string) => void;
  setSubjectStatus: (id: string, status: PublishStatus) => void;
}

const Ctx = createContext<AdminStore | null>(null);

function log(verb: Activity['verb'], kind: Kind, title: string): Activity {
  return { id: uid('act'), at: todayStamp(), verb, kind, title };
}

function toAdminScholar(s: api.BackendScholar): AdminScholar {
  return {
    id: s.id,
    name: s.name,
    initials: s.initials,
    specialtyId: s.specialtyId ?? '',
    bio: s.bio ?? '',
    accent: s.accent as any,
    status: (s.status === 'published' ? 'published' : 'draft') as PublishStatus,
    updatedAt: new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}
function toAdminSubject(s: api.BackendSubject): AdminSubject {
  return {
    id: s.id,
    name: s.name,
    group: s.group as any,
    description: s.description ?? '',
    accent: s.accent as any,
    status: (s.status === 'published' ? 'published' : 'draft') as PublishStatus,
    updatedAt: new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [scholars, setScholars] = useState<AdminScholar[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  // Activity reflects real actions in this session only — never seeded with demo entries.
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const push = (entry: Activity) => setActivity((prev) => [entry, ...prev].slice(0, 14));
  const flash = (msg: string) => setNotice(msg);

  const refresh = async () => {
    try {
      const [schRes, subRes, contRes] = await Promise.all([
        api.listAdminScholars().catch(() => null),
        api.listAdminSubjects().catch(() => null),
        api.listAdminContents({ limit: 100 }).catch(() => null),
      ]);
      if (schRes && subRes && contRes) {
        // map scholars/subjects
        setScholars(schRes.data.map(toAdminScholar));
        setSubjects(subRes.data.map(toAdminSubject));
        const all = contRes.data as api.BackendContent[];
        const lecTypes = new Set(['lecture', 'audio', 'video']);
        const bookTypes = new Set(['book', 'document']);
        const l: AdminLecture[] = [];
        const b: AdminBook[] = [];
        for (const c of all) {
          if (lecTypes.has(c.type)) l.push(api.backendToAdminLecture(c));
          else if (bookTypes.has(c.type)) b.push(api.backendToAdminBook(c));
          else {
            // fallback: if provider youtube => lecture else book
            if (c.provider === 'youtube') l.push(api.backendToAdminLecture(c));
            else b.push(api.backendToAdminBook(c));
          }
        }
        // sort by updatedAt desc (backend already)
        setLectures(l);
        setBooks(b);
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // wrappers removed — direct API calls handle fallback per action

  const offline = (what: string) =>
    flash(`${what} failed — the backend is unreachable. Nothing was written to the database.`);
  const failure = (what: string, e: any) =>
    flash(`${what} failed — ${e?.message ?? 'API error'}. Nothing was written to the database.`);

  const value = useMemo<AdminStore>(
    () => ({
      lectures,
      books,
      scholars,
      subjects,
      activity,
      notice,
      apiOnline,
      loading,
      clearNotice: () => setNotice(null),
      flash,
      refresh,
      upsertLecture: (item, verb) => {
        const isNew = !lectures.find((x) => x.id === item.id);
        if (!apiOnline) return offline('Saving');
        const before = lectures;
        const doLocal = () => {
          setLectures((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'lecture', item.title));
        };
        doLocal(); // optimistic — reverted below if the write fails
        (async () => {
          try {
            const payload = api.adminLectureToPayload(item);
            if (isNew) {
              await api.createContent(payload);
              flash('Lecture saved to database.');
            } else {
              await api.patchContent(item.id, { ...payload, title: item.title });
              flash('Lecture updated in database.');
            }
            await refresh();
          } catch (e: any) {
            setLectures(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteLecture: (id) => {
        if (!apiOnline) return offline('Deleting');
        const item = lectures.find((x) => x.id === id);
        const before = lectures;
        setLectures((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'lecture', item.title));
        flash('Lecture removed.');
        api
          .deleteContent(id, true)
          .then(() => refresh())
          .catch((e: any) => {
            setLectures(before);
            failure('Deleting', e);
          });
      },
      setLectureStatus: (id, status) => {
        if (!apiOnline) return offline('Publishing');
        const item = lectures.find((x) => x.id === id);
        const before = lectures;
        setLectures((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'lecture', item.title));
          flash(status === 'published' ? 'Lecture published.' : 'Lecture unpublished.');
        }
        const fn = status === 'published' ? api.publishContent : api.unpublishContent;
        fn(id)
          .then(() => refresh())
          .catch(async () => {
            try {
              await api.patchContent(id, { status });
              await refresh();
            } catch (e: any) {
              setLectures(before);
              failure('Changing the status', e);
            }
          });
      },
      upsertBook: (item, verb) => {
        const isNew = !books.find((x) => x.id === item.id);
        if (!apiOnline) return offline('Saving');
        const before = books;
        const doLocal = () => {
          setBooks((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'book', item.title));
        };
        doLocal();
        (async () => {
          try {
            const payload = api.adminBookToPayload(item);
            if (isNew) {
              await api.createContent(payload);
              flash('Book saved to database.');
            } else {
              await api.patchContent(item.id, { ...payload, title: item.title });
              flash('Book updated in database.');
            }
            await refresh();
          } catch (e: any) {
            setBooks(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteBook: (id) => {
        if (!apiOnline) return offline('Deleting');
        const item = books.find((x) => x.id === id);
        const before = books;
        setBooks((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'book', item.title));
        flash('Book removed.');
        api
          .deleteContent(id, true)
          .then(() => refresh())
          .catch((e: any) => {
            setBooks(before);
            failure('Deleting', e);
          });
      },
      setBookStatus: (id, status) => {
        if (!apiOnline) return offline('Publishing');
        const item = books.find((x) => x.id === id);
        const before = books;
        setBooks((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'book', item.title));
          flash(status === 'published' ? 'Book published.' : 'Book unpublished.');
        }
        const fn = status === 'published' ? api.publishContent : api.unpublishContent;
        fn(id)
          .then(() => refresh())
          .catch(async () => {
            try {
              await api.patchContent(id, { status });
              await refresh();
            } catch (e: any) {
              setBooks(before);
              failure('Changing the status', e);
            }
          });
      },
      upsertScholar: (item, verb) => {
        const isNew = !scholars.find((x) => x.id === item.id);
        if (!apiOnline) return offline('Saving');
        const before = scholars;
        const doLocal = () => {
          setScholars((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'scholar', item.name));
        };
        if (!isNew) doLocal();
        (async () => {
          try {
            const payload = { name: item.name, bio: item.bio, accent: item.accent, specialtyId: item.specialtyId || null };
            if (isNew) {
              await api.createScholar(payload);
              flash('Scholar saved to database.');
            } else {
              await api.patchScholar(item.id, payload);
              flash('Scholar updated in database.');
            }
            push(log(verb, 'scholar', item.name));
            await refresh();
          } catch (e: any) {
            setScholars(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteScholar: (id) => {
        if (!apiOnline) return offline('Deleting');
        const item = scholars.find((x) => x.id === id);
        const before = scholars;
        setScholars((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'scholar', item.name));
        flash('Scholar removed.');
        api
          .deleteScholar(id)
          .then(() => refresh())
          .catch((e: any) => {
            setScholars(before);
            failure('Deleting', e);
          });
      },
      setScholarStatus: (id, status) => {
        if (!apiOnline) return offline('Publishing');
        const item = scholars.find((x) => x.id === id);
        const before = scholars;
        setScholars((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'scholar', item.name));
          flash(status === 'published' ? 'Scholar published.' : 'Scholar unpublished.');
        }
        api
          .patchScholar(id, { status })
          .then(() => refresh())
          .catch((e: any) => {
            setScholars(before);
            failure('Changing the status', e);
          });
      },
      upsertSubject: (item, verb) => {
        const isNew = !subjects.find((x) => x.id === item.id);
        if (!apiOnline) return offline('Saving');
        const before = subjects;
        const doLocal = () => {
          setSubjects((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'subject', item.name));
        };
        if (!isNew) doLocal();
        (async () => {
          try {
            const payload = { name: item.name, group: item.group, description: item.description, accent: item.accent };
            if (isNew) {
              await api.createSubject(payload);
              flash('Subject saved to database.');
            } else {
              await api.patchSubject(item.id, payload);
              flash('Subject updated in database.');
            }
            push(log(verb, 'subject', item.name));
            await refresh();
          } catch (e: any) {
            setSubjects(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteSubject: (id) => {
        if (!apiOnline) return offline('Deleting');
        const item = subjects.find((x) => x.id === id);
        const before = subjects;
        setSubjects((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'subject', item.name));
        flash('Subject removed.');
        api
          .deleteSubject(id)
          .then(() => refresh())
          .catch((e: any) => {
            setSubjects(before);
            failure('Deleting', e);
          });
      },
      setSubjectStatus: (id, status) => {
        if (!apiOnline) return offline('Publishing');
        const item = subjects.find((x) => x.id === id);
        const before = subjects;
        setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'subject', item.name));
          flash(status === 'published' ? 'Subject published.' : 'Subject unpublished.');
        }
        api
          .patchSubject(id, { status })
          .then(() => refresh())
          .catch((e: any) => {
            setSubjects(before);
            failure('Changing the status', e);
          });
      },
    }),
    [lectures, books, scholars, subjects, activity, notice, apiOnline, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
