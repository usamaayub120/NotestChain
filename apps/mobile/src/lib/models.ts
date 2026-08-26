export type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };

export type Byline = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** True for the author's own Keeper profile, false for a pen name. */
  isPrimary: boolean;
};

export type Publication = {
  id: string; title: string; content: string; excerpt: string; tags: string[];
  publishedAt: string | null; createdAt: string; commentsEnabled: boolean;
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
  author: Byline | null;
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
  /** The Keeper profile — every account has exactly one, and it's this one. */
  isPrimary: boolean;
  bio: string; avatarUrl: string | null; links: string[];
  location: string | null; pronouns: string | null;
  /** Present regardless of the show* flag — this is the owner's own view. */
  birthDate: string | null; showBirthDate: boolean;
  gender: string | null; showGender: boolean;
  /** Only meaningful on the Keeper profile: true while the one free rename is still available. */
  canChangeUsername: boolean;
  isVisible: boolean;
};

export type Comment = {
  id: string; body: string; createdAt: string;
  /** Null for a legacy isAnonymous comment, which still renders as "Anonymous". */
  author: Byline | null;
  authorDisplayName: string | null;
  isAnonymous: boolean;
  isOwn: boolean;
  replyCount?: number;
};

export type Profile = {
  username: string; displayName: string; bio: string; avatarUrl: string | null;
  links: string[]; location: string | null; pronouns: string | null;
  birthDate: string | null; gender: string | null;
  type: "REAL_NAME" | "PSEUDONYM";
  isPrimary: boolean;
  publicationCount: number; commonTags: string[]; joinedAt: string;
  /** null below the visibility threshold — render "New", never 0. */
  followerCount: number | null;
  isFollowing: boolean;
};

export type OnChainOnlyResult = {
  publicationId: string; pda: string; schemaVersion: 1 | 2;
  title: string; authorDisplaySnapshot: string; publishedAt: number;
  content: string | null; excerpt: string | null; contentHash: string; explorerUrl: string;
};

export type ProofLookupResult =
  | { kind: "publication"; publication: Publication }
  | { kind: "onchain_only"; account: OnChainOnlyResult }
  | { kind: "not_found" };
