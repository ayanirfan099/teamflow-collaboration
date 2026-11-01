import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createTaskRequestSchema,
  moveTaskRequestSchema,
  taskQuerySchema,
  updateTaskRequestSchema,
} from '@teamflow/contracts';
import { Idempotent, RequireCapability, Tenant } from '../../common/decorators';
import { parse } from '../../common/validation/parse';
import { TenantContext } from '../../common/types';
import { TasksService } from './tasks.service';

@Controller('organizations/:organizationId')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks')
  @RequireCapability('task:read')
  async list(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    const params = parse(taskQuerySchema, query);
    const result = await this.tasks.list(tenant, params);
    return { data: result.data, meta: result.meta };
  }

  @Post('tasks')
  @Idempotent()
  @RequireCapability('task:create')
  async create(@Tenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(createTaskRequestSchema, body);
    return { data: await this.tasks.create(tenant, input) };
  }

  @Get('tasks/:taskId')
  @RequireCapability('task:read')
  async get(@Tenant() tenant: TenantContext, @Param('taskId') taskId: string) {
    return { data: await this.tasks.get(tenant, taskId) };
  }

  @Patch('tasks/:taskId')
  @RequireCapability('task:update')
  async update(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateTaskRequestSchema, body);
    return { data: await this.tasks.update(tenant, taskId, input) };
  }

  @Post('tasks/:taskId/move')
  @RequireCapability('task:update')
  async move(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const input = parse(moveTaskRequestSchema, body);
    return { data: await this.tasks.move(tenant, taskId, input) };
  }

  @Delete('tasks/:taskId')
  @RequireCapability('task:delete')
  async remove(@Tenant() tenant: TenantContext, @Param('taskId') taskId: string) {
    await this.tasks.remove(tenant, taskId);
    return { data: { id: taskId, deleted: true } };
  }
}
