import { QueryClient } from "@tanstack/react-query";

/** Shared so mutations initiated outside a screen can keep list caches current. */
export const queryClient = new QueryClient();
