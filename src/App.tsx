import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Lectures from './pages/Lectures';
import Books from './pages/Books';
import Scholars from './pages/Scholars';
import Subjects from './pages/Subjects';
import { AdminProvider } from './admin/store';
import AdminLayout from './admin/AdminLayout';
import Overview from './admin/Overview';
import LecturesPage from './admin/LecturesPage';
import LectureForm from './admin/LectureForm';
import BooksPage from './admin/BooksPage';
import BookForm from './admin/BookForm';
import ScholarsPage from './admin/ScholarsPage';
import ScholarForm from './admin/ScholarForm';
import SubjectsPage from './admin/SubjectsPage';
import SubjectForm from './admin/SubjectForm';
import ContentWizard from './admin/ContentWizard';
import ArchiveImportPage from './admin/ArchiveImportPage';
import YouTubeImportPage from './admin/YouTubeImportPage';
import LectureDetail from './pages/LectureDetail';
import BookDetail from './pages/BookDetail';

export default function App() {
  return (
    <HashRouter>
      <AdminProvider>
        <Routes>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="new" element={<ContentWizard />} />
            <Route path="archive-import" element={<ArchiveImportPage />} />
            <Route path="youtube-import" element={<YouTubeImportPage />} />
            <Route path="lectures" element={<LecturesPage />} />
            <Route path="lectures/new" element={<LectureForm />} />
            <Route path="lectures/:id" element={<LectureForm />} />
            <Route path="books" element={<BooksPage />} />
            <Route path="books/new" element={<BookForm />} />
            <Route path="books/:id" element={<BookForm />} />
            <Route path="scholars" element={<ScholarsPage />} />
            <Route path="scholars/new" element={<ScholarForm />} />
            <Route path="scholars/:id" element={<ScholarForm />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subjects/new" element={<SubjectForm />} />
            <Route path="subjects/:id" element={<SubjectForm />} />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="lectures" element={<Lectures />} />
            <Route path="lectures/:id" element={<LectureDetail />} />
            <Route path="books" element={<Books />} />
            <Route path="books/:id" element={<BookDetail />} />
            <Route path="scholars" element={<Scholars />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="*" element={<Landing />} />
          </Route>
        </Routes>
      </AdminProvider>
    </HashRouter>
  );
}
