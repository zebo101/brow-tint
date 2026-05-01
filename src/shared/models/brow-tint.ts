import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { browTint } from '@/config/db/schema.sqlite';
import { getUuid } from '@/shared/lib/uuid';

export type BrowTintStatus = 'active' | 'inactive';

export type NewBrowTint = {
  id: string;
  category: string; // men, women, boys, girls
  sequence: number;
  name: string;
  tags?: string | null; // JSON array
  description?: string | null;
  prompt?: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  status?: BrowTintStatus;
};

export type UpdateBrowTint = Partial<Omit<NewBrowTint, 'id' | 'createdAt'>>;

export type BrowTint = NewBrowTint & {
  createdAt: Date;
  updatedAt: Date;
};

export async function createBrowTint(
  newBrowTint: NewBrowTint
): Promise<BrowTint> {
  const [result] = await db()
    .insert(browTint)
    .values(newBrowTint)
    .returning();

  return result;
}

export async function createBrowTints(
  newBrowTints: NewBrowTint[]
): Promise<BrowTint[]> {
  const results = await db()
    .insert(browTint)
    .values(newBrowTints)
    .returning();

  return results;
}

export async function getBrowTints({
  category,
  status = 'active',
  page = 1,
  limit = 1000,
}: {
  category?: string;
  status?: BrowTintStatus;
  page?: number;
  limit?: number;
}): Promise<BrowTint[]> {
  const offset = (page - 1) * limit;

  let query = db().select().from(browTint);

  const conditions = [];
  if (category) {
    conditions.push(eq(browTint.category, category));
  }
  if (status) {
    conditions.push(eq(browTint.status, status));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query
    .orderBy(asc(browTint.sequence))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getBrowTintById(id: string): Promise<BrowTint | null> {
  const [result] = await db()
    .select()
    .from(browTint)
    .where(eq(browTint.id, id))
    .limit(1);

  return result || null;
}

export async function updateBrowTint(
  id: string,
  updates: UpdateBrowTint
): Promise<BrowTint | null> {
  const [result] = await db()
    .update(browTint)
    .set(updates)
    .where(eq(browTint.id, id))
    .returning();

  return result || null;
}

export async function getBrowTintCountByCategory(
  status: BrowTintStatus = 'active'
): Promise<Record<string, number>> {
  const results = await db()
    .select({
      category: browTint.category,
    })
    .from(browTint)
    .where(eq(browTint.status, status));

  const counts: Record<string, number> = {};
  results.forEach((row: { category: string }) => {
    counts[row.category] = (counts[row.category] || 0) + 1;
  });

  return counts;
}
