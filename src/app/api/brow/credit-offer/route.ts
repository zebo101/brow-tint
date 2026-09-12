import { isFreeTrialExhausted } from '@/shared/lib/brow-credit-offer';
import { getAITasksCount } from '@/shared/models/ai_task';
import {
  CreditTransactionType,
  getCredits,
  getRemainingCredits,
} from '@/shared/models/credit';
import { getOrdersCount, OrderStatus } from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const user = await getUserInfo();
    if (!user)
      return Response.json(
        { error: 'sign_in_required' },
        { status: 401, headers }
      );
    const [remainingCredits, grants, successfulGenerations, paidOrders] =
      await Promise.all([
        getRemainingCredits(user.id),
        getCredits({
          userId: user.id,
          transactionType: CreditTransactionType.GRANT,
          limit: 2,
        }),
        getAITasksCount({
          userId: user.id,
          mediaType: 'image',
          status: 'success',
        }),
        getOrdersCount({ userId: user.id, status: OrderStatus.PAID }),
      ]);
    return Response.json(
      {
        remainingCredits,
        freeTrialExhausted: isFreeTrialExhausted({
          remainingCredits,
          grants,
          successfulGenerations,
          paidOrders,
        }),
      },
      { headers }
    );
  } catch {
    return Response.json(
      { error: 'credit_status_unavailable' },
      { status: 503, headers }
    );
  }
}
