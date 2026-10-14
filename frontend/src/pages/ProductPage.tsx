import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { useCart } from "../cart";
import { Field } from "../components/ui";
import { kg, money } from "../format";
import { useI18n } from "../i18n";
import type { Product } from "../types";

export default function ProductPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const cart = useCart();
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<Product>(`/products/${id}`),
  });
  if (isLoading || !product) return <p className="muted">{t("loading")}</p>;

  const variants = product.variants.filter((v) => v.is_active);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const title = lang === "uz" ? product.title_uz : product.title_ru;
  const description = lang === "uz" ? product.description_uz : product.description_ru;

  return (
    <div className="product-page">
      <div className="gallery">
        {product.images.length ? (
          product.images.map((src) => <img key={src} src={src} alt="" />)
        ) : (
          <div className="thumb big">📦</div>
        )}
      </div>
      <div>
        <h1>{title}</h1>
        <div className="price big">
          {money(variant?.price_uzs)} {t("sum")}
        </div>
        {variants.length > 1 && (
          <Field label={t("variant")}>
            <select value={variant?.id} onChange={(e) => setVariantId(Number(e.target.value))}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {Object.values(v.attributes).join(" / ") || v.sku}
                </option>
              ))}
            </select>
          </Field>
        )}
        {variant && (
          <p className="muted">
            {t("weight")}: {kg(variant.weight_g)}
          </p>
        )}
        <Field label={t("quantity")}>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
        </Field>
        <button
          className="primary"
          disabled={!variant}
          onClick={() => {
            cart.add({
              variant_id: variant.id,
              product_id: product.id,
              organization_id: product.organization_id,
              title,
              attributes: variant.attributes,
              price_uzs: variant.price_uzs,
              quantity,
            });
            setAdded(true);
          }}
        >
          {t("addToCart")}
        </button>
        {added && <p className="success">{t("added")}</p>}
        {description && <p className="description">{description}</p>}
      </div>
    </div>
  );
}
