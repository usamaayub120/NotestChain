import type { NextFunction, Request, Response } from "express";
import { Errors } from "./apiError.js";

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Express route params are typed `string | undefined` under
 * `noUncheckedIndexedAccess` even for segments the route pattern guarantees
 * are present (e.g. `:id`). This narrows it back to `string`, throwing only
 * if the route itself is misconfigured.
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw Errors.badRequest(`Missing required path parameter "${name}".`);
  return value;
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number },
) {
  return res.status(200).json({ data, meta });
}
