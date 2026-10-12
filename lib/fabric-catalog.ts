import type { ContentSnapshot } from "./content/schema";

export type FabricCategory = NonNullable<ContentSnapshot["fabricCategories"]>[number];
export function fabricCategories(content: Pick<ContentSnapshot, "fabrics" | "fabricCategories">): FabricCategory[] {
  return content.fabricCategories ?? content.fabrics.map(({ id, name, description, order, active }) => ({ id, name, description, order, active }));
}
export function newFabricCategory(order: number, id: string): FabricCategory {
  return { id, name: "New category", description: "", order, active: true };
}
export function newFabricCard(categoryId: string, order: number, id: string): ContentSnapshot["fabrics"][number] {
  return { id, slug: id, categoryId, name: "New public", description: "", shortDescription: "", qualities: [], benefits: [], recommendedUses: [], image: { src: "", alt: "" }, order, active: true };
}
