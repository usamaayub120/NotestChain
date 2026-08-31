import type { Role, StaffRole } from "@noteschain/shared";

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: {
        userId: string;
        role: Role;
        roles: StaffRole[];
        sessionId: string;
        csrfToken: string;
        transport: "WEB" | "MOBILE";
      };
    }
  }
}

export {};
