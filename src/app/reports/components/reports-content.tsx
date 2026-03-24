'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardHeader } from '@/app/dashboard/components/dashboard-header';

import { CaseStatusReport } from './case-status-report';
import { FinancialReport } from './financial-report';

export function ReportsContent() {
  return (
    <div className="bg-muted min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Reportes</h1>
            <p className="text-muted-foreground">
              Reportes y análisis por tipo de servicio
            </p>
          </div>

          <Tabs defaultValue="status" className="space-y-4">
            <TabsList>
              <TabsTrigger value="status">Estado de Casos</TabsTrigger>
              <TabsTrigger value="financial">Resumen Financiero</TabsTrigger>
            </TabsList>

            <TabsContent value="status">
              <CaseStatusReport />
            </TabsContent>
            <TabsContent value="financial">
              <FinancialReport />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
