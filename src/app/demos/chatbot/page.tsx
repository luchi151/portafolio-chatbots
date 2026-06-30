import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ChatInterface } from './components/ChatInterface';

export const metadata = { title: 'Chatbot RAG — Demo' };

export default function ChatbotPage() {
  return (
    <ErrorBoundary>
      <ChatInterface />
    </ErrorBoundary>
  );
}
