'use client';

import * as React from 'react';
import { io, type Socket } from 'socket.io-client';

export type RealtimeHandler = (payload: unknown) => void;

export interface RealtimeState {
  status: 'connecting' | 'online' | 'offline';
  socket: Socket | null;
}

const EVENTS = [
  'task.created',
  'task.updated',
  'task.moved',
  'task.deleted',
  'comment.created',
  'comment.updated',
  'notification.created',
  'project.created',
  'project.updated',
  'project.deleted',
  'presence.updated',
];

/**
 * The origin of the API.
 *
 * REST calls are proxied through the Next server, so the browser stays on its own origin. The
 * WebSocket handshake has to reach the Socket.IO gateway directly, because a Next rewrite
 * cannot reliably proxy a WebSocket upgrade.
 */
export function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    return configured;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:4000';
}

/**
 * Connects the browser to the API's Socket.IO gateway.
 *
 * The session cookie is sent with the handshake, so the server can authorise the socket. The
 * socket joins the organization room; project and task rooms are joined by the board view.
 */
export function useRealtime(
  organizationId: string | null,
  handlers: Record<string, RealtimeHandler>,
): RealtimeState {
  const [status, setStatus] = React.useState<RealtimeState['status']>('connecting');
  const socketRef = React.useRef<Socket | null>(null);
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    if (!organizationId) {
      return;
    }

    const socket = io(apiOrigin(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('online');
      socket.emit('room:join', { room: `org:${organizationId}` });
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));

    for (const event of EVENTS) {
      socket.on(event, (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [organizationId]);

  return { status, socket: socketRef.current };
}
