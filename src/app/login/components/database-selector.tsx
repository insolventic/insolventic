'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Database {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

const databases: Database[] = [
  {
    id: 'armonia',
    name: 'Armonia',
    description: 'Base de datos principal de Armonia',
    icon: '/images/toucan.png',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
  },
  {
    id: 'constructores-paz',
    name: 'Constructores de Paz',
    description: 'Base de datos de Constructores de Paz',
    icon: '/images/dove-of-peace.png',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
];

export function DatabaseSelector() {
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDatabaseSelect = async (databaseId: string) => {
    setIsLoading(true);
    setSelectedDatabase(databaseId);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    localStorage.setItem('selectedDatabase', databaseId);

    router.push(`/login?db=${databaseId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative h-[120px] w-[120px]">
              <Image
                src="/images/insolventic-logo.png"
                alt="INSOLVENTIC Logo"
                fill
                sizes="(max-width: 768px) 100vw, 120px"
                className="rounded-full object-cover shadow-lg"
              />
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-gray-900">INSOLVENTIC</h1>
          <p className="mb-2 text-xl text-gray-600">
            Sistema de Gestión de Procesos de Insolvencia
          </p>
          <Badge variant="outline" className="text-sm">
            Selección de Base de Datos
          </Badge>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-8 text-center">
            <CardTitle className="text-2xl text-gray-800">
              ¿A qué Base de Datos quieres ir?
            </CardTitle>
            <CardDescription className="text-lg">
              Selecciona la organización para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto grid max-w-2xl gap-8 md:grid-cols-2">
              {databases.map((database) => (
                <button
                  key={database.id}
                  type="button"
                  className={`group relative w-full cursor-pointer text-left transition-all duration-300 ${
                    selectedDatabase === database.id
                      ? 'scale-105'
                      : 'hover:scale-102'
                  }`}
                  onClick={() => void handleDatabaseSelect(database.id)}
                >
                  <Card
                    className={`h-full border-2 transition-all duration-300 ${
                      selectedDatabase === database.id
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    } ${database.bgColor}`}
                  >
                    <CardContent className="p-8 text-center">
                      {isLoading && selectedDatabase === database.id && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
                          <div className="flex flex-col items-center">
                            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                            <p className="text-sm text-gray-600">
                              Conectando...
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mb-6 flex justify-center">
                        <div className="relative">
                          <Image
                            src={database.icon || '/placeholder.svg'}
                            alt={`${database.name} Icon`}
                            width={80}
                            height={80}
                            className="transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>
                      </div>

                      <h3
                        className={`mb-2 text-xl font-bold ${database.color}`}
                      >
                        {database.name}
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        {database.description}
                      </p>

                      <Badge
                        variant="outline"
                        className={`${database.color} border-current`}
                      >
                        Disponible
                      </Badge>

                      {selectedDatabase === database.id && (
                        <div className="absolute top-4 right-4">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>

            <div className="mt-12 text-center">
              <div className="mx-auto max-w-2xl rounded-lg bg-blue-50 p-6">
                <h4 className="mb-2 font-semibold text-blue-900">
                  Información Importante
                </h4>
                <p className="text-sm text-blue-800">
                  Ambas bases de datos contienen la misma funcionalidad completa
                  del sistema INSOLVENTIC. La selección determina qué
                  organización y datos específicos se mostrarán en el sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © 2025 INSOLVENTIC - Sistema de Gestión de Procesos de Insolvencia
          </p>
        </div>
      </div>
    </div>
  );
}
