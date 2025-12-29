import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/core/db';
import { hairstyle } from '@/config/db/schema.sqlite';
import { getUuid } from '@/shared/lib/uuid';

export type HairstyleStatus = 'active' | 'inactive';

export type NewHairstyle = {
  id: string;
  category: string; // men, women, boys, girls
  sequence: number;
  name: string;
  tags?: string | null; // JSON array
  imageUrl: string;
  thumbnailUrl: string;
  status?: HairstyleStatus;
};

export type UpdateHairstyle = Partial<
  Omit<NewHairstyle, 'id' | 'createdAt'>
>;

export type Hairstyle = NewHairstyle & {
  createdAt: Date;
  updatedAt: Date;
};

export async function createHairstyle(
  newHairstyle: NewHairstyle
): Promise<Hairstyle> {
  const [result] = await db().insert(hairstyle).values(newHairstyle).returning();

  return result;
}

export async function createHairstyles(
  newHairstyles: NewHairstyle[]
): Promise<Hairstyle[]> {
  const results = await db()
    .insert(hairstyle)
    .values(newHairstyles)
    .returning();

  return results;
}

export async function getHairstyles({
  category,
  status = 'active',
  page = 1,
  limit = 1000,
}: {
  category?: string;
  status?: HairstyleStatus;
  page?: number;
  limit?: number;
}): Promise<Hairstyle[]> {
  const offset = (page - 1) * limit;

  let query = db().select().from(hairstyle);

  const conditions = [];
  if (category) {
    conditions.push(eq(hairstyle.category, category));
  }
  if (status) {
    conditions.push(eq(hairstyle.status, status));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query
    .orderBy(asc(hairstyle.sequence))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getHairstyleById(id: string): Promise<Hairstyle | null> {
  const [result] = await db()
    .select()
    .from(hairstyle)
    .where(eq(hairstyle.id, id))
    .limit(1);

  return result || null;
}

export async function updateHairstyle(
  id: string,
  updateHairstyle: UpdateHairstyle
): Promise<Hairstyle | null> {
  const [result] = await db()
    .update(hairstyle)
    .set(updateHairstyle)
    .where(eq(hairstyle.id, id))
    .returning();

  return result || null;
}

export async function getHairstyleCountByCategory(
  status: HairstyleStatus = 'active'
): Promise<Record<string, number>> {
  const results = await db()
    .select({
      category: hairstyle.category,
    })
    .from(hairstyle)
    .where(eq(hairstyle.status, status));

  const counts: Record<string, number> = {};
  results.forEach((row: { category: string }) => {
    counts[row.category] = (counts[row.category] || 0) + 1;
  });

  return counts;
}

