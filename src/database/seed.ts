import { createPrismaClient } from './prisma-client';

async function seed(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await prisma.$transaction(async (db) => {
      const project = await db.project.upsert({
        where: { name: 'StudyFlow Demo' },
        update: {},
        create: { name: 'StudyFlow Demo', description: 'Демонстраційний навчальний проєкт', status: 'active' },
      });
      const owner = await db.user.upsert({
        where: { email: 'owner@example.test' },
        update: {},
        create: { email: 'owner@example.test', name: 'Demo Owner' },
      });
      const member = await db.user.upsert({
        where: { email: 'member@example.test' },
        update: {},
        create: { email: 'member@example.test', name: 'Demo Member' },
      });
      for (const [userId, role] of [[owner.id, 'owner'], [member.id, 'member']] as const) {
        await db.membership.upsert({
          where: { projectId_userId: { projectId: project.id, userId } },
          update: {},
          create: { projectId: project.id, userId, role },
        });
      }

      const task = { projectId: project.id, title: 'Підготувати макет' };
      if (!(await db.task.findFirst({ where: task }))) {
        await db.task.create({ data: { ...task, status: 'todo', dueDate: new Date('2026-11-20') } });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
