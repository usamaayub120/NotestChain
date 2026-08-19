import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/apiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Replays a completed native mutation response for the same user/key. The
 * reservation is made before the route executes, so a reconnect cannot create
 * duplicate comments, reports, bookmarks, or draft writes.
 */
export async function idempotencyProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || req.auth?.transport !== "MOBILE") return next();
  const key = req.get("idempotency-key");
  if (!key) return next();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) return next(Errors.badRequest("Invalid idempotency key."));

  try {
    await prisma.idempotencyKey.create({
      data: { userId: req.auth.userId, key, method: req.method, path: req.path, expiresAt: new Date(Date.now() + TTL_MS) },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return next(error);
    const previous = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId: req.auth.userId, key } } });
    if (!previous || previous.expiresAt < new Date()) return next(Errors.conflict("Retry this request with a new idempotency key."));
    if (previous.method !== req.method || previous.path !== req.path) return next(Errors.conflict("Idempotency key belongs to another request."));
    if (previous.response === null || previous.statusCode === null) return next(Errors.conflict("This request is still being processed."));
    return res.status(previous.statusCode).json(previous.response);
  }

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => { responseBody = body; return originalJson(body); }) as Response["json"];
  res.once("finish", () => {
    const complete = responseBody !== undefined && res.statusCode < 500;
    void (complete
      ? prisma.idempotencyKey.update({ where: { userId_key: { userId: req.auth!.userId, key } }, data: { response: responseBody as Prisma.InputJsonValue, statusCode: res.statusCode } })
      : prisma.idempotencyKey.deleteMany({ where: { userId: req.auth!.userId, key } }));
  });
  next();
}
