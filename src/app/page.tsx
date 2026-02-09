import { DatabaseSelector } from './login/components/database-selector';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <DatabaseSelector />
    </div>
  );
}
