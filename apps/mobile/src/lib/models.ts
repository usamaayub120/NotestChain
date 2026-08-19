export type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };

export type Publication = {
  id: string; title: string; content: string; excerpt: string; tags: string[];
  publishedAt: string | null; createdAt: string; commentsEnabled: boolean;
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
  author: { username: string; displayName: string; avatarUrl: string | null } | null;
  chain?: { explorerUrl: string | null; status: string } | null;
};

export type Draft = {
  id: string; title: string; content: string; tags: string[];
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
  publicIdentityId: string | null; discoverability: "PUBLIC" | "UNLISTED";
  status: string; updatedAt: string; lastSavedAt: string;
};

export type Identity = {
  id: string; type: "REAL_NAME" | "PSEUDONYM"; username: string; displayName: string;
  bio: string; avatarUrl: string | null; links: string[]; isVisible: boolean;
};

export type Comment = {
  id: string; body: string; createdAt: string; isAnonymous: boolean;
  displayName: string | null; author?: { displayName: string; username: string } | null;
  replyCount?: number;
};
