import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/apiError.js";
import { AuthError } from "../modules/auth/auth.service.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError || err instanceof AuthError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: (err as ApiError).details },
    });
  }

  // body-parser rejects an oversized body BEFORE any route runs, so without
  // this branch the response never passes through Errors.* and the client
  // receives body-parser's own HTML/text shape instead of
  // { error: { code, message } } — which the web client cannot parse, so the
  // user sees a generic failure with no explanation. Pre-existing gap, but it
  // only becomes reachable in practice now that note bodies can be large.
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "That's larger than we can accept in one request." },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: err.flatten() },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "That value is already in use." } });
    }
  }

  logger.error({ err, reqId: req.id, path: req.path }, "Unhandled error");
  const message =
    env.NODE_ENV === "production" ? "Something went wrong. Please try again." : (err as Error)?.message ?? "Unknown error";
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
}
