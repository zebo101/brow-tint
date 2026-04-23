import {
  findAITaskByProviderTaskId,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { getAIService } from '@/shared/services/ai';

import { handleAINotify } from '../handler';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const payload = await req.json().catch(() => ({}));

    const result = await handleAINotify({
      provider,
      payload,
      url: req.url,
      deps: {
        findAITaskByProviderTaskId,
        getAIService,
        updateAITaskById,
      },
    });

    return Response.json(result.body, {
      status: result.status,
    });
  } catch (err: any) {
    console.log('handle ai notify failed', err);
    return Response.json(
      {
        message: `handle ai notify failed: ${err.message}`,
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    const result = await handleAINotify({
      provider,
      url: req.url,
      deps: {
        findAITaskByProviderTaskId,
        getAIService,
        updateAITaskById,
      },
    });

    return Response.json(result.body, {
      status: result.status,
    });
  } catch (err: any) {
    console.log('handle ai notify failed', err);
    return Response.json(
      {
        message: `handle ai notify failed: ${err.message}`,
      },
      {
        status: 500,
      }
    );
  }
}
