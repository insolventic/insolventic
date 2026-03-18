'use client';

import { Bell, FileText, Users, Building, FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';

import { Task } from './task';

export function TaskSelector() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const router = useRouter();
  const { checkPermission } = useAuth();

  const handleTaskClick = (id: string, route: string) => {
    setSelectedTask(id);
    router.push(route);
  };

  const tasks = [
    {
      id: 1,
      title: 'Gestión de Casos',
      description: 'Revisar y actualizar casos activos',
      icon: FileText,
      href: '/cases',
      color: 'bg-blue-100',
      iconColor: 'text-primary',
      stats: { active: 41, pending: 5, total: 46 },
      permission: P.VER_CASOS,
      helpText:
        'Administra los procesos de insolvencia, crea nuevos casos, consulta su estado y realiza el seguimiento completo de cada expediente.',
    },
    {
      id: 2,
      title: 'Gestión de Usuarios y permisos',
      description: 'Administrar usuarios del sistema',
      icon: Users,
      href: '/users',
      color: 'bg-purple-100',
      iconColor: 'text-purple-600',
      stats: { total: 4, active: 3 },
      permission: P.VER_USUARIOS,
      helpText:
        'Crea usuarios, asigna roles y controla los permisos de acceso dentro del sistema según su función.',
    },
    {
      id: 3,
      title: 'Gestión de Acreedores',
      description: 'Gestionar entidades financieras',
      icon: Building,
      href: '/creditors',
      color: 'bg-green-100',
      iconColor: 'text-green-600 dark:text-green-400',
      stats: { total: 4, active: 3 },
      permission: P.VER_ACREEDORES,
      helpText:
        'Registra y administra la información de los acreedores asociados a cada caso de insolvencia.',
    },
    {
      id: 4,
      title: 'Gestión de Deudores',
      description: 'Personas en proceso de insolvencia',
      icon: Users,
      href: '/debtors',
      color: 'bg-orange-100',
      iconColor: 'text-orange-600',
      stats: { total: 3, active: 3 },
      permission: P.VER_DEUDORES,
      helpText:
        'Gestiona los datos de los deudores, su información personal y su relación con los casos activos.',
    },
    {
      id: 5,
      title: 'Documentos',
      description: 'Gestionar documentos legales',
      icon: FileSearch,
      href: '/documents',
      color: 'bg-red-100',
      iconColor: 'text-red-600',
      stats: { total: 156, recent: 12 },
      permission: P.VER_DOCUMENTOS,
      helpText:
        'Genera, consulta y administra los documentos legales asociados a cada proceso de insolvencia.',
    },
    {
      id: 8,
      title: 'Notificaciones',
      description: 'Centro de notificaciones',
      icon: Bell,
      href: '/notifications',
      color: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      stats: { unread: 7, total: 45 },
      permission: P.VER_NOTIFICACIONES,
      helpText:
        'Recibe alertas y notificaciones importantes sobre cambios, eventos y estados de los casos.',
    },
  ];

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>Selector de Tareas</CardTitle>
        <CardDescription>
          Seleccione la tarea que desea realizar según su rol y permisos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {tasks
            .filter((task) => checkPermission(task.permission))
            .map((task) => (
              <Task
                key={task.id}
                title={task.title}
                description={task.description}
                icon={task.icon}
                color={task.color}
                iconColor={task.iconColor}
                selected={selectedTask === task.id.toString()}
                helpText={task.helpText}
                onClick={() => handleTaskClick(task.id.toString(), task.href)}
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
