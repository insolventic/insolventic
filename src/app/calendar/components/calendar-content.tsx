'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DashboardHeader } from '@/app/dashboard/components/dashboard-header';
import { getHearings, type Hearing } from '@/features/calendar/actions';

import { HearingCard } from './hearing-card';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarContent() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchHearings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getHearings({ month, year });
      if (result.success && result.data) {
        setHearings(result.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchHearings();
  }, [fetchHearings]);

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  // getDay() returns 0=Sunday, adjust for Monday start
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const hearingsByDay: Record<number, Hearing[]> = {};
  for (const h of hearings) {
    const d = new Date(h.date).getDate();
    if (!hearingsByDay[d]) hearingsByDay[d] = [];
    hearingsByDay[d].push(h);
  }

  const selectedHearings = selectedDay
    ? (hearingsByDay[selectedDay] ?? [])
    : [];

  return (
    <div className="bg-muted min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-foreground text-3xl font-bold">
              Calendario de Audiencias
            </h1>
            <p className="text-muted-foreground">
              Audiencias programadas por mes
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Calendar grid */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle>
                    {MONTH_NAMES[month - 1]} {year}
                  </CardTitle>
                  <Button variant="outline" size="icon" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_NAMES.map((d) => (
                      <div
                        key={d}
                        className="text-muted-foreground py-2 text-center text-xs font-medium"
                      >
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const hasHearings = !!hearingsByDay[day];
                      const isToday =
                        day === now.getDate() &&
                        month === now.getMonth() + 1 &&
                        year === now.getFullYear();
                      const isSelected = selectedDay === day;

                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`relative rounded-md p-2 text-center text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : isToday
                                ? 'bg-accent font-bold'
                                : 'hover:bg-accent/50'
                          }`}
                        >
                          {day}
                          {hasHearings && (
                            <span
                              className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                                isSelected
                                  ? 'bg-primary-foreground'
                                  : 'bg-violet-500'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hearing details panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedDay
                    ? `${selectedDay} de ${MONTH_NAMES[month - 1]}`
                    : 'Seleccione un día'}
                </CardTitle>
                <CardDescription>
                  {selectedDay
                    ? `${selectedHearings.length} audiencia(s)`
                    : 'Haga clic en un día para ver audiencias'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedHearings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedHearings.map((h) => (
                      <HearingCard key={h.id} hearing={h} />
                    ))}
                  </div>
                ) : selectedDay ? (
                  <p className="text-muted-foreground text-sm">
                    No hay audiencias este día.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Monthly summary */}
          {hearings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Resumen del Mes ({hearings.length} audiencias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hearings.map((h) => (
                    <HearingCard key={h.id} hearing={h} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
