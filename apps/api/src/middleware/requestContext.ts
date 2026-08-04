import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.id = (req.get("x-request-id") ?? randomUUID()).slice(0, 128);
  res.setHeader("x-request-id", req.id);
  next();
}
