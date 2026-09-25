import Hero from '../components/Hero';
import { usePageMeta } from '../lib/usePageMeta';
import Library from '../components/Library';
import Subjects from '../components/Subjects';
import { HowItWorks, FinalCTA } from '../components/Closing';

export default function Landing() {
  // Fase 5.5: keeps the tab/OG title right after navigating back from a detail page (index.html
  // only supplies it on the very first load).
  usePageMeta({
    title: 'ilmNet — A quiet library for Islamic knowledge',
    description:
      'Lectures, books and scholarship in one calm, carefully organised library — arranged by scholar, subject and series. Free, no login, always linked to the original source.',
    path: '/',
  });

  return (
    <>
      <Hero />
      <Library />
      <Subjects />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
