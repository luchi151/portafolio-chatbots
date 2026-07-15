import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { SupportChatInterface } from './components/SupportChatInterface';

export const metadata = { title: 'Soporte RAG — Demo' };

export default function SupportPage() {
  return (
    <ErrorBoundary>
      <SupportChatInterface />
    </ErrorBoundary>
  );
}
