import { z } from 'zod';
import { idSchema } from './common';

export const ROOM_KINDS = ['org', 'project', 'task'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const roomJoinRequestSchema = z.object({
  room: z.string().regex(/^(org|project|task):[0-9a-fA-F-]{36}$/, 'Malformed room name'),
});

export const socketErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const taskCreatedEventSchema = z.object({
  task: z.unknown(),
  actorId: idSchema,
});

export const taskUpdatedEventSchema = z.object({
  task: z.unknown(),
  actorId: idSchema,
});

export const taskMovedEventSchema = z.object({
  taskId: idSchema,
  boardId: idSchema,
  columnId: idSchema,
  task: z.unknown(),
  actorId: idSchema,
});

export const commentCreatedEventSchema = z.object({
  comment: z.unknown(),
  actorId: idSchema,
});

export const notificationCreatedEventSchema = z.object({
  notification: z.unknown(),
});

export const presenceUpdatedEventSchema = z.object({
  userId: idSchema,
  taskId: idSchema,
  online: z.boolean(),
});

export type RoomJoinRequest = z.infer<typeof roomJoinRequestSchema>;
export type SocketError = z.infer<typeof socketErrorSchema>;
