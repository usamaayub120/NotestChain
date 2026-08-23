import type { SiteSettings } from "@prisma/client";
import { brand, Discoverability } from "@noteschain/shared";
import { env } from "../../config/env.js";
import type { getPublicationById } from "../publications/publications.service.js";
import type { getProfile } from "../profiles/profiles.service.js";

type PublicationDTO = Awaited<ReturnType<typeof getPublicationById>>;
type ProfileDTO = Awaited<ReturnType<typeof getProfile>>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gaSnippet(measurementId: string): string {
  // measurementId is already constrained to G-[A-Z0-9]+ by
  // updateSiteSettingsSchema before it ever reaches here.
  return [
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`,
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
      `gtag('js', new Date());gtag('config', '${measurementId}');</script>`,
  ].join("\n    ");
}

interface HeadOptions {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article" | "profile";
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  settings: SiteSettings;
}

function renderHead(opts: HeadOptions): string {
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");
  const url = escapeHtml(`${origin}${opts.path}`);
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const image = opts.settings.defaultOgImageUrl;

  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${escapeHtml(brand.name)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${opts.ogType ?? "website"}" />`,
    `<meta property="og:url" content="${url}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : null,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    opts.settings.twitterHandle ? `<meta name="twitter:site" content="${escapeHtml(opts.settings.twitterHandle)}" />` : null,
    opts.noindex || !opts.settings.indexingEnabled
      ? `<meta name="robots" content="noindex, nofollow" />`
      : null,
    opts.settings.searchConsoleVerification
      ? `<meta name="google-site-verification" content="${escapeHtml(opts.settings.searchConsoleVerification)}" />`
      : null,
    opts.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, "\\u003c")}</script>`
      : null,
    opts.settings.ga4MeasurementId ? gaSnippet(opts.settings.ga4MeasurementId) : null,
  ];

  return lines.filter((line): line is string => line !== null).join("\n    ");
}

export function buildHomeHead(settings: SiteSettings): string {
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");
  return renderHead({
    title: `${brand.name} — ${brand.tagline}`,
    description: settings.defaultMetaDescription ?? brand.description,
    path: "/",
    settings,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: brand.name,
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${origin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  });
}

export function buildExploreHead(settings: SiteSettings): string {
  return renderHead({
    title: `Explore — ${brand.name}`,
    description: `Browse public notes on ${brand.name}.`,
    path: "/explore",
    settings,
  });
}

export function buildHowItWorksHead(settings: SiteSettings): string {
  return renderHead({
    title: `How it works — ${brand.name}`,
    description: `How publishing and on-chain verification work on ${brand.name}.`,
    path: "/how-it-works",
    settings,
  });
}

export function buildTagHead(tag: string, settings: SiteSettings): string {
  return renderHead({
    title: `#${tag} — ${brand.name}`,
    description: `Notes tagged #${tag} on ${brand.name}.`,
    path: `/tags/${tag}`,
    settings,
  });
}

export function buildPublicationHead(pub: PublicationDTO, settings: SiteSettings): string {
  const isUnlisted = pub.discoverability === Discoverability.UNLISTED;
  const description = pub.excerpt || settings.defaultMetaDescription || brand.description;
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");

  return renderHead({
    title: `${pub.title} — ${brand.name}`,
    description,
    path: `/p/${pub.id}`,
    ogType: "article",
    noindex: isUnlisted,
    settings,
    // Unlisted notes are shareable but not meant to be indexed — skip
    // structured data too, not just the noindex tag.
    jsonLd: isUnlisted
      ? undefined
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: pub.title,
          description,
          datePublished: pub.publishedAt ?? pub.createdAt,
          // pub.author is already redacted to null for anonymous notes by
          // toPublicationDTO — never re-derive authorship here.
          author: pub.author
            ? { "@type": "Person", name: pub.author.displayName, url: `${origin}/@${pub.author.username}` }
            : undefined,
          publisher: { "@type": "Organization", name: brand.name, url: origin },
          mainEntityOfPage: `${origin}/p/${pub.id}`,
        },
  });
}

export function buildProfileHead(profile: ProfileDTO, settings: SiteSettings): string {
  const description = profile.bio || settings.defaultMetaDescription || `${profile.displayName} on ${brand.name}.`;
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");

  return renderHead({
    title: `${profile.displayName} (@${profile.username}) — ${brand.name}`,
    description,
    path: `/@${profile.username}`,
    ogType: "profile",
    settings,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Person",
        name: profile.displayName,
        description: profile.bio || undefined,
        url: `${origin}/@${profile.username}`,
      },
    },
  });
}
