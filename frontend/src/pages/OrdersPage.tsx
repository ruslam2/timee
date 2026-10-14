import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { dateTime, money } from "../format";
import { useI18n, useStatusLabel } from "../i18n";
import type { Order } from "../types";

export default function OrdersPage() {
  const { t } = useI18n();
  const label = useStatusLabel();
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders") });
  if (isLoading) return <p className="muted">{t("loading")}</p>;
  if (!data?.length) return <p className="muted">{t("noOrders")}</p>;
  return (
    <div>
      <h1>{t("orders")}</h1>
      <table className="list">
        <tbody>
          {data.map((o) => (
            <tr key={o.id}>
              <td>
                <Link to={`/orders/${o.id}`}>{o.number}</Link>
              </td>
              <td className="muted">{dateTime(o.created_at)}</td>
              <td>
                <span className={`status status-${o.status}`}>{label(o.status)}</span>
              </td>
              <td className="num">
                {money(o.total_uzs)} {t("sum")}
              </td>
              <td className="num">
                {o.amount_due_uzs > 0 && (
                  <span className="warn">
                    {t("amountDue")}: {money(o.amount_due_uzs)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
