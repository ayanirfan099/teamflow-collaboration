import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaClient } from '@teamflow/database';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { hashToken } from '../../common/crypto/tokens';
import { parseCookieHeader } from '../../common/utils/cookies';

interface SocketUser {
  id: string;
  name: string;
  email: string;
}

interface SocketState {
  user?: SocketUser;
  sessionId?: string;
}

const ROOM_PATTERN = /^(org|project|task):([0-9a-fA-F-]{36})$/;

/**
 * The authenticated real-time gateway.
 *
 * The session cookie is validated during the handshake: an unknown, expired or revoked session
 * is rejected and the socket is closed. Room subscriptions are authorised again on every join,
 * so a socket can never listen to another tenant's channel.
 */
@WebSocketGateway({
  path: '/socket.io',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const session = await this.resolveSession(client);
    if (!session) {
      // Give the client a moment to receive the reason before the socket is closed.
      await new Promise((resolve) => setTimeout(resolve, 0));
      client.emit('unauthorized', {
        code: 'unauthenticated',
        message: 'A valid session is required to connect.',
      });
      setTimeout(() => client.disconnect(true), 100);
      return;
    }

    const state = client.data as SocketState;
    state.user = { id: session.user.id, name: session.user.name, email: session.user.email };
    state.sessionId = session.id;

    // Every organization the user belongs to is joined automatically; project and task rooms
    // have to be requested explicitly and are authorised on join.
    const memberships = await this.prisma.membership.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    for (const membership of memberships) {
      await client.join(`org:${membership.organizationId}`);
    }
    // Personal channel for notifications.
    await client.join(`user:${session.user.id}`);

    client.emit('ready', { user: state.user });
  }

  handleDisconnect(client: Socket): void {
    const state = client.data as SocketState;
    if (state.user) {
      this.logger.debug(`socket ${client.id} disconnected`);
    }
  }

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room?: string },
  ): Promise<{ room: string } | { error: { code: string; message: string } }> {
    const room = payload?.room;
    const match = typeof room === 'string' ? ROOM_PATTERN.exec(room) : null;
    if (!match) {
      const error = { code: 'invalid_room', message: 'Malformed room name.' };
      client.emit('room:error', error);
      return { error };
    }

    const state = client.data as SocketState;
    if (!state.user) {
      const error = { code: 'unauthenticated', message: 'Authentication is required.' };
      client.emit('room:error', error);
      return { error };
    }

    const kind = match[1] as 'org' | 'project' | 'task';
    const authorized = await this.authorizeRoom(state.user.id, kind, match[2]!);
    if (!authorized) {
      const error = {
        code: 'forbidden',
        message: 'You are not allowed to subscribe to this room.',
      };
      client.emit('room:error', error);
      await this.recordRejectedSocket(state.user.id, kind, match[2]!);
      return { error };
    }

    await client.join(room!);
    client.emit('room:joined', { room });
    return { room: room! };
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room?: string },
  ): Promise<{ room: string }> {
    const room = typeof payload?.room === 'string' ? payload.room : '';
    if (ROOM_PATTERN.test(room)) {
      await client.leave(room);
    }
    return { room };
  }

  /** Emits an event to every member of an organization. */
  emitToOrganization(organizationId: string, event: string, payload: unknown): void {
    this.server?.to(`org:${organizationId}`).emit(event, payload);
  }

  /** Emits an event to everybody watching a project board. */
  emitToProject(projectId: string, event: string, payload: unknown): void {
    this.server?.to(`project:${projectId}`).emit(event, payload);
  }

  /** Emits an event to everybody watching a task. */
  emitToTask(taskId: string, event: string, payload: unknown): void {
    this.server?.to(`task:${taskId}`).emit(event, payload);
  }

  /** Emits an event to a single user (used for notifications). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  private async resolveSession(
    client: Socket,
  ): Promise<{ id: string; user: { id: string; name: string; email: string } } | null> {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return null;
    }
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[this.config.cookie.name];
    if (!token) {
      return null;
    }
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return { id: session.id, user: session.user };
  }

  private async authorizeRoom(
    userId: string,
    kind: 'org' | 'project' | 'task',
    id: string,
  ): Promise<boolean> {
    if (kind === 'org') {
      const membership = await this.prisma.membership.findFirst({
        where: { organizationId: id, userId },
        select: { id: true },
      });
      return membership !== null;
    }

    if (kind === 'project') {
      const project = await this.prisma.project.findFirst({
        where: { id, organization: { memberships: { some: { userId } } } },
        select: { id: true },
      });
      return project !== null;
    }

    const task = await this.prisma.task.findFirst({
      where: { id, organization: { memberships: { some: { userId } } } },
      select: { id: true },
    });
    return task !== null;
  }

  private async recordRejectedSocket(userId: string, kind: string, id: string): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) {
      return;
    }
    await this.prisma.auditEvent
      .create({
        data: {
          organizationId: membership.organizationId,
          actorId: userId,
          action: 'SOCKET_REJECTED',
          targetType: `${kind}_room`,
          targetId: id,
          metadata: { room: `${kind}:${id}` },
        },
      })
      .catch((error: unknown) => {
        this.logger.error('could not write the audit event', error as Error);
      });
  }
}
