import { NextResponse } from "next/server";
import { getRequestId } from "./logger";

export interface ProblemDetailsInput {
  status: number;
  title: string;
  detail: string;
  type?: string;
  instance?: string;
  requestId?: string;
  extensions?: Record<string, unknown>;
}

export function problemResponse(input: ProblemDetailsInput): NextResponse {
  const requestId = input.requestId ?? getRequestId();
  const body: Record<string, unknown> = {
    type: input.type ?? `https://httpstatuses.com/${input.status}`,
    title: input.title,
    status: input.status,
    detail: input.detail,
    requestId,
    ...(input.instance ? { instance: input.instance } : {}),
    ...(input.extensions ?? {}),
  };

  return NextResponse.json(body, {
    status: input.status,
    headers: {
      "Content-Type": "application/problem+json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

export function jsonResponse<T>(
  data: T,
  options?: {
    status?: number;
    requestId?: string;
    headers?: Record<string, string>;
  },
): NextResponse {
  const requestId = options?.requestId ?? getRequestId();
  return NextResponse.json(data, {
    status: options?.status ?? 200,
    headers: {
      ...(options?.headers ?? {}),
      "x-request-id": requestId,
    },
  });
}
