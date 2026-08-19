import type { Role } from "@noteschain/shared";

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: {
        userId: string;
        role: Role;
        sessionId: string;
        csrfToken: string;
        transport: "WEB" | "MOBILE";
      };
    }
  }
}

export {};
