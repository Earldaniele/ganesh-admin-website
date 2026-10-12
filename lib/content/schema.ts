import { z } from "zod";

const safeUrl = (value: string) => /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(value) && !/[\u0000-\u0020\\]/.test(value);
const mediaRefSchema = z.object({
  src: z.string().min(1).max(2000).refine((value) => /^(\/(?!\/)|https?:\/\/)/i.test(value) && safeUrl(value), "Use a local image path or an HTTP(S) image URL."),
  assetId: z.string().uuid().optional(),
  alt: z.string().max(300).default(""),
  focalPoint: z.string().max(100).optional(),
});
const contentMediaRefSchema = mediaRefSchema.extend({ alt: z.string().min(1, "Alt text is required for content images.").max(300) });
const videoRefSchema = z.object({
  kind: z.literal("video"),
  src: z.string().max(2000).refine((value) => value === "" || /^(\/(?!\/)|https?:\/\/)/i.test(value) && safeUrl(value), "Use a local or HTTP(S) video URL."),
  alt: z.string().max(300),
  captions: z.string().max(2000).refine((value) => value === "" || /^(\/(?!\/)|https?:\/\/)/i.test(value) && safeUrl(value), "Use a local or HTTP(S) captions URL."),
  assetId: z.string().uuid().optional(),
});

const linkSchema = z.object({
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(500).refine(safeUrl, "Use a local link, anchor, HTTP(S), mailto, or tel URL."),
  external: z.boolean().default(false),
});

const productSchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  shortDescription: z.string().max(1000),
  details: z.string().max(5000),
  purpose: z.string().max(500),
  category: z.string().max(120),
  fabric: z.string().max(500),
  bestFor: z.string().max(500),
  customization: z.string().max(500),
  image: contentMediaRefSchema,
  orderBuilderProduct: z.string().max(160).optional(),
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const fabricSchema = z.object({
  id: z.string().min(1).max(100),
  categoryId: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(3000),
  qualities: z.array(z.string().min(1).max(120)).max(8),
  shortDescription: z.string().max(1000).default(""),
  benefits: z.array(z.string().max(300)).max(20).default([]),
  recommendedUses: z.array(z.string().max(300)).max(20).default([]),
  image: contentMediaRefSchema,
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const workTileSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  description: z.string().max(1000),
  image: contentMediaRefSchema,
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const workCategorySchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  leadDescription: z.string().max(1000),
  story: z.object({
    heading: z.string().max(500),
    description: z.string().max(5000),
    focus: z.string().max(1500),
    brief: z.string().max(1500),
    relatedProductIds: z.array(z.string().max(100)).max(20),
    orderLabel: z.string().max(160).optional(),
  }),
  tiles: z.array(workTileSchema).max(50),
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const productionStepSchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  focus: z.string().max(500),
  description: z.string().max(2000),
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const faqSchema = z.object({
  id: z.string().min(1).max(100),
  question: z.string().min(1).max(300),
  answer: z.string().max(3000),
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const sizeGuideSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  rows: z.array(z.object({ label: z.string().max(160), value: z.string().max(500) })).max(20),
  order: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const simpleCopySchema = z.object({
  kicker: z.string().max(300).default(""),
  heading: z.string().max(500).default(""),
  copy: z.string().max(5000).default(""),
});

export const contentSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  editorIntegrationVersion: z.literal(2).optional(),
  supportCopy: z.object({
    heading: z.string().min(1).max(160), greeting: z.string().max(1000), notice: z.string().max(300),
    thinkingLabel: z.string().max(300), composerPlaceholder: z.string().max(300),
    prompts: z.array(z.object({ label: z.string().min(1).max(160), reply: z.string().max(3000) })).min(1).max(20),
  }).optional(),
  designCopy: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.string().max(5000))).optional(),
  designMedia: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), mediaRefSchema)).optional(),
  featuredProducts: z.array(z.object({
    id: z.string().min(1).max(100), name: z.string().min(1).max(160),
    tagline: z.string().max(500), description: z.string().max(5000),
    fabric: z.string().max(500), bestFor: z.string().max(500), customization: z.string().max(500),
    category: z.string().max(120), orderBuilderProduct: z.string().max(160).optional(),
    image: contentMediaRefSchema, poster: mediaRefSchema, video: videoRefSchema,
    qualities: z.array(z.string().max(300)).max(20),
    gallery: z.array(z.object({ id: z.string().min(1).max(120), label: z.string().min(1).max(160), image: contentMediaRefSchema })).min(1).max(30),
    order: z.number().int().nonnegative(), active: z.boolean(),
  })).max(30).optional(),
  global: z.object({
    businessName: z.string().min(1).max(160),
    tagline: z.string().max(300),
    establishedYear: z.string().max(10),
    location: z.string().max(300),
    phone: z.string().max(100),
    email: z.string().max(200),
    facebook: z.string().max(500).refine(value => value === "" || /^https?:\/\//i.test(value) && safeUrl(value), "Use an HTTP(S) Facebook URL."),
    address: z.string().max(500),
    maps: z.string().max(1000).refine(value => value === "" || /^https?:\/\//i.test(value) && safeUrl(value), "Use an HTTP(S) Maps URL."),
    hours: z.string().max(500),
    quoteLabel: z.string().max(120),
    logo: mediaRefSchema,
    favicon: mediaRefSchema,
    socialPreview: mediaRefSchema,
    nav: z.array(linkSchema).max(20),
    seo: z.object({ title: z.string().max(200), description: z.string().max(1000) }),
  }),
  pages: z.object({
    home: z.object({
      hero: z.object({
        eyebrow: z.string().max(300),
        headlinePrefix: z.string().max(300),
        headlineEmphasis: z.string().max(160),
        headlineSecondLine: z.string().max(300),
        copy: z.string().max(3000),
        primary: linkSchema,
        secondary: linkSchema,
        image: mediaRefSchema,
      }),
      brandStatement: z.object({ kicker: z.string().max(300), headlinePrefix: z.string().max(300), headlineTarget: z.string().max(160), headlineSuffix: z.string().max(300), copy: z.string().max(3000) }),
      whatWeMake: simpleCopySchema,
      fabrics: simpleCopySchema,
      production: simpleCopySchema,
      work: simpleCopySchema,
      order: simpleCopySchema,
      values: simpleCopySchema,
      help: simpleCopySchema,
      footer: z.object({ kicker: z.string().max(300), heading: z.string().max(500), copy: z.string().max(3000), primary: linkSchema, secondary: linkSchema, legal: z.string().max(500), details: z.array(z.object({ label: z.string().max(160), value: z.string().max(500), source: z.enum(["address", "establishedYear", "phone", "email", "hours", "location", "businessName", "tagline", "facebook"]).optional() })).max(10) }),
    }),
    products: z.record(z.string().max(100), z.string().max(5000)).optional(),
    ourWork: z.record(z.string().max(100), z.string().max(5000)).optional(),
    production: z.record(z.string().max(100), z.string().max(5000)).optional(),
    customize: z.record(z.string().max(100), z.string().max(5000)).optional(),
  }),
  editorial: z.object({
    labels: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).max(100), z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).max(100), z.string().max(1000))),
    images: z.object({ productionHero: contentMediaRefSchema, customizeHero: contentMediaRefSchema }),
    productionPreparation: z.array(z.object({ id: z.string().min(1).max(100), title: z.string().max(300), description: z.string().max(3000), href: z.string().max(500).refine((value) => value === "" || safeUrl(value), "Use a safe local or HTTP(S) link."), link: z.string().max(160), order: z.number().int().nonnegative(), active: z.boolean() })).max(30),
    productionQuestions: z.array(faqSchema).max(30),
  }).optional(),
  products: z.array(productSchema).max(100),
  fabrics: z.array(fabricSchema).max(100),
  fabricCategories: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160), description: z.string().max(3000), order: z.number().int().nonnegative(), active: z.boolean().default(true) })).max(100).optional(),
  productionSteps: z.array(productionStepSchema).max(50),
  workCategories: z.array(workCategorySchema).max(50),
  brandValues: z.array(z.object({ id: z.string().max(100), name: z.string().max(160), description: z.string().max(1500), order: z.number().int().nonnegative(), active: z.boolean().default(true) })).max(20),
  sizeGuides: z.array(sizeGuideSchema).max(20),
  faqs: z.array(faqSchema).max(50),
  orderBuilder: z.object({
    customizationOptions: z.array(z.string().max(160)).max(30),
    sizingOptions: z.array(z.string().max(160)).max(30),
    recommendedFabricLabel: z.string().min(1).max(160).optional(),
    defaultQuantity: z.string().regex(/^[1-9][0-9]{0,5}$/).optional(),
    defaultProduct: z.string().max(160),
    defaultFabric: z.string().max(160),
    defaultCustomization: z.string().max(160),
    defaultSizing: z.string().max(160),
  }),
}).superRefine((content, ctx) => {
  const collections = ["products", "fabrics", "productionSteps", "workCategories", "brandValues", "sizeGuides", "faqs"] as const;
  if (content.featuredProducts) {
    const ids = new Set<string>();
    for (const [index, item] of content.featuredProducts.entries()) {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: ["featuredProducts", index, "id"], message: "Featured product IDs must be unique." });
      ids.add(item.id);
    }
    if (!content.featuredProducts.some((item) => item.active)) ctx.addIssue({ code: "custom", path: ["featuredProducts"], message: "Keep at least one active featured product." });
  }
  for (const key of collections) {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    content[key].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: [key, index, "id"], message: "IDs must be unique within a collection." });
      ids.add(item.id);
      if ("slug" in item) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || slugs.has(item.slug)) ctx.addIssue({ code: "custom", path: [key, index, "slug"], message: "Use a unique lowercase, hyphenated slug." });
        slugs.add(item.slug);
      }
    });
  }
  const productIds = new Set(content.products.map((item) => item.id));
  if (content.fabricCategories) {
    const ids = new Set<string>();
    content.fabricCategories.forEach((category, index) => {
      if (ids.has(category.id)) ctx.addIssue({ code: "custom", path: ["fabricCategories", index, "id"], message: "Category IDs must be unique." });
      ids.add(category.id);
    });
    content.fabrics.forEach((fabric, index) => {
      if (!ids.has(fabric.categoryId ?? fabric.id)) ctx.addIssue({ code: "custom", path: ["fabrics", index, "categoryId"], message: "Select an existing fabric category." });
    });
    if (!content.fabricCategories.some((category) => category.active)) ctx.addIssue({ code: "custom", path: ["fabricCategories"], message: "Keep at least one active fabric category." });
  }
  content.workCategories.forEach((category, index) => {
    category.story.relatedProductIds.forEach((id) => {
      if (!productIds.has(id)) ctx.addIssue({ code: "custom", path: ["workCategories", index, "story", "relatedProductIds"], message: `Remove the reference to missing product ${id} before deleting it.` });
    });
    const ids = new Set<string>();
    category.tiles.forEach((tile, tileIndex) => {
      if (ids.has(tile.id)) ctx.addIssue({ code: "custom", path: ["workCategories", index, "tiles", tileIndex, "id"], message: "Work image IDs must be unique." });
      ids.add(tile.id);
    });
    if (category.active && !category.tiles.some((tile) => tile.active)) ctx.addIssue({ code: "custom", path: ["workCategories", index, "tiles"], message: "Keep at least one active image in an active work category." });
  });
  // These existing public interactive sections need a valid initial selection.
  for (const key of ["products", "fabrics", "productionSteps", "workCategories", "sizeGuides"] as const) {
    if (!content[key].some((item) => item.active)) ctx.addIssue({ code: "custom", path: [key], message: "Keep at least one active item for this public section." });
  }
});

export type ContentSnapshot = z.infer<typeof contentSnapshotSchema>;
export type ProductContent = ContentSnapshot["products"][number];
export type FabricContent = ContentSnapshot["fabrics"][number];
export type WorkCategoryContent = ContentSnapshot["workCategories"][number];

export function parseContentSnapshot(value: unknown): ContentSnapshot {
  return contentSnapshotSchema.parse(value);
}
