import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { DBQueryInterface } from './components/DBQueryInterface';

export const metadata = { title: 'NL → SQL — Demo' };

export default function DbQueryPage() {
  return (
    <ErrorBoundary>
      <DBQueryInterface />
    </ErrorBoundary>
  );
}
