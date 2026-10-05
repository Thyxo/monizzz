import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { getUserFromRequest } from '@/lib/auth';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type SessionUser = { userId: string; username: string };

function toResponse(error: unknown, label: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Ugyldige data' }, { status: 400 });
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
}

// Wraps a handler that requires a logged-in user. Throw ApiError for expected failures.
export function authed(
  label: string,
  handler: (request: NextRequest, user: SessionUser) => Promise<unknown>,
  status = 200,
) {
  return async (request: NextRequest) => {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
      }
      return NextResponse.json(await handler(request, user), { status });
    } catch (error) {
      return toResponse(error, label);
    }
  };
}

export function open(label: string, handler: (request: NextRequest) => Promise<unknown>) {
  return async (request: NextRequest) => {
    try {
      return NextResponse.json(await handler(request));
    } catch (error) {
      return toResponse(error, label);
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'Ugyldige data');
  }
  return schema.parse(body);
}

export function requireParam(request: Request, name: string, message: string): string {
  const value = new URL(request.url).searchParams.get(name);
  if (!value) throw new ApiError(400, message);
  return value;
}
