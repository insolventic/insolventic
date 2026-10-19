import { z } from 'zod';

/**
 * Canonical list of notification `type` values.
 *
 * Historical CRUD events (case/creditor/debtor/user/role × created/updated/deleted)
 * are emitted from {@link createNotificationForAction}.
 *
 * Proactive alerts (`hearing_upcoming`, `payment_overdue`) are emitted from the
 * cron-driven scanners in `src/features/notification/alerts.ts` — they are not
 * user-triggered, so they live side-by-side with the CRUD types but go through
 * their own pipeline.
 *
 * `document_generation` / `document_generation_failed` are emitted from
 * `src/features/document/generation-job.ts` al terminar un job de generación
 * en background — tampoco pasan por `createNotificationForAction`.
 *
 * `system` no la emite ningún flujo de negocio: es el valor genérico al que
 * `getNotifications` degrada una fila cuyo `type` en BD no reconoce (ver
 * ese archivo), para que una notificación con un type nuevo o corrupto no
 * tumbe toda la bandeja.
 */
export const NOTIFICATION_TYPES = [
  'case_created',
  'case_updated',
  'case_deleted',
  'creditor_created',
  'creditor_updated',
  'creditor_deleted',
  'debtor_created',
  'debtor_updated',
  'debtor_deleted',
  'user_created',
  'user_updated',
  'user_deleted',
  'role_created',
  'role_updated',
  'role_deleted',
  'hearing_upcoming',
  'payment_overdue',
  'document_generation',
  'document_generation_failed',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/**
 * Non-CRUD notification types — no pasan por {@link createNotificationForAction}
 * ni tienen entrada en su `actionMap`, cada una fluye por su propio emisor
 * (alertas proactivas, el job de generación, o el fallback genérico de lectura).
 */
const NON_CRUD_NOTIFICATION_TYPES = [
  'hearing_upcoming',
  'payment_overdue',
  'document_generation',
  'document_generation_failed',
  'system',
] as const;

export const CRUD_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter(
  (t) => !(NON_CRUD_NOTIFICATION_TYPES as readonly string[]).includes(t),
) as readonly Exclude<
  NotificationType,
  (typeof NON_CRUD_NOTIFICATION_TYPES)[number]
>[];

export type CrudNotificationType = (typeof CRUD_NOTIFICATION_TYPES)[number];

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  userId: z.string(),
  caseId: z.string().nullable(),
  relatedId: z.string().nullable(),
  read: z.boolean().default(false),
  createdDate: z.date(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationWithCaseSchema = notificationSchema.extend({
  case: z
    .object({
      id: z.string(),
      caseNumber: z.string(),
      debtorName: z.string(),
      type: z.string(),
    })
    .nullable(),
});

export type NotificationWithCase = z.infer<typeof notificationWithCaseSchema>;

export const createNotificationSchema = notificationSchema.omit({
  id: true,
  createdDate: true,
});

export type CreateNotificationData = z.infer<typeof createNotificationSchema>;

export const getNotificationsInputSchema = z.object({
  userId: z.string().optional(),
  type: notificationTypeSchema.optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const getNotificationsOutputSchema = z.object({
  notifications: z.array(notificationWithCaseSchema),
  total: z.number(),
});

export const deleteNotificationInputSchema = z.object({
  notificationId: z.string(),
});

export const deleteNotificationOutputSchema = z.object({
  success: z.boolean(),
});

export const getNotificationStatsInputSchema = z.object({
  userId: z.string().optional(),
});

/**
 * Stats breakdown by type. Uses a record keyed by NotificationType so that
 * adding a new notification type automatically extends the shape without
 * having to hand-type each key.
 */
export const getNotificationStatsOutputSchema = z.object({
  total: z.number(),
  byType: z.record(notificationTypeSchema, z.number()),
});
