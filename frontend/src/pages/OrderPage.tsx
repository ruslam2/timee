import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, post } from "../api";
import OrderTimeline from "../components/OrderTimeline";
import { Card, ErrorText } from "../components/ui";
import { kg, money } from "../format";
import { useI18n, useStatusLabel } from "../i18n";
import type { Order } from "../types";

export default function OrderPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const label = useStatusLabel();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<Order>(`/orders/${id}`),
  });
  if (!order) return <p className="muted">{t("loading")}</p>;

  const act = async (path: string, body: unknown = {}) => {
    setError(null);
    try {
      await post(path, body);
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="order-page">
      <h1>
        {order.number} <span className={`status status-${order.status}`}>{label(order.status)}</span>
      </h1>
      <div className="two-col">
        <div>
          <Card title={t("goods")}>
            <table>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.variant_id}>
                    <td>
                      {i.title}{" "}
                      <span className="muted">{Object.values(i.attributes).join(" / ")}</span>
                    </td>
                    <td>× {i.quantity}</td>
                    <td className="num">{money(i.price_uzs * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="totals">
              <dt>{t("goods")}</dt>
              <dd>{money(order.goods_total_uzs)}</dd>
              <dt>
                {t("delivery")} ({kg(order.actual_weight_g ?? order.declared_weight_g)})
              </dt>
              <dd>{money(order.delivery_estimate_uzs + order.delivery_adjustment_uzs)}</dd>
              <dt>{t("commission")}</dt>
              <dd>{money(order.commission_uzs)}</dd>
              <dt>{t("total")}</dt>
              <dd>
                <b>
                  {money(order.total_uzs)} {t("sum")}
                </b>
              </dd>
            </dl>
          </Card>
          {order.amount_due_uzs > 0 && order.status !== "cancelled" && (
            <Card>
              <p>
                {t("amountDue")}: <b>{money(order.amount_due_uzs)} {t("sum")}</b>
              </p>
              {/* Payme и Click подключаются отдельно; сейчас работает тестовая оплата */}
              <button className="primary" onClick={() => act(`/orders/${id}/pay`, { provider: "mock" })}>
                {t("pay")}
              </button>
            </Card>
          )}
          {order.status === "at_pickup" && (
            <Card>
              {t("pickupCode")}: <b className="code">{order.pickup_code}</b>
            </Card>
          )}
          {(order.status === "created" || order.status === "paid") && (
            <button className="danger" onClick={() => act(`/orders/${id}/cancel`)}>
              {t("cancelOrder")}
            </button>
          )}
          <ErrorText error={error} />
        </div>
        <Card title={t("history")}>
          <OrderTimeline order={order} />
        </Card>
      </div>
    </div>
  );
}
