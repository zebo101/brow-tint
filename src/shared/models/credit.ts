import { and, asc, count, desc, eq, gt, isNull, or, sum } from 'drizzle-orm';

import { db } from '@/core/db';
import { credit } from '@/config/db/schema';
import { getSnowId, getUuid } from '@/shared/lib/hash';

import { getAllConfigs } from './config';
import { appendUserToResult, User } from './user';

export type Credit = typeof credit.$inferSelect & {
  user?: User;
};
export type NewCredit = typeof credit.$inferInsert;
export type UpdateCredit = Partial<
  Omit<NewCredit, 'id' | 'transactionNo' | 'createdAt'>
>;

export enum CreditStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

export enum CreditTransactionType {
  GRANT = 'grant', // grant credit
  CONSUME = 'consume', // consume credit
}

export enum CreditTransactionScene {
  PAYMENT = 'payment', // payment
  SUBSCRIPTION = 'subscription', // subscription
  RENEWAL = 'renewal', // renewal
  GIFT = 'gift', // gift
  REWARD = 'reward', // reward
}

// Calculate credit expiration time based on order and subscription info
export function calculateCreditExpirationTime({
  creditsValidDays,
  currentPeriodEnd,
}: {
  creditsValidDays: number;
  currentPeriodEnd?: Date;
}): Date | null {
  const now = new Date();

  // Check if credits should never expire
  if (!creditsValidDays || creditsValidDays <= 0) {
    // never expires
    return null;
  }

  const expiresAt = new Date();

  if (currentPeriodEnd) {
    // For subscription: credits expire at the end of current period
    expiresAt.setTime(currentPeriodEnd.getTime());
  } else {
    // For one-time payment: use configured validity days
    expiresAt.setDate(now.getDate() + creditsValidDays);
  }

  return expiresAt;
}

// Helper function to create expiration condition for queries
export function createExpirationCondition() {
  const currentTime = new Date();
  // Credit is valid if: expires_at IS NULL OR expires_at > current_time
  return or(isNull(credit.expiresAt), gt(credit.expiresAt, currentTime));
}

// create credit
export async function createCredit(newCredit: NewCredit) {
  const [result] = await db().insert(credit).values(newCredit).returning();
  return result;
}

