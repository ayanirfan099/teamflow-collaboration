'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend, type Envelope } from './api';
import type {
  BoardDto,
  ColumnDto,
  LabelDto,
  MemberDto,
  NotificationDto,
  OrganizationDto,
  ProjectDto,
  TaskDto,
} from '@teamflow/contracts';

export interface ListMeta {
  limit?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  unreadCount?: number;
}

export function useProjects(organizationId: string | null) {
  return useQuery({
    queryKey: ['projects', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<ProjectDto[]>(`/organizations/${organizationId}/projects`);
      return response.data;
    },
  });
}

export function useProject(organizationId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ['project', organizationId, projectId],
    enabled: Boolean(organizationId && projectId),
    queryFn: async () => {
      const response = await apiGet<ProjectDto>(
        `/organizations/${organizationId}/projects/${projectId}`,
      );
      return response.data;
    },
  });
}

export function useBoards(organizationId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ['boards', organizationId, projectId],
    enabled: Boolean(organizationId && projectId),
    queryFn: async () => {
      const response = await apiGet<BoardDto[]>(
        `/organizations/${organizationId}/projects/${projectId}/boards`,
      );
      return response.data;
    },
  });
}

export function useColumns(organizationId: string | null, boardId: string | null) {
  return useQuery({
    queryKey: ['columns', organizationId, boardId],
    enabled: Boolean(organizationId && boardId),
    queryFn: async () => {
      const response = await apiGet<ColumnDto[]>(
        `/organizations/${organizationId}/boards/${boardId}/columns`,
      );
      return response.data;
    },
  });
}

export interface TaskListQuery {
  boardId?: string;
  projectId?: string;
  columnId?: string;
  q?: string;
  status?: 'open' | 'done' | 'all';
  limit?: number;
  cursor?: string;
}

export function useTasks(organizationId: string | null, query: TaskListQuery) {
  return useQuery({
    queryKey: ['tasks', organizationId, query],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<TaskDto[]>(`/organizations/${organizationId}/tasks`, {
        query: {
          boardId: query.boardId,
          projectId: query.projectId,
          columnId: query.columnId,
          q: query.q,
          status: query.status,
          limit: query.limit,
          cursor: query.cursor,
        },
      });
      return response;
    },
  });
}

export function useTask(organizationId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: ['task', organizationId, taskId],
    enabled: Boolean(organizationId && taskId),
    queryFn: async () => {
      const response = await apiGet<TaskDto>(`/organizations/${organizationId}/tasks/${taskId}`);
      return response.data;
    },
  });
}

export function useMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ['members', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<MemberDto[]>(`/organizations/${organizationId}/members`);
      return response.data;
    },
  });
}

export function useLabels(organizationId: string | null) {
  return useQuery({
    queryKey: ['labels', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<LabelDto[]>(`/organizations/${organizationId}/labels`);
      return response.data;
    },
  });
}

export function useNotifications(organizationId: string | null) {
  return useQuery({
    queryKey: ['notifications', organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await apiGet<NotificationDto[]>(
        `/organizations/${organizationId}/notifications`,
      );
      return response as Envelope<NotificationDto[]> & { meta?: ListMeta };
    },
  });
}

export interface DashboardData {
  assigned: TaskDto[];
  overdue: number;
  dueSoon: number;
  recentlyCompleted: number;
  projects: Array<{
    id: string;
    name: string;
    key: string;
    color: string | null;
    totalTasks: number;
    completedTasks: number;
    progress: number;
  }>;
}

export function useDashboard(organizationId: string | null) {
  return useQuery({
    queryKey: ['dashboard', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<DashboardData>(`/organizations/${organizationId}/dashboard`);
      return response.data;
    },
  });
}

export interface CommentDto {
  id: string;
  organizationId: string;
  taskId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  mentions: Array<{ id: string; name: string; email: string }>;
  createdAt: string;
  updatedAt: string;
}

export function useComments(organizationId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: ['comments', organizationId, taskId],
    enabled: Boolean(organizationId && taskId),
    queryFn: async () => {
      const response = await apiGet<CommentDto[]>(
        `/organizations/${organizationId}/tasks/${taskId}/comments`,
      );
      return response.data;
    },
  });
}

export interface ActivityDto {
  id: string;
  organizationId: string;
  projectId: string | null;
  taskId: string | null;
  type: string;
  actorId: string;
  actorName: string;
  summary: string;
  createdAt: string;
}

export function useActivity(organizationId: string | null, taskId?: string) {
  return useQuery({
    queryKey: ['activity', organizationId, taskId ?? 'organization'],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await apiGet<ActivityDto[]>(
        taskId
          ? `/organizations/${organizationId}/tasks/${taskId}/activity`
          : `/organizations/${organizationId}/activity`,
      );
      return response.data;
    },
  });
}

/**
 * Moves a task optimistically: the cache is updated first and rolled back when the request
 * fails, so the board stays responsive.
 */
export function useMoveTask(organizationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      columnId: string;
      afterTaskId: string | null;
      version: number;
    }) => {
      const response = await apiSend<TaskDto>(
        `/organizations/${organizationId}/tasks/${input.taskId}/move`,
        'POST',
        {
          columnId: input.columnId,
          afterTaskId: input.afterTaskId,
          version: input.version,
        },
      );
      return response.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', organizationId] });
      const previous = queryClient.getQueriesData({ queryKey: ['tasks', organizationId] });

      queryClient.setQueriesData<Envelope<TaskDto[]> & { meta?: ListMeta }>(
        { queryKey: ['tasks', organizationId] },
        (current) => {
          if (!current?.data) {
            return current;
          }
          return {
            ...current,
            data: current.data.map((task) =>
              task.id === input.taskId
                ? { ...task, columnId: input.columnId, version: task.version + 1 }
                : task,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', organizationId] });
    },
  });
}

export function useUpdateTask(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; body: Record<string, unknown> }) => {
      const response = await apiSend<TaskDto>(
        `/organizations/${organizationId}/tasks/${input.taskId}`,
        'PATCH',
        input.body,
      );
      return response.data;
    },
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['task', organizationId, task.id] });
    },
  });
}

export function useCreateTask(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const response = await apiSend<TaskDto>(
        `/organizations/${organizationId}/tasks`,
        'POST',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', organizationId] });
    },
  });
}

export function useCreateComment(organizationId: string | null, taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const response = await apiSend<CommentDto>(
        `/organizations/${organizationId}/tasks/${taskId}/comments`,
        'POST',
        { body },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', organizationId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['activity', organizationId] });
    },
  });
}

export function useMarkNotificationsRead(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids?: string[]; all?: boolean }) => {
      const response = await apiSend<{ updated: number }>(
        `/organizations/${organizationId}/notifications/read`,
        'POST',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', organizationId] });
    },
  });
}

export function useCreateProject(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; key: string; description?: string }) => {
      const response = await apiSend<ProjectDto>(
        `/organizations/${organizationId}/projects`,
        'POST',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', organizationId] });
    },
  });
}

export function useInviteMember(organizationId: string | null) {
  return useMutation({
    mutationFn: async (input: { email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }) => {
      const response = await apiSend<{ id: string; acceptUrl: string }>(
        `/organizations/${organizationId}/invitations`,
        'POST',
        input,
      );
      return response.data;
    },
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await apiGet<OrganizationDto[]>('/organizations');
      return response.data;
    },
  });
}
