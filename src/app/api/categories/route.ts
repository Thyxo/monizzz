import { db } from '@/lib/db';
import { ApiError, authed, parseBody, requireParam } from '@/lib/route';
import { categoryCreateSchema, categoryUpdateSchema } from '@/lib/validation';

export const GET = authed('Get categories', async (_request, user) => {
  const categories = await db.category.findMany({
    where: { userId: user.userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return { categories };
});

export const POST = authed(
  'Create category',
  async (request, user) => {
    const data = await parseBody(request, categoryCreateSchema);
    const last = await db.category.findFirst({
      where: { userId: user.userId },
      orderBy: { sortOrder: 'desc' },
    });
    const category = await db.category.create({
      data: { ...data, userId: user.userId, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return { category };
  },
  201,
);

export const PUT = authed('Update category', async (request, user) => {
  const { id, ...data } = await parseBody(request, categoryUpdateSchema);
  const existing = await db.category.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Kategori ikke fundet');
  const category = await db.category.update({ where: { id }, data });
  return { category };
});

export const DELETE = authed('Delete category', async (request, user) => {
  const id = requireParam(request, 'id', 'Kategori ID kræves');
  const existing = await db.category.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Kategori ikke fundet');

  // Transactions are kept and become uncategorised (set null).
  await db.category.delete({ where: { id } });
  return { success: true };
});