// get credits
export async function getCredits({
  userId,
  status,
  transactionType,
  getUser = false,
  page = 1,
  limit = 30,
}: {
  userId?: string;
  status?: CreditStatus;
  transactionType?: CreditTransactionType;
  getUser?: boolean;
  page?: number;
  limit?: number;
}): Promise<Credit[]> {
  const result = await db()
    .select()
    .from(credit)
    .where(
      and(
        userId ? eq(credit.userId, userId) : undefined,
        status ? eq(credit.status, status) : undefined,
        transactionType
          ? eq(credit.transactionType, transactionType)
          : undefined
      )
    )
    .orderBy(desc(credit.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

// get credits count
export async function getCreditsCount({
  userId,
  status,
  transactionType,
}: {
  userId?: string;
  status?: CreditStatus;
  transactionType?: CreditTransactionType;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(credit)
    .where(
      and(
        userId ? eq(credit.userId, userId) : undefined,
        status ? eq(credit.status, status) : undefined,
        transactionType
          ? eq(credit.transactionType, transactionType)
          : undefined
      )
    );

  return result?.count || 0;
}

// consume credits
export async function consumeCredits({
  userId,
  credits,
  scene,
  description,
  metadata,
  tx,
}: {
  userId: string;
  credits: number; // credits to consume
  scene?: string;
  description?: string;
  metadata?: string;
  tx?: any;
}) {
  const currentTime = new Date();

  // consume credits
  const execute = async (tx: any) => {
    if (!Number.isSafeInteger(credits) || credits <= 0) {
      throw new Error('credits must be a positive integer');
    }
    // Lock the grant rows before checking the balance. Concurrent requests
    // must observe the remaining balance after the preceding reservation.
    const grantsQuery = tx
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.userId, userId),
          eq(credit.transactionType, CreditTransactionType.GRANT),
          eq(credit.status, CreditStatus.ACTIVE),
          gt(credit.remainingCredits, 0),
          or(isNull(credit.expiresAt), gt(credit.expiresAt, currentTime))
        )
      )
      .orderBy(asc(credit.expiresAt), asc(credit.createdAt), asc(credit.id));
    const grants = await (grantsQuery.for
      ? grantsQuery.for('update')
      : grantsQuery);
    const balance = grants.reduce(
      (total: number, item: any) => total + item.remainingCredits,
      0
    );
    if (balance < credits) {
      throw new Error(`Insufficient credits, ${balance} < ${credits}`);
    }
    let remainingToConsume = credits;
    const consumedItems: any[] = [];
    for (const item of grants) {
      if (remainingToConsume <= 0) break;
      const toConsume = Math.min(remainingToConsume, item.remainingCredits);
      await tx
        .update(credit)
        .set({ remainingCredits: item.remainingCredits - toConsume })
        .where(eq(credit.id, item.id));
      consumedItems.push({
        creditId: item.id,
        transactionNo: item.transactionNo,
        expiresAt: item.expiresAt,
        creditsToConsume: remainingToConsume,
        creditsConsumed: toConsume,
        creditsBefore: item.remainingCredits,
        creditsAfter: item.remainingCredits - toConsume,
      });
      remainingToConsume -= toConsume;
    }
    // 3. create consumed credit
    const consumedCredit: NewCredit = {
      id: getUuid(),
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.CONSUME,
      transactionScene: scene,
      userId: userId,
      status: CreditStatus.ACTIVE,
      description: description,
      credits: -credits,
      consumedDetail: JSON.stringify(consumedItems),
      metadata: metadata,
    };
    await tx.insert(credit).values(consumedCredit);

    return consumedCredit;
  };

  // use provided transaction
  if (tx) {
    return await execute(tx);
  }

  // use default transaction
  return await db().transaction(execute);
}

// get remaining credits
export async function getRemainingCredits(userId: string): Promise<number> {
  const currentTime = new Date();

  const [result] = await db()
    .select({
      total: sum(credit.remainingCredits),
    })
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.transactionType, CreditTransactionType.GRANT),
        eq(credit.status, CreditStatus.ACTIVE),
        gt(credit.remainingCredits, 0),
        or(
          isNull(credit.expiresAt), // Never expires
          gt(credit.expiresAt, currentTime) // Not yet expired
        )
      )
    );

  return parseInt(result?.total || '0');
}

// grant credits for new user
export async function grantCreditsForNewUser(user: User) {
  // get configs from db
  const configs = await getAllConfigs();

  // if initial credits enabled
  if (configs.initial_credits_enabled !== 'true') {
    return;
  }

  // get initial credits amount and valid days
  const credits = parseInt(configs.initial_credits_amount as string) || 0;
  if (credits <= 0) {
    return;
  }

  const creditsValidDays =
    parseInt(configs.initial_credits_valid_days as string) || 0;

  const description = configs.initial_credits_description || 'initial credits';

  const newCredit = await grantCreditsForUser({
    user: user,
    credits: credits,
    validDays: creditsValidDays,
    description: description,
  });

  return newCredit;
}

// grant credits for user
export async function grantCreditsForUser({
  user,
  credits,
  validDays,
  description,
}: {
  user: User;
  credits: number;
  validDays?: number;
  description?: string;
}) {
  if (credits <= 0) {
    return;
  }

  const creditsValidDays = validDays && validDays > 0 ? validDays : 0;

  const expiresAt = calculateCreditExpirationTime({
    creditsValidDays: creditsValidDays,
  });

  const creditDescription = description || 'grant credits';

  const newCredit: NewCredit = {
    id: getUuid(),
    userId: user.id,
    userEmail: user.email,
    orderNo: '',
    subscriptionNo: '',
    transactionNo: getSnowId(),
    transactionType: CreditTransactionType.GRANT,
    transactionScene: CreditTransactionScene.GIFT,
    credits: credits,
    remainingCredits: credits,
    description: creditDescription,
    expiresAt: expiresAt,
    status: CreditStatus.ACTIVE,
  };

  await createCredit(newCredit);

  return newCredit;
}
