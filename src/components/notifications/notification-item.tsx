import React from 'react';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  User,
  UserCheck,
  Shield,
  Calendar,
  AlertTriangle,
  FileCheck,
  FileX,
} from 'lucide-react';
import { NotificationWithCase } from '@/features/notification/schemas';

interface NotificationItemProps {
  notification: NotificationWithCase;
  variant?: 'dashboard' | 'full';
  className?: string;
  onMarkRead?: (id: string) => void;
}

const getNotificationTypeIcon = (type: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    case_created: Plus,
    case_updated: Edit,
    case_deleted: Trash2,

    creditor_created: Plus,
    creditor_updated: Edit,
    creditor_deleted: Trash2,

    debtor_created: Plus,
    debtor_updated: Edit,
    debtor_deleted: Trash2,

    user_created: UserCheck,
    user_updated: User,
    user_deleted: Trash2,

    role_created: Shield,
    role_updated: Shield,
    role_deleted: Trash2,

    // Proactive alerts
    hearing_upcoming: Calendar,
    payment_overdue: AlertTriangle,

    // Generación de documentos
    document_generation: FileCheck,
    document_generation_failed: FileX,
  };

  return iconMap[type] || Bell;
};

const getNotificationTypeColor = (type: string) => {
  if (type === 'hearing_upcoming') {
    return {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      icon: 'text-amber-600 dark:text-amber-400',
    };
  } else if (type === 'payment_overdue' || type === 'document_generation_failed') {
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      icon: 'text-red-600 dark:text-red-400',
    };
  } else if (type === 'document_generation') {
    return {
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-600 dark:text-green-400',
    };
  } else if (type.includes('_created')) {
    return {
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-600 dark:text-green-400',
    };
  } else if (type.includes('_updated')) {
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400',
    };
  } else if (type.includes('_deleted')) {
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      icon: 'text-red-600 dark:text-red-400',
    };
  } else {
    return {
      bg: 'bg-muted',
      icon: 'text-muted-foreground',
    };
  }
};

const formatRelativeDate = (date: Date) => {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return 'Hace menos de 1 hora';
  } else if (diffInHours < 24) {
    return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
  } else {
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  }
};

const formatAbsoluteDate = (date: Date) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export function NotificationItem({
  notification,
  variant = 'full',
  className = '',
  onMarkRead,
}: Readonly<NotificationItemProps>) {
  const IconComponent = getNotificationTypeIcon(notification.type);
  const colors = getNotificationTypeColor(notification.type);
  const isDashboard = variant === 'dashboard';
  const isUnread = !notification.read;

  const handleClick = () => {
    if (isUnread && onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start ${isDashboard ? 'space-x-3' : 'space-x-4'} bg-card rounded-lg border ${isDashboard ? 'p-3' : 'p-4'} transition-colors ${isDashboard ? 'hover:bg-muted' : 'border-border'} ${isUnread ? 'border-primary/30 bg-primary/5' : 'opacity-75'} ${onMarkRead && isUnread ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="shrink-0">
        <div
          className={`flex ${isDashboard ? 'h-8 w-8' : 'h-10 w-10'} items-center justify-center rounded-full ${colors.bg}`}
        >
          <IconComponent
            className={`${isDashboard ? 'h-4 w-4' : 'h-5 w-5'} ${colors.icon}`}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <h4
            className={`${isDashboard ? 'truncate' : ''} text-foreground text-sm font-medium`}
          >
            {notification.title}
          </h4>
        </div>
        <p
          className={`mb-2 ${isDashboard ? 'text-xs' : 'text-sm'} text-muted-foreground`}
        >
          {notification.message}
        </p>
        <p className="text-muted-foreground text-xs">
          {isDashboard
            ? formatRelativeDate(notification.createdDate)
            : formatAbsoluteDate(notification.createdDate)}
        </p>
      </div>
    </div>
  );
}
