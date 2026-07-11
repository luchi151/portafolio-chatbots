import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCsatStats,
  getDbQueryStats,
  getDailyActivity,
  getDemoCounts,
  getEscalationStats,
  getToolUsage,
} from '@/lib/db/analytics-queries';
import { StatsCards } from './components/StatsCards';
import { ActivityChart } from './components/ActivityChart';
import { ToolUsageChart } from './components/ToolUsageChart';

// Must reflect live activity, not a build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const [demoCounts, dailyActivity, toolUsage, dbStats, escalationStats, csatStats] = await Promise.all([
    getDemoCounts(),
    getDailyActivity(),
    getToolUsage(),
    getDbQueryStats(),
    getEscalationStats(),
    getCsatStats(),
  ]);

  return (
    <>
      <Navbar />
      <main className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-3 text-center text-2xl font-bold sm:text-3xl">Analytics</h1>
          <p className="mb-10 text-center text-muted-foreground">
            Actividad real de las demos interactivas — cobranza, voz y consultas en lenguaje natural
          </p>

          <div className="flex flex-col gap-6">
            <StatsCards
              demoCounts={demoCounts}
              toolUsage={toolUsage}
              dbStats={dbStats}
              escalationStats={escalationStats}
              csatStats={csatStats}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Actividad diaria (últimos 21 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityChart data={dailyActivity} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Herramientas del agente más usadas</CardTitle>
              </CardHeader>
              <CardContent>
                <ToolUsageChart data={toolUsage} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
