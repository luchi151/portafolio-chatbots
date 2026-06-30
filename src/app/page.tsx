import { Navbar } from '@/components/marketing/Navbar';
import { Hero } from '@/components/marketing/Hero';
import { DemoCardsSection } from '@/components/marketing/DemoCardsSection';
import { TechStack } from '@/components/marketing/TechStack';
import { Footer } from '@/components/marketing/Footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DemoCardsSection />
        <TechStack />
      </main>
      <Footer />
    </>
  );
}
