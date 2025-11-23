import { FileText, Users, Calendar, DollarSign } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

import type { CaseStats as CaseStatsType } from '@/features/case/schemas';

interface CaseStatsProps {
  stats: CaseStatsType;
}

export function CaseStats({ stats }: Readonly<CaseStatsProps>) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Casos</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Promedio por Caso
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.averageDebt)}
              </p>
            </div>
            <Users className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Acreedores
              </p>
              <p className="text-2xl font-bold">{stats.totalCreditors ?? 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monto Total</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.totalDebt)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
