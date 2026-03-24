import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum([
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
  ]),
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

export const notificationTypeSchema = z.enum([
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
]);

export const getNotificationsInputSchema = z.object({
  userId: z.string().optional(),
  type: z
    .enum([
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
    ])
    .optional(),
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

export const getNotificationStatsOutputSchema = z.object({
  total: z.number(),
  byType: z.object({
    case_created: z.number(),
    case_updated: z.number(),
    case_deleted: z.number(),
    creditor_created: z.number(),
    creditor_updated: z.number(),
    creditor_deleted: z.number(),
    debtor_created: z.number(),
    debtor_updated: z.number(),
    debtor_deleted: z.number(),
    user_created: z.number(),
    user_updated: z.number(),
    user_deleted: z.number(),
    role_created: z.number(),
    role_updated: z.number(),
    role_deleted: z.number(),
  }),
});
