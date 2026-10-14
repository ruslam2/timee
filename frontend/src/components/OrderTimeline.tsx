import { dateTime } from "../format";
import { useStatusLabel } from "../i18n";
import type { Order } from "../types";

export default function OrderTimeline({ order }: { order: Order }) {
  const label = useStatusLabel();
  return (
    <ol className="timeline">
      {order.events.map((e, i) => (
        <li key={i}>
          <b>{label(e.status)}</b> <span className="muted">{dateTime(e.created_at)}</span>
          {e.comment && <div className="muted">{e.comment}</div>}
        </li>
      ))}
    </ol>
  );
}
