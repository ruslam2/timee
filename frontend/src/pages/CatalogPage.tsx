import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { money } from "../format";
import { useI18n } from "../i18n";
import type { Category, ProductPage } from "../types";

export default function CatalogPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const [search, setSearch] = useState(q);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
  });
  const products = useQuery({
    queryKey: ["products", q, category],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (category) qs.set("category_id", category);
      return api<ProductPage>(`/products?${qs}`);
    },
  });

  const update = (next: Record<string, string>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    setParams(merged);
  };

  return (
    <div className="catalog">
      <aside className="sidebar">
        <button className={!category ? "chip active" : "chip"} onClick={() => update({ category: "" })}>
          {t("allCategories")}
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            className={category === String(c.id) ? "chip active" : "chip"}
            onClick={() => update({ category: String(c.id) })}
          >
            {lang === "uz" ? c.name_uz : c.name_ru}
          </button>
        ))}
      </aside>
      <div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search });
          }}
        >
          <input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        {products.isLoading && <p className="muted">{t("loading")}</p>}
        {products.data?.items.length === 0 && <p className="muted">{t("noProducts")}</p>}
        <div className="grid">
          {products.data?.items.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="product-card">
              <div className="thumb">
                {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <span>📦</span>}
              </div>
              <div className="product-title">{lang === "uz" ? p.title_uz : p.title_ru}</div>
              <div className="price">
                {t("from")} {money(p.min_price_uzs)} {t("sum")}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
