"use client";
import { useState } from "react";
import { EditorFields, type EditorFieldsProps } from "./EditorFields";
import type { ContentSnapshot } from "@/lib/content/schema";
import { newFabricCard, newFabricCategory, type FabricCategory } from "@/lib/fabric-catalog";

type Props = Omit<EditorFieldsProps, "name" | "value" | "onChange"> & {
  categories: FabricCategory[]; fabrics: ContentSnapshot["fabrics"]; initialCategoryId?: string; initialCardId?: string;
  onChange: (categories: FabricCategory[], fabrics: ContentSnapshot["fabrics"], selectedCategoryId?: string) => void;
};
export default function FabricCatalogEditor({ categories, fabrics, initialCategoryId, initialCardId, onChange, ...fields }: Props) {
  const [selectedId, setSelectedId] = useState(initialCategoryId ?? categories[0]?.id);
  const [openId, setOpenId] = useState<string | null>(initialCardId ?? null);
  const category = categories.find((item) => item.id === selectedId) ?? categories[0];
  const cards = fabrics.filter((item) => (item.categoryId ?? item.id) === category?.id);
  function moveCard(index: number, direction: number) {
    const next = [...fabrics];
    const from = next.findIndex((item) => item.id === cards[index].id);
    const to = next.findIndex((item) => item.id === cards[index + direction].id);
    [next[from], next[to]] = [next[to], next[from]];
    onChange(categories, next.map((item, order) => ({ ...item, order })));
  }
  function moveCategory(direction: number) {
    const next = [...categories];
    const index = next.findIndex((item) => item.id === category?.id);
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next.map((item, order) => ({ ...item, order })), fabrics);
  }
  function addCategory() {
    const next = newFabricCategory(categories.length, crypto.randomUUID());
    onChange([...categories, next], fabrics, next.id); setSelectedId(next.id); setOpenId(null);
  }
  function addCard() {
    if (!category) return;
    const next = newFabricCard(category.id, fabrics.length, crypto.randomUUID());
    onChange(categories, [...fabrics, next], category.id); setOpenId(next.id);
  }
  return <div className="ve-fabric-editor"><nav aria-label="Edit fabric categories">
    {categories.map((item) => <button type="button" key={item.id} aria-pressed={category?.id === item.id} onClick={() => { setSelectedId(item.id); setOpenId(null); onChange(categories, fabrics, item.id); }}>{item.name}{item.active ? "" : " · Inactive"}</button>)}
    <button type="button" disabled={categories.length >= 100} onClick={addCategory}>Add Category</button>
  </nav><section aria-label="Selected category fabric cards">
    {category ? <><div className="ve-item-actions"><button type="button" disabled={categories[0]?.id === category.id} onClick={() => moveCategory(-1)}>Move category up</button><button type="button" disabled={categories.at(-1)?.id === category.id} onClick={() => moveCategory(1)}>Move category down</button><button type="button" disabled={cards.length > 0} title={cards.length ? "Remove the fabric cards in this category first." : undefined} onClick={() => fields.requestRemove(category.name, category, () => onChange(categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order })), fabrics))}>Remove Category</button></div><EditorFields {...fields} key={category.id} name="Category" value={category} onChange={(value) => onChange(categories.map((item) => item.id === category.id ? value as FabricCategory : item), fabrics)} />
      <h3>Fabric cards · {cards.length}</h3>
      {!cards.length ? <p role="status">No fabric cards in {category.name} yet. Add your first fabric card below.</p> : null}
      {cards.map((card, index) => <details className="ve-item" key={card.id} open={openId === card.id} onToggle={(event) => { if (event.currentTarget.open) setOpenId(card.id); else if (openId === card.id) setOpenId(null); }}><summary>{card.name}{card.active ? "" : " · Inactive"}</summary>
        <div className="ve-item-actions"><button type="button" disabled={index === 0} onClick={() => moveCard(index, -1)}>Move up</button><button type="button" disabled={index === cards.length - 1} onClick={() => moveCard(index, 1)}>Move down</button><button type="button" onClick={() => fields.requestRemove(card.name, card, () => onChange(categories, fabrics.filter((item) => item.id !== card.id).map((item, order) => ({ ...item, order }))))}>Remove fabric</button></div>
        <EditorFields {...fields} name="Fabric" path={`fabrics.${fabrics.findIndex(item => item.id === card.id)}`} value={card} onChange={(value) => onChange(categories, fabrics.map((item) => item.id === card.id ? value as typeof card : item))} />
      </details>)}
      <button type="button" disabled={fabrics.length >= 100} onClick={addCard}>Add fabric</button>
    </> : <p>Add a category to get started.</p>}
  </section></div>;
}

