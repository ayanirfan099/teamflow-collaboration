import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createBoardRequestSchema,
  createColumnRequestSchema,
  createLabelRequestSchema,
  createProjectRequestSchema,
  labelQuerySchema,
  projectQuerySchema,
  reorderColumnRequestSchema,
  updateBoardRequestSchema,
  updateColumnRequestSchema,
  updateProjectRequestSchema,
} from '@teamflow/contracts';
import { Idempotent, RequireCapability, Tenant } from '../../common/decorators';
import { parse } from '../../common/validation/parse';
import { TenantContext } from '../../common/types';
import { ProjectsService } from './projects.service';

@Controller('organizations/:organizationId')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  @RequireCapability('project:read')
  async list(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    const params = parse(projectQuerySchema, query);
    return { data: await this.projects.list(tenant, params.status) };
  }

  @Post('projects')
  @Idempotent()
  @RequireCapability('project:create')
  async create(@Tenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(createProjectRequestSchema, body);
    return { data: await this.projects.create(tenant, input) };
  }

  @Get('projects/:projectId')
  @RequireCapability('project:read')
  async get(@Tenant() tenant: TenantContext, @Param('projectId') projectId: string) {
    return { data: await this.projects.get(tenant, projectId) };
  }

  @Patch('projects/:projectId')
  @RequireCapability('project:update')
  async update(
    @Tenant() tenant: TenantContext,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateProjectRequestSchema, body);
    return { data: await this.projects.update(tenant, projectId, input) };
  }

  @Delete('projects/:projectId')
  @RequireCapability('project:delete')
  async remove(@Tenant() tenant: TenantContext, @Param('projectId') projectId: string) {
    await this.projects.remove(tenant, projectId);
    return { data: { id: projectId, deleted: true } };
  }

  @Get('projects/:projectId/boards')
  @RequireCapability('board:read')
  async boards(@Tenant() tenant: TenantContext, @Param('projectId') projectId: string) {
    return { data: await this.projects.listBoards(tenant, projectId) };
  }

  @Post('projects/:projectId/boards')
  @RequireCapability('board:write')
  async createBoard(
    @Tenant() tenant: TenantContext,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = parse(createBoardRequestSchema, body);
    return { data: await this.projects.createBoard(tenant, projectId, input) };
  }

  @Patch('boards/:boardId')
  @RequireCapability('board:write')
  async updateBoard(
    @Tenant() tenant: TenantContext,
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateBoardRequestSchema, body);
    return { data: await this.projects.updateBoard(tenant, boardId, input) };
  }

  @Get('boards/:boardId/columns')
  @RequireCapability('board:read')
  async columns(@Tenant() tenant: TenantContext, @Param('boardId') boardId: string) {
    return { data: await this.projects.listColumns(tenant, boardId) };
  }

  @Post('boards/:boardId/columns')
  @RequireCapability('column:write')
  async createColumn(
    @Tenant() tenant: TenantContext,
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const input = parse(createColumnRequestSchema, body);
    return { data: await this.projects.createColumn(tenant, boardId, input) };
  }

  @Patch('columns/:columnId')
  @RequireCapability('column:write')
  async updateColumn(
    @Tenant() tenant: TenantContext,
    @Param('columnId') columnId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateColumnRequestSchema, body);
    return { data: await this.projects.updateColumn(tenant, columnId, input) };
  }

  @Delete('columns/:columnId')
  @RequireCapability('column:write')
  async deleteColumn(@Tenant() tenant: TenantContext, @Param('columnId') columnId: string) {
    await this.projects.deleteColumn(tenant, columnId);
    return { data: { id: columnId, deleted: true } };
  }

  @Post('boards/:boardId/columns/reorder')
  @RequireCapability('column:write')
  async reorderColumns(
    @Tenant() tenant: TenantContext,
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const input = parse(reorderColumnRequestSchema, body);
    await this.projects.reorderColumns(tenant, boardId, input.columnIds);
    return { data: await this.projects.listColumns(tenant, boardId) };
  }

  @Get('labels')
  @RequireCapability('project:read')
  async labels(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    parse(labelQuerySchema, query);
    return { data: await this.projects.listLabels(tenant) };
  }

  @Post('labels')
  @RequireCapability('project:create')
  async createLabel(@Tenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(createLabelRequestSchema, body);
    return { data: await this.projects.createLabel(tenant, input) };
  }

  @Delete('labels/:labelId')
  @RequireCapability('project:update')
  async deleteLabel(@Tenant() tenant: TenantContext, @Param('labelId') labelId: string) {
    await this.projects.deleteLabel(tenant, labelId);
    return { data: { id: labelId, deleted: true } };
  }
}
