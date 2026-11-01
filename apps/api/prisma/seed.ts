import { hashPassword } from '../src/common/crypto/password';
import { createPrismaClient } from '@teamflow/database';

/**
 * A deterministic demo seed.
 *
 * The same ids are used every time, so screenshots and documentation stay stable. All data is
 * fictional; no real person or customer data is used.
 */
async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const password = await hashPassword('TeamFlow!2026');

  const users = [
    { id: '11111111-1111-4111-8111-111111111111', email: 'ada@teamflow.dev', name: 'Ada Lovelace' },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'grace@teamflow.dev',
      name: 'Grace Hopper',
    },
    { id: '33333333-3333-4333-8333-333333333333', email: 'alan@teamflow.dev', name: 'Alan Turing' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: { ...user, passwordHash: password },
    });
  }

  const organizationId = '44444444-4444-4444-8444-444444444444';
  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: { id: organizationId, name: 'Northwind Studio', slug: 'northwind-studio' },
  });

  const memberships = [
    { userId: users[0]!.id, role: 'OWNER' as const },
    { userId: users[1]!.id, role: 'ADMIN' as const },
    { userId: users[2]!.id, role: 'MEMBER' as const },
  ];
  for (const membership of memberships) {
    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: membership.userId,
        },
      },
      update: { role: membership.role },
      create: { organizationId, ...membership },
    });
  }

  const projectId = '55555555-5555-4555-8555-555555555555';
  await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      organizationId,
      name: 'Website redesign',
      key: 'WEB',
      description: 'A calmer, faster marketing site.',
      createdById: users[0]!.id,
      nextTaskNumber: 6,
    },
  });

  const boardId = '66666666-6666-4666-8666-666666666666';
  await prisma.board.upsert({
    where: { id: boardId },
    update: {},
    create: {
      id: boardId,
      organizationId,
      projectId,
      name: 'Main board',
      isDefault: true,
    },
  });

  const columns = [
    { id: '77777777-7777-4777-8777-777777777771', name: 'Backlog', position: 0 },
    { id: '77777777-7777-4777-8777-777777777772', name: 'In progress', position: 1 },
    { id: '77777777-7777-4777-8777-777777777773', name: 'In review', position: 2 },
    { id: '77777777-7777-4777-8777-777777777774', name: 'Done', position: 3, isDoneColumn: true },
  ];
  for (const column of columns) {
    await prisma.column.upsert({
      where: { id: column.id },
      update: { position: column.position },
      create: {
        id: column.id,
        organizationId,
        boardId,
        name: column.name,
        position: column.position,
        isDoneColumn: column.isDoneColumn ?? false,
      },
    });
  }

  const tasks = [
    {
      id: '88888888-8888-4888-8888-888888888881',
      number: 1,
      title: 'Audit the landing page content',
      columnId: columns[0]!.id,
      position: 1_000_000_000n,
      priority: 'HIGH' as const,
      status: 'OPEN' as const,
    },
    {
      id: '88888888-8888-4888-8888-888888888882',
      number: 2,
      title: 'Fix the mobile navigation',
      columnId: columns[1]!.id,
      position: 1_000_000_000n,
      priority: 'URGENT' as const,
      status: 'OPEN' as const,
      dueInDays: -2,
    },
    {
      id: '88888888-8888-4888-8888-888888888883',
      number: 3,
      title: 'Write the product tour script',
      columnId: columns[1]!.id,
      position: 2_000_000_000n,
      priority: 'MEDIUM' as const,
      status: 'OPEN' as const,
      dueInDays: 3,
    },
    {
      id: '88888888-8888-4888-8888-888888888884',
      number: 4,
      title: 'Accessibility pass on the pricing page',
      columnId: columns[2]!.id,
      position: 1_000_000_000n,
      priority: 'HIGH' as const,
      status: 'OPEN' as const,
    },
    {
      id: '88888888-8888-4888-8888-888888888885',
      number: 5,
      title: 'Ship the new colour palette',
      columnId: columns[3]!.id,
      position: 1_000_000_000n,
      priority: 'LOW' as const,
      status: 'DONE' as const,
    },
  ];

  for (const task of tasks) {
    const dueDate =
      task.dueInDays === undefined
        ? null
        : new Date(Date.now() + task.dueInDays * 24 * 60 * 60 * 1000);
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        organizationId,
        projectId,
        boardId,
        columnId: task.columnId,
        number: task.number,
        title: task.title,
        priority: task.priority,
        status: task.status,
        position: task.position,
        dueDate,
        completedAt: task.status === 'DONE' ? new Date() : null,
        createdById: users[0]!.id,
        assignees: {
          create: [{ organizationId, userId: users[0]!.id }],
        },
      },
    });
  }

  const label = await prisma.label.upsert({
    where: {
      organizationId_name: { organizationId, name: 'Design' },
    },
    update: {},
    create: { organizationId, name: 'Design', color: '#b24a2e' },
  });

  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId: tasks[3]!.id, labelId: label.id } },
    update: {},
    create: { taskId: tasks[3]!.id, labelId: label.id },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete: ada@teamflow.dev / TeamFlow!2026');
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
