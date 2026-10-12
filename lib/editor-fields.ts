// Presentation rules only: never remove these values from the saved snapshot.
const internalFields = new Set([
  "id", "categoryId", "schemaVersion", "editorIntegrationVersion", "kind", "order", "assetId", "src", "source", "orderBuilderProduct",
  "href", "url", "path", "route", "anchor", "slug", "target", "external",
  "linkDestination", "destination", "facebook", "maps",
]);

const labels: Record<string, string> = {
  nav: "Menu text", label: "Text", primary: "Main button", secondary: "Second button",
  link: "Button text", quoteLabel: "Quote button text", hero: "Main section",
  eyebrow: "Introductory text", kicker: "Introductory text", copy: "Description",
  headlinePrefix: "Heading beginning", headlineEmphasis: "Highlighted heading text",
  headlineSecondLine: "Heading second line", headlineTarget: "Highlighted heading text",
  headlineSuffix: "Heading ending", heroEyebrow: "Introductory text",
  heroTitleFirst: "Heading first line", heroTitleSecond: "Heading second line",
  heroLead: "Description", heroCaption: "Image caption",
  heroCaptionFirst: "Image caption first line", heroCaptionSecond: "Image caption second line",
  seo: "Search appearance (SEO)", metaTitle: "Search title", metaDescription: "Search description",
  socialPreview: "Sharing image", favicon: "Browser icon", legal: "Footer small print",
  productionHero: "Main image", customizeHero: "Main image", productDialog: "Product details text",
  brandStatement: "About Ganesh", whatWeMake: "Products introduction",
  orderBuilder: "Order choices", builder: "Order form text", tiles: "Images",
  preparationLink: "Preparation button text", journeyLink: "Journey button text",
  questionsLink: "Questions button text", helpLink: "Help button text", fabricLink: "Fabrics button text",
  nextHeading: "Heading", nextCopy: "Description", nextAction: "Button text",
  exploreCollection: "Collection button text", exploreWork: "Our work button text",
  followJourney: "Journey button text", buildOrder: "Order button text",
  specialRequest: "Special request button text", moreGuidance: "Guidance button text",
  active: "Show", details: "Details", relatedProductIds: "Related products",
  featuredProducts: "Featured products", poster: "Video poster image", video: "Product video",
  supportCopy: "Support chat copy", prompts: "Suggested questions", reply: "Sample reply", thinkingLabel: "Preparing reply text", composerPlaceholder: "Disabled chat input text",
  gallery: "Image gallery", tagline: "Product tagline", benefits: "Fabric benefits", recommendedUses: "Recommended uses",
  HeroHeader: "Hero copy", FeaturedProduct: "Featured product controls", WhatWeMake: "Product showcase copy",
  FabricExplorer: "Fabric explorer controls", BuildYourOrder: "Order form controls", SiteHeader: "Header controls", SiteFooter: "Footer copy",
  productsPage: "Products page copy", customizePage: "Customize page copy", ourWorkPage: "Our Work page copy", productionPage: "Production page copy",
};

export function isHiddenEditorField(name: string): boolean {
  if (name === "headlineTarget") return false; // Visible heading copy, not navigation metadata.
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_-]+/);
  return internalFields.has(name) || words.some((word) => /^(href|url|uri|path|route|anchor|slug|target|external|destination)$/i.test(word));
}

export function fieldLabel(name: string): string {
  return labels[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([a-zA-Z])(\d+)/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function fieldPosition(name: string, value: unknown): number {
  if (/^(seo|metaTitle|metaDescription)$/.test(name)) return 60;
  if (name === "legal") return 50;
  if (name === "details" && Array.isArray(value)) return 40;
  if (name === "active") return 45;
  if (/image|caption|tiles/i.test(name) || (value && typeof value === "object" && "src" in value)) return 30;
  if (/^(primary|secondary|link|quoteLabel)$/.test(name) || /Link$|Action$/.test(name) || /button text/i.test(labels[name] ?? "")) return 20;
  return 10;
}

export function editorFieldEntries(value: Record<string, unknown>): [string, unknown][] {
  // Stable sorting retains the authored text order, independent of hidden fields.
  return Object.entries(value).filter(([key]) => !isHiddenEditorField(key))
    .sort(([a, av], [b, bv]) => fieldPosition(a, av) - fieldPosition(b, bv));
}
