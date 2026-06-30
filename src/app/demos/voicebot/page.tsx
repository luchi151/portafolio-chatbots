import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { VoicebotInterface } from './components/VoicebotInterface';

export const metadata = { title: 'Voicebot — Demo' };

export default function VoicebotPage() {
  return (
    <ErrorBoundary>
      <VoicebotInterface />
    </ErrorBoundary>
  );
}
