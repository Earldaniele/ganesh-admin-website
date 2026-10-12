import type { ContentSnapshot } from "./content/schema";
import designInventory from "./content/design-inventory.json" with { type: "json" };
import { fabricCategories } from "./fabric-catalog.ts";
export type PageId = "home" | "products" | "customize" | "ourWork" | "production";
export const pages: Record<PageId, { label: string; route: string }> = {
  home: { label: "Home", route: "/" }, products: { label: "Products", route: "/products" },
  customize: { label: "Customize", route: "/customize" }, ourWork: { label: "Our Work / Artwork", route: "/our-work" },
  production: { label: "Production", route: "/production" },
};
export type EditorTarget = { id: string; label: string; selector: string; paths: string[] };
const target = (id: string, label: string, selector: string, ...paths: string[]): EditorTarget => ({ id, label, selector, paths });
const header = target("header", "Header and navigation", ".site-header", "global.businessName", "global.nav", "editorial.labels.header", "global.quoteLabel", "global.logo");
const footer = target("footer", "Footer and contact details", "footer", ...["kicker", "heading", "copy", "primary", "secondary", "details"].map((key) => `pages.home.footer.${key}`), ...["tagline", "establishedYear", "location", "phone", "email", "address", "hours"].map((key) => `global.${key}`), "pages.home.footer.legal");
const pageCopy = (page: PageId, ...keys: string[]) => keys.map((key) => `pages.${page}.${key}`);
const fabrics = target("fabrics", "Fabrics", "#fabrics", "pages.home.fabrics", "fabricCategories", "fabrics", "editorial.labels.sections.showing", "editorial.labels.sections.fabricDisclaimer");
const order = target("order", "Order form", "#customize", "pages.home.order", "orderBuilder", "editorial.labels.builder");
const help = target("help", "Size guide and questions", "#help", "pages.home.help", "sizeGuides", "faqs", "editorial.labels.help");
function mainTargets(page: PageId): EditorTarget[] {
  if (page === "home") return [
    target("hero", "Hero / introduction", "#home", "pages.home.hero"),
    target("brand", "About Ganesh", ".brand-statement", "pages.home.brandStatement"),
    target("featured", "Featured products · video & gallery", "#featured", "featuredProducts", "designCopy.FeaturedProduct"),
    target("products", "Product showcase", "#products", "pages.home.whatWeMake", "products", "editorial.labels.productDialog"),
    fabrics, target("production", "Production", "#production", "pages.home.production", "productionSteps", "editorial.labels.sections.exploreProduction"),
    target("work", "Our Work", "#work", "pages.home.work", "workCategories", "editorial.labels.sections.exploreWork", "editorial.labels.sections.workDisclaimer"), order,
    target("values", "Values", "#why", "pages.home.values", "brandValues"), help,
  ];
  const heroButtons = { products: ["exploreCollection"], customize: ["buildOrder", "helpLink"], ourWork: ["exploreWork"], production: ["followJourney", "journeyLink", "preparationLink", "questionsLink"] };
  const hero = target("hero", "Main section", ".interior-hero", ...pageCopy(page, "heroEyebrow", "heroTitleFirst", "heroTitleSecond", "heroLead", ...heroButtons[page], "heroCaption", "heroCaptionFirst", "heroCaptionSecond"), ...(page === "customize" || page === "production" ? [`editorial.images.${page}Hero`] : []));
  if (page === "products") return [hero, target("products", "Products and product details", "#catalog", ...pageCopy(page, "collectionKicker", "collectionHeadingFirst", "collectionHeadingSecond", "fabricLink", "buildOrder", "specialRequest"), "products", "editorial.labels.productDialog"), fabrics, target("cta", "Explore our work", "#products-cta", ...pageCopy(page, "nextHeading", "nextCopy", "nextAction"))];
  if (page === "customize") return [hero, target("preparation", "Before you order", ".customize-preparation", ...pageCopy(page, "preparationIdeaTitle", "preparationIdeaCopy", "preparationGroupTitle", "preparationGroupCopy", "preparationDateTitle", "preparationDateCopy")), order, target("product-options", "Product options", "#order-product-heading", "products"), target("fabric-options", "Fabric options", "#order-material-heading", "fabrics"), target("options", "Customization and sizes", "#order-details-heading", "orderBuilder"), help];
  if (page === "ourWork") return [hero, target("stories", "Stories and images", "#work-stories", "workCategories", ...pageCopy(page, "focusLabel", "briefLabel", "garmentsHeading", "garmentsCopy"))];
  return [hero, target("steps", "Production steps", "#journey", ...pageCopy(page, "journeyKicker", "journeyTitleFirst", "journeyTitleSecond", "journeyCopy"), "productionSteps"), target("preparation", "Before production", "#before-production", ...pageCopy(page, "preparationKicker", "preparationTitleFirst", "preparationTitleSecond", "preparationCopy"), "editorial.productionPreparation", ...pageCopy(page, "buildOrder")), target("questions", "Questions and answers", "#production-questions", ...pageCopy(page, "questionsKicker", "questionsTitleFirst", "questionsTitleSecond", "questionsCopy"), "editorial.productionQuestions", ...pageCopy(page, "moreGuidance"))];
}
export function pageTargets(page: PageId): EditorTarget[] {
  const seo = target("seo", "Search appearance (SEO)", "head", ...(page === "home" ? ["global.seo"] : pageCopy(page, "metaTitle", "metaDescription")), "global.favicon", "global.socialPreview");
  const groups: Record<string, string[]> = { header: ["SiteHeader"], footer: ["SiteFooter"], hero: [page === "home" ? "HeroHeader" : `${page}Page`], brand: ["BrandStatement"], featured: ["FeaturedProduct"], products: ["WhatWeMake"], fabrics: ["FabricExplorer"], production: ["ProductionProcess"], work: ["OurWork"], order: ["BuildYourOrder"], values: ["BrandValues"], help: ["HelpfulBeforeOrdering"], stories: ["ourWorkPage"], steps: ["productionPage"], preparation: [`${page}Page`], questions: ["productionPage"], cta: ["productsPage"] };
  return [header, ...mainTargets(page), target("support", "Support chat · preview copy", "[aria-label='Open support chat']", "supportCopy"), footer, seo].map((entry) => {
    const imported = (groups[entry.id] ?? []).flatMap((group) => (designInventory as Record<string, string[]>)[group] ?? []).filter((path) => !/^pages\.(products|customize|ourWork|production)$/.test(path));
    return { ...entry, paths: [...new Set([...entry.paths, ...imported])].filter((path, _index, all) => !all.some((parent) => parent !== path && path.startsWith(`${parent}.`))) };
  });
}
export function editorTargets(page: PageId, content: ContentSnapshot): EditorTarget[] {
  const result = [...pageTargets(page)];
  if (page === "home" || page === "products") content.products.forEach((item, index) => result.push(target(`product:${item.id}`, `Edit product · ${item.name}`, `[data-editor-product-id="${CSS.escape(item.id)}"]`, `products.${index}`)));
  if (["home", "products"].includes(page)) content.fabrics.forEach((item, index) => result.push(target(`fabric:${item.id}`, `Fabric · ${item.name}`, `[data-editor-fabric-id="${CSS.escape(item.id)}"]`, `fabrics.${index}`)));
  if (["home", "products"].includes(page)) {
    result.push(target("fabric-category:new", "Add Category", "head", "fabricCategories", "fabrics"));
    fabricCategories(content).forEach((item) => {
      result.push(target(`fabric-public:${item.id}`, `Publics · ${item.name}`, "head", "fabricCategories", "fabrics"));
      result.push(target(`fabric-public-new:${item.id}`, "Add Public", "head", "fabricCategories", "fabrics"));
    });
  }
  if (page === "ourWork") content.workCategories.forEach((item, index) => result.push(target(`story:${item.id}`, `Story · ${item.label}`, `#${CSS.escape(item.slug)}`, `workCategories.${index}`)));
  if (page === "production") content.productionSteps.forEach((item, index) => result.push(target(`step:${item.id}`, `Step · ${item.title}`, `#${CSS.escape(item.slug)}`, `productionSteps.${index}`)));
  return result;
}
export function getAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current !== null && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}
export function setAt<T>(value: T, path: string, next: unknown): T {
  const copy = structuredClone(value);
  const keys = path.split(".");
  let current = copy as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) current = current[key] as Record<string, unknown>;
  current[keys[keys.length - 1]] = next;
  return copy;
}
