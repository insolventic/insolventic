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
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/**
 * CRUD subset of notification types — emitted from
 * {@link createNotificationForAction}. Proactive alert types
 * (`hearing_upcoming`, `payment_overdue`) are excluded because they flow
 * through `alerts.ts` instead and have no `actionMap` entry.
 */
export const CRUD_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter(
  (t) => t !== 'hearing_upcoming' && t !== 'payment_overdue',
) as readonly Exclude<
  NotificationType,
  'hearing_upcoming' | 'payment_overdue'
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
