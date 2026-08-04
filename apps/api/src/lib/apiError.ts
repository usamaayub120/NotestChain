export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (message = "Authentication required.") => new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to do this.") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Not found.") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string) => new ApiError(409, "CONFLICT", message),
  badRequest: (message: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", message, details),
};
