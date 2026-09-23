import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  seedActivity,
  seedBooks,
  seedLectures,
  seedScholars,
  seedSubjects,
  todayStamp,
  uid,
  type Activity,
  type AdminBook,
  type AdminLecture,
  type AdminScholar,
  type AdminSubject,
  type PublishStatus,
} from './data';

type Kind = Activity['kind'];

interface AdminStore {
  lectures: AdminLecture[];
  books: AdminBook[];
  scholars: AdminScholar[];
  subjects: AdminSubject[];
  activity: Activity[];
  notice: string | null;
  clearNotice: () => void;
  flash: (msg: string) => void;
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

export function AdminProvider({ children }: { children: ReactNode }) {
  const [lectures, setLectures] = useState(seedLectures);
  const [books, setBooks] = useState(seedBooks);
  const [scholars, setScholars] = useState(seedScholars);
  const [subjects, setSubjects] = useState(seedSubjects);
  const [activity, setActivity] = useState(seedActivity);
  const [notice, setNotice] = useState<string | null>(null);

  const push = (entry: Activity) => setActivity((prev) => [entry, ...prev].slice(0, 14));
  const flash = (msg: string) => setNotice(msg);

  const value = useMemo<AdminStore>(
    () => ({
      lectures,
      books,
      scholars,
      subjects,
      activity,
      notice,
      clearNotice: () => setNotice(null),
      flash,
      upsertLecture: (item, verb) => {
        setLectures((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        push(log(verb, 'lecture', item.title));
        flash(verb === 'Added' ? 'Lecture saved.' : 'Lecture updated.');
      },
      deleteLecture: (id) => {
        const item = lectures.find((x) => x.id === id);
        setLectures((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'lecture', item.title));
        flash('Lecture removed.');
      },
      setLectureStatus: (id, status) => {
        const item = lectures.find((x) => x.id === id);
        setLectures((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'lecture', item.title));
          flash(status === 'published' ? 'Lecture published.' : 'Lecture unpublished.');
        }
      },
      upsertBook: (item, verb) => {
        setBooks((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        push(log(verb, 'book', item.title));
        flash(verb === 'Added' ? 'Book saved.' : 'Book updated.');
      },
      deleteBook: (id) => {
        const item = books.find((x) => x.id === id);
        setBooks((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'book', item.title));
        flash('Book removed.');
      },
      setBookStatus: (id, status) => {
        const item = books.find((x) => x.id === id);
        setBooks((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'book', item.title));
          flash(status === 'published' ? 'Book published.' : 'Book unpublished.');
        }
      },
      upsertScholar: (item, verb) => {
        setScholars((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        push(log(verb, 'scholar', item.name));
        flash(verb === 'Added' ? 'Scholar saved.' : 'Scholar updated.');
      },
      deleteScholar: (id) => {
        const item = scholars.find((x) => x.id === id);
        setScholars((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'scholar', item.name));
        flash('Scholar removed.');
      },
      setScholarStatus: (id, status) => {
        const item = scholars.find((x) => x.id === id);
        setScholars((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'scholar', item.name));
          flash(status === 'published' ? 'Scholar published.' : 'Scholar unpublished.');
        }
      },
      upsertSubject: (item, verb) => {
        setSubjects((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        push(log(verb, 'subject', item.name));
        flash(verb === 'Added' ? 'Subject saved.' : 'Subject updated.');
      },
      deleteSubject: (id) => {
        const item = subjects.find((x) => x.id === id);
        setSubjects((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'subject', item.name));
        flash('Subject removed.');
      },
      setSubjectStatus: (id, status) => {
        const item = subjects.find((x) => x.id === id);
        setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'subject', item.name));
          flash(status === 'published' ? 'Subject published.' : 'Subject unpublished.');
        }
      },
    }),
    [lectures, books, scholars, subjects, activity, notice]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
