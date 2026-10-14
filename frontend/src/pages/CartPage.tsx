import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, post, tokens } from "../api";
import { useCart, type CartLine } from "../cart";
import { Card, ErrorText, Field } from "../components/ui";
import { kg, money } from "../format";
import { useI18n } from "../i18n";
import type { Order, OrderQuote, Tariff, Warehouse } from "../types";

type Choice = { tariff_id?: number; pickup_point_id?: number };

function OrgDelivery({
  orgId,
  choice,
  onChange,
}: {
  orgId: number;
  choice: Choice;
  onChange: (c: Choice) => void;
}) {
  const { t } = useI18n();
  const tariffs = useQuery({
    queryKey: ["tariffs", orgId],
    queryFn: () => api<Tariff[]>(`/organizations/${orgId}/tariffs`),
  });
  const points = useQuery({
    queryKey: ["warehouses", orgId],
    queryFn: () => api<Warehouse[]>(`/organizations/${orgId}/warehouses`),
    select: (all) => all.filter((w) => w.kind === "pickup_point"),
  });

  // по умолчанию выбираем самый дешёвый тариф и первый ПВЗ
  useEffect(() => {
    const next = { ...choice };
    if (!next.tariff_id && tariffs.data?.length) next.tariff_id = tariffs.data[0].id;
    if (!next.pickup_point_id && points.data?.length) next.pickup_point_id = points.data[0].id;
    if (next.tariff_id !== choice.tariff_id || next.pickup_point_id !== choice.pickup_point_id)
      onChange(next);
  }, [tariffs.data, points.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tariffs.data?.length === 0 || points.data?.length === 0)
    return <p className="error">{t("noDelivery")}</p>;

  return (
    <div className="row">
      <Field label={t("delivery")}>
        <select
          value={choice.tariff_id ?? ""}
          onChange={(e) => onChange({ ...choice, tariff_id: Number(e.target.value) })}
        >
          {tariffs.data?.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}: {money(tr.price_per_kg_uzs)} {t("sum")} {t("perKg")}, {tr.days_min}–
              {tr.days_max} {t("days")}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("pickupPoint")}>
        <select
          value={choice.pickup_point_id ?? ""}
          onChange={(e) => onChange({ ...choice, pickup_point_id: Number(e.target.value) })}
        >
          {points.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.city}, {p.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export default function CartPage() {
  const { t } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [quote, setQuote] = useState<{ orders: OrderQuote[]; grand_total_uzs: number } | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);

  const groups = useMemo(() => {
    const map = new Map<number, CartLine[]>();
    for (const l of cart.lines) map.set(l.organization_id, [...(map.get(l.organization_id) ?? []), l]);
    return [...map.entries()];
  }, [cart.lines]);

  const ready = groups.every(([id]) => choices[id]?.tariff_id && choices[id]?.pickup_point_id);

  const body = () => ({
    items: cart.lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
    deliveries: groups.map(([orgId]) => ({ organization_id: orgId, ...choices[orgId] })),
  });

  const calculate = async () => {
    setError(null);
    try {
      setQuote(await post("/checkout/quote", body()));
    } catch (e) {
      setError(e);
    }
  };

  const checkout = async () => {
    setError(null);
    try {
      const orders = await post<Order[]>("/checkout", body());
      cart.clear();
      navigate(orders.length === 1 ? `/orders/${orders[0].id}` : "/orders");
    } catch (e) {
      setError(e);
    }
  };

  if (cart.lines.length === 0) return <p className="muted">{t("emptyCart")}</p>;

  return (
    <div>
      <h1>{t("cart")}</h1>
      {groups.map(([orgId, lines]) => {
        const q = quote?.orders.find((o) => o.organization_id === orgId);
        return (
          <Card key={orgId} title={q?.organization_name}>
            <table>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.variant_id}>
                    <td>
                      <Link to={`/products/${l.product_id}`}>{l.title}</Link>{" "}
                      <span className="muted">{Object.values(l.attributes).join(" / ")}</span>
                    </td>
                    <td>
                      <input
                        className="qty"
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => {
                          cart.setQuantity(l.variant_id, Number(e.target.value));
                          setQuote(null);
                        }}
                      />
                    </td>
                    <td className="num">
                      {money((l.price_uzs ?? 0) * l.quantity)} {t("sum")}
                    </td>
                    <td>
                      <button className="link" onClick={() => cart.remove(l.variant_id)}>
                        {t("remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <OrgDelivery
              orgId={orgId}
              choice={choices[orgId] ?? {}}
              onChange={(c) => {
                setChoices((prev) => ({ ...prev, [orgId]: c }));
                setQuote(null);
              }}
            />
            {q && (
              <dl className="totals">
                <dt>{t("goods")}</dt>
                <dd>{money(q.goods_total_uzs)}</dd>
                <dt>
                  {t("delivery")} ({kg(q.declared_weight_g)})
                </dt>
                <dd>{money(q.delivery_estimate_uzs)}</dd>
                <dt>{t("commission")}</dt>
                <dd>{money(q.commission_uzs)}</dd>
                <dt>{t("total")}</dt>
                <dd>
                  <b>{money(q.total_uzs)}</b>
                </dd>
              </dl>
            )}
          </Card>
        );
      })}
      <ErrorText error={error} />
      {!tokens.access ? (
        <Link to="/login" className="button primary">
          {t("login")}
        </Link>
      ) : quote ? (
        <div className="checkout-bar">
          <b>
            {t("total")}: {money(quote.grand_total_uzs)} {t("sum")}
          </b>
          <button className="primary" onClick={checkout}>
            {t("checkout")}
          </button>
        </div>
      ) : (
        <button className="primary" onClick={calculate} disabled={!ready}>
          {t("calculate")}
        </button>
      )}
    </div>
  );
}
