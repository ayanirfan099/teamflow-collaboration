import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@teamflow/database';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  color: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  boardCount?: number;
  taskCount?: number;
  completedTaskCount?: number;
}

export interface BoardDto {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  columnCount?: number;
  taskCount?: number;
}

export interface ColumnDto {
  id: string;
  organizationId: string;
  boardId: string;
  name: string;
  position: number;
  wipLimit: number | null;
  isDoneColumn: boolean;
  taskCount?: number;
}

const DEFAULT_COLUMNS = ['Backlog', 'In progress', 'In review', 'Done'];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(tenant: TenantContext, status: 'ACTIVE' | 'ARCHIVED' | 'ALL'): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(status === 'ALL' ? {} : { status }),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        _count: { select: { boards: true, tasks: true } },
        tasks: { where: { status: 'DONE' }, select: { id: true } },
      },
    });

    return projects.map((project) => ({
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      key: project.key,
      description: project.description,
      status: project.status as 'ACTIVE' | 'ARCHIVED',
      color: project.color,
      createdById: project.createdById,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      boardCount: project._count.boards,
      taskCount: project._count.tasks,
      completedTaskCount: project.tasks.length,
    }));
  }

  async get(tenant: TenantContext, projectId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: tenant.organizationId },
      include: {
        _count: { select: { boards: true, tasks: true } },
        tasks: { where: { status: 'DONE' }, select: { id: true } },
      },
    });
    if (!project) {
      throw AppException.notFound('project');
    }
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      key: project.key,
      description: project.description,
      status: project.status as 'ACTIVE' | 'ARCHIVED',
      color: project.color,
      createdById: project.createdById,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      boardCount: project._count.boards,
      taskCount: project._count.tasks,
      completedTaskCount: project.tasks.length,
    };
  }

  async create(
    tenant: TenantContext,
    input: { name: string; key: string; description?: string; color?: string; boardName?: string },
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.findFirst({
      where: { organizationId: tenant.organizationId, key: input.key },
    });
    if (existing) {
      throw AppException.conflict('duplicate', 'A project with this key already exists.');
    }

    const boardName = input.boardName?.trim() || 'Main board';
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          organizationId: tenant.organizationId,
          name: input.name,
          key: input.key,
          description: input.description ?? null,
          color: input.color ?? null,
          createdById: tenant.userId,
        },
      });

      const board = await tx.board.create({
        data: {
          organizationId: tenant.organizationId,
          projectId: created.id,
          name: boardName,
          isDefault: true,
        },
      });

      for (const [index, name] of DEFAULT_COLUMNS.entries()) {
        await tx.column.create({
          data: {
            organizationId: tenant.organizationId,
            boardId: board.id,
            name,
            position: index,
            isDoneColumn: name === 'Done',
          },
        });
      }

      return created;
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'PROJECT_CREATED',
      targetType: 'project',
      targetId: project.id,
      metadata: { name: project.name, key: project.key },
    });

    const dto = await this.get(tenant, project.id);
    this.realtime.emitToOrganization(tenant.organizationId, 'project.created', {
      project: dto,
      actorId: tenant.userId,
    });
    return dto;
  }

  async update(
    tenant: TenantContext,
    projectId: string,
    input: {
      name?: string;
      description?: string | null;
      color?: string | null;
      status?: 'ACTIVE' | 'ARCHIVED';
    },
  ): Promise<ProjectDto> {
    await this.get(tenant, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: input.status === 'ARCHIVED' ? 'PROJECT_ARCHIVED' : 'PROJECT_UPDATED',
      targetType: 'project',
      targetId: projectId,
      metadata: input as Record<string, unknown>,
    });

    const dto = await this.get(tenant, projectId);
    this.realtime.emitToOrganization(tenant.organizationId, 'project.updated', {
      project: dto,
      actorId: tenant.userId,
    });
    return dto;
  }

  async remove(tenant: TenantContext, projectId: string): Promise<void> {
    const project = await this.get(tenant, projectId);
    await this.prisma.project.delete({ where: { id: project.id } });
    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'PROJECT_DELETED',
      targetType: 'project',
      targetId: project.id,
      metadata: { name: project.name },
    });
    this.realtime.emitToOrganization(tenant.organizationId, 'project.deleted', {
      projectId: project.id,
      actorId: tenant.userId,
    });
  }

  async listBoards(tenant: TenantContext, projectId: string): Promise<BoardDto[]> {
    await this.get(tenant, projectId);
    const boards = await this.prisma.board.findMany({
      where: { organizationId: tenant.organizationId, projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { columns: true, tasks: true } } },
    });
    return boards.map((board) => ({
      id: board.id,
      organizationId: board.organizationId,
      projectId: board.projectId,
      name: board.name,
      description: board.description,
      isDefault: board.isDefault,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      columnCount: board._count.columns,
      taskCount: board._count.tasks,
    }));
  }

  async createBoard(
    tenant: TenantContext,
    projectId: string,
    input: {
      name: string;
      description?: string;
      isDefault?: boolean;
      columns?: Array<{ name: string; wipLimit?: number | null; isDoneColumn?: boolean }>;
    },
  ): Promise<BoardDto> {
    await this.get(tenant, projectId);
    const columns = input.columns ?? [
      { name: 'Backlog' },
      { name: 'In progress' },
      { name: 'Done', isDoneColumn: true },
    ];

    const board = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.board.updateMany({
          where: { organizationId: tenant.organizationId, projectId },
          data: { isDefault: false },
        });
      }
      const created = await tx.board.create({
        data: {
          organizationId: tenant.organizationId,
          projectId,
          name: input.name,
          description: input.description ?? null,
          isDefault: input.isDefault ?? false,
        },
      });
      for (const [index, column] of columns.entries()) {
        await tx.column.create({
          data: {
            organizationId: tenant.organizationId,
            boardId: created.id,
            name: column.name,
            position: index,
            wipLimit: column.wipLimit ?? null,
            isDoneColumn: column.isDoneColumn ?? false,
          },
        });
      }
      return created;
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'BOARD_CREATED',
      targetType: 'board',
      targetId: board.id,
      metadata: { name: board.name, projectId },
    });

    return {
      id: board.id,
      organizationId: board.organizationId,
      projectId: board.projectId,
      name: board.name,
      description: board.description,
      isDefault: board.isDefault,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
    };
  }

  async updateBoard(
    tenant: TenantContext,
    boardId: string,
    input: { name?: string; description?: string | null; isDefault?: boolean },
  ): Promise<BoardDto> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, organizationId: tenant.organizationId },
    });
    if (!board) {
      throw AppException.notFound('board');
    }
    if (input.isDefault) {
      await this.prisma.board.updateMany({
        where: { organizationId: tenant.organizationId, projectId: board.projectId },
        data: { isDefault: false },
      });
    }
    const updated = await this.prisma.board.update({
      where: { id: board.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
      },
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'BOARD_UPDATED',
      targetType: 'board',
      targetId: updated.id,
      metadata: input as Record<string, unknown>,
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      projectId: updated.projectId,
      name: updated.name,
      description: updated.description,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async listColumns(tenant: TenantContext, boardId: string): Promise<ColumnDto[]> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!board) {
      throw AppException.notFound('board');
    }
    const columns = await this.prisma.column.findMany({
      where: { organizationId: tenant.organizationId, boardId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
    return columns.map((column) => ({
      id: column.id,
      organizationId: column.organizationId,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      wipLimit: column.wipLimit,
      isDoneColumn: column.isDoneColumn,
      taskCount: column._count.tasks,
    }));
  }

  async createColumn(
    tenant: TenantContext,
    boardId: string,
    input: { name: string; wipLimit?: number | null; isDoneColumn?: boolean },
  ): Promise<ColumnDto> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!board) {
      throw AppException.notFound('board');
    }
    const last = await this.prisma.column.findFirst({
      where: { organizationId: tenant.organizationId, boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const column = await this.prisma.column.create({
      data: {
        organizationId: tenant.organizationId,
        boardId,
        name: input.name,
        position: (last?.position ?? -1) + 1,
        wipLimit: input.wipLimit ?? null,
        isDoneColumn: input.isDoneColumn ?? false,
      },
    });
    return {
      id: column.id,
      organizationId: column.organizationId,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      wipLimit: column.wipLimit,
      isDoneColumn: column.isDoneColumn,
    };
  }

  async updateColumn(
    tenant: TenantContext,
    columnId: string,
    input: { name?: string; wipLimit?: number | null; isDoneColumn?: boolean },
  ): Promise<ColumnDto> {
    const column = await this.prisma.column.findFirst({
      where: { id: columnId, organizationId: tenant.organizationId },
    });
    if (!column) {
      throw AppException.notFound('column');
    }
    const updated = await this.prisma.column.update({
      where: { id: column.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.wipLimit === undefined ? {} : { wipLimit: input.wipLimit }),
        ...(input.isDoneColumn === undefined ? {} : { isDoneColumn: input.isDoneColumn }),
      },
    });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      boardId: updated.boardId,
      name: updated.name,
      position: updated.position,
      wipLimit: updated.wipLimit,
      isDoneColumn: updated.isDoneColumn,
    };
  }

  async deleteColumn(tenant: TenantContext, columnId: string): Promise<void> {
    const column = await this.prisma.column.findFirst({
      where: { id: columnId, organizationId: tenant.organizationId },
      include: { _count: { select: { tasks: true } } },
    });
    if (!column) {
      throw AppException.notFound('column');
    }
    if (column._count.tasks > 0) {
      throw AppException.conflict(
        'conflict',
        'Move the tasks of this column to another column before deleting it.',
      );
    }
    await this.prisma.column.delete({ where: { id: column.id } });
  }

  /** Moves the columns of a board into the given order. */
  async reorderColumns(tenant: TenantContext, boardId: string, columnIds: string[]): Promise<void> {
    const columns = await this.prisma.column.findMany({
      where: { organizationId: tenant.organizationId, boardId },
      select: { id: true },
    });
    const known = new Set(columns.map((column) => column.id));
    if (columnIds.length !== known.size || columnIds.some((id) => !known.has(id))) {
      throw AppException.badRequest(
        'bad_request',
        'The list has to contain every column of the board exactly once.',
      );
    }
    await this.prisma.$transaction(
      columnIds.map((id, index) =>
        this.prisma.column.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  async listLabels(tenant: TenantContext) {
    const labels = await this.prisma.label.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
    });
    return labels.map((label) => ({
      id: label.id,
      organizationId: label.organizationId,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt.toISOString(),
    }));
  }

  async createLabel(tenant: TenantContext, input: { name: string; color: string }) {
    const existing = await this.prisma.label.findFirst({
      where: { organizationId: tenant.organizationId, name: input.name },
    });
    if (existing) {
      throw AppException.conflict('duplicate', 'A label with this name already exists.');
    }
    const label = await this.prisma.label.create({
      data: {
        organizationId: tenant.organizationId,
        name: input.name,
        color: input.color,
      },
    });
    return {
      id: label.id,
      organizationId: label.organizationId,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt.toISOString(),
    };
  }

  async deleteLabel(tenant: TenantContext, labelId: string): Promise<void> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, organizationId: tenant.organizationId },
    });
    if (!label) {
      throw AppException.notFound('label');
    }
    await this.prisma.label.delete({ where: { id: label.id } });
  }
}
