export type SharePlatform = "copy_link" | "twitter" | "facebook" | "linkedin" | "whatsapp" | "native_share";

const UTM: Record<SharePlatform, { source: string; medium: string }> = {
  copy_link: { source: "copy_link", medium: "direct" },
  twitter: { source: "twitter", medium: "social" },
  facebook: { source: "facebook", medium: "social" },
  linkedin: { source: "linkedin", medium: "social" },
  whatsapp: { source: "whatsapp", medium: "message" },
  native_share: { source: "native_share", medium: "share" },
};

export function buildShareUrl(publicationUrl: string, platform: SharePlatform): string {
  const url = new URL(publicationUrl);
  const { source, medium } = UTM[platform];
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", "publication_share");
  return url.toString();
}

export function buildPlatformShareLink(platform: Exclude<SharePlatform, "copy_link" | "native_share">, shareUrl: string, title: string): string {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
  }
}
