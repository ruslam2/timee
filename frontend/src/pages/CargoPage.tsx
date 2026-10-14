import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { api, post, put } from "../api";
import { useMe, useMyOrganizations } from "../auth";
import OrderTimeline from "../components/OrderTimeline";
import { Card, ErrorText, Field } from "../components/ui";
import { dateTime, kg, money } from "../format";
import { useStatusLabel } from "../i18n";
import type {
  Category,
  MemberRole,
  MyOrganization,
  Order,
  OrderStatus,
  Product,
  Tariff,
  Warehouse,
} from "../types";

// Интерфейс кабинета пока на русском; китайский для склада в КНР добавим на этапе логистики.

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Владелец",
  manager: "Менеджер",
  warehouse_cn: "Склад в Китае",
  warehouse_uz: "Склад / ПВЗ в Узбекистане",
};

const ORG_STATUS: Record<string, string> = {
  pending: "На проверке у администратора",
  verified: "Проверена",
  rejected: "Отклонена",
  blocked: "Заблокирована",
};

type Tab = "orders" | "products" | "tariffs" | "warehouses" | "members";

export default function CargoPage() {
  const { data: me, isLoading } = useMe();
  const { data: orgs } = useMyOrganizations(!!me);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("orders");

  if (!isLoading && !me) return <Navigate to="/login" />;
  if (!orgs) return <p className="muted">Загрузка…</p>;
  if (orgs.length === 0) return <CreateOrganization />;

  const current = orgs.find((o) => o.organization.id === selected) ?? orgs[0];
  const org = current.organization;
  const isManager = current.role === "owner" || current.role === "manager";

  return (
    <div>
      <div className="row space">
        <h1>{org.name}</h1>
        {orgs.length > 1 && (
          <select value={org.id} onChange={(e) => setSelected(Number(e.target.value))}>
            {orgs.map((o) => (
              <option key={o.organization.id} value={o.organization.id}>
                {o.organization.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="muted">
        {ROLE_LABELS[current.role]} · {ORG_STATUS[org.status]}
        {org.rejection_reason && ` · ${org.rejection_reason}`}
      </p>
      <div className="tabs">
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          Заказы
        </button>
        {isManager && (
          <>
            <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
              Товары
            </button>
            <button className={tab === "tariffs" ? "active" : ""} onClick={() => setTab("tariffs")}>
              Тарифы
            </button>
            <button
              className={tab === "warehouses" ? "active" : ""}
              onClick={() => setTab("warehouses")}
            >
              Склады и ПВЗ
            </button>
            <button className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}>
              Сотрудники
            </button>
          </>
        )}
      </div>
      {tab === "orders" && <OrgOrders membership={current} />}
      {tab === "products" && isManager && <OrgProducts orgId={org.id} />}
      {tab === "tariffs" && isManager && <OrgTariffs orgId={org.id} />}
      {tab === "warehouses" && isManager && <OrgWarehouses orgId={org.id} />}
      {tab === "members" && isManager && <OrgMembers orgId={org.id} isOwner={current.role === "owner"} />}
    </div>
  );
}

function CreateOrganization() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", inn: "", phone: "", description: "" });
  const create = useMutation({
    mutationFn: () =>
      post("/organizations", {
        ...form,
        phone: form.phone || null,
        description: form.description || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-orgs"] }),
  });
  return (
    <div className="narrow card">
      <h2>Регистрация карго-компании</h2>
      <p className="muted">После проверки администратором вы сможете публиковать товары.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Название">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="ИНН">
          <input value={form.inn} onChange={(e) => setForm({ ...form, inn: e.target.value })} />
        </Field>
        <Field label="Телефон">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Описание">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <button className="primary" disabled={create.isPending}>
          Отправить на проверку
        </button>
      </form>
      <ErrorText error={create.error} />
    </div>
  );
}

// --- заказы ---

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; roles: MemberRole[] }>> = {
  paid: { to: "purchased", label: "Выкуплен у поставщика", roles: ["manager"] },
  received_cn: { to: "shipped", label: "Отправлен партией", roles: ["manager", "warehouse_cn"] },
  shipped: { to: "customs", label: "На таможне", roles: ["manager", "warehouse_uz"] },
  customs: { to: "arrived_uz", label: "Прибыл на склад в УЗ", roles: ["manager", "warehouse_uz"] },
  arrived_uz: { to: "at_pickup", label: "Передан в ПВЗ", roles: ["manager", "warehouse_uz"] },
};

function can(role: MemberRole, roles: MemberRole[]) {
  return role === "owner" || roles.includes(role);
}

function OrgOrders({ membership }: { membership: MyOrganization }) {
  const orgId = membership.organization.id;
  const label = useStatusLabel();
  const [status, setStatus] = useState<string>("");
  const [open, setOpen] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["org-orders", orgId, status],
    queryFn: () => api<Order[]>(`/organizations/${orgId}/orders${status ? `?status=${status}` : ""}`),
  });
  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Все статусы</option>
        {Object.keys(NEXT_STEP)
          .concat(["created", "purchased", "at_pickup", "delivered", "cancelled", "disputed"])
          .map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
      </select>
      {data?.length === 0 && <p className="muted">Заказов нет</p>}
      {data?.map((o) => (
        <Card
          key={o.id}
          title={
            <button className="link" onClick={() => setOpen(open === o.id ? null : o.id)}>
              {o.number} · <span className={`status status-${o.status}`}>{label(o.status)}</span> ·{" "}
              {money(o.total_uzs)} сум · {dateTime(o.created_at)}
            </button>
          }
        >
          {open === o.id && <StaffOrder order={o} role={membership.role} />}
        </Card>
      ))}
    </div>
  );
}

function StaffOrder({ order, role }: { order: Order; role: MemberRole }) {
  const qc = useQueryClient();
  const [weight, setWeight] = useState("");
  const [ref, setRef] = useState("");
  const [code, setCode] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<unknown>(null);
  const step = NEXT_STEP[order.status];

  const act = async (path: string, body: unknown) => {
    setError(null);
    try {
      await post(`/staff/orders/${order.id}/${path}`, body);
      await qc.invalidateQueries({ queryKey: ["org-orders"] });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="two-col">
      <div>
        <table>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.variant_id}>
                <td>
                  {i.title} <span className="muted">{Object.values(i.attributes).join(" / ")}</span>
                </td>
                <td>× {i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Заявленный вес {kg(order.declared_weight_g)}
          {order.actual_weight_g != null && `, фактический ${kg(order.actual_weight_g)}`}
          {order.supplier_order_ref && ` · заказ у поставщика ${order.supplier_order_ref}`}
          {order.amount_due_uzs > 0 && ` · покупатель должен ${money(order.amount_due_uzs)} сум`}
        </p>
        {order.comment && <p>Комментарий покупателя: {order.comment}</p>}

        <Field label="Комментарий к шагу">
          <input value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>

        {step?.to === "shipped" && order.amount_due_uzs > 0 && (
          <p className="warn">Отправка в партию откроется после доплаты за вес.</p>
        )}
        {step && can(role, step.roles) && !(step.to === "shipped" && order.amount_due_uzs > 0) && (
          <div className="row">
            {step.to === "purchased" && (
              <input placeholder="Номер заказа у поставщика" value={ref} onChange={(e) => setRef(e.target.value)} />
            )}
            <button
              className="primary"
              onClick={() =>
                act("status", { status: step.to, comment: comment || null, supplier_order_ref: ref || null })
              }
            >
              {step.label}
            </button>
          </div>
        )}
        {order.status === "purchased" && can(role, ["manager", "warehouse_cn"]) && (
          <div className="row">
            <input
              type="number"
              placeholder="Фактический вес, г"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <button
              className="primary"
              onClick={() => act("weigh", { actual_weight_g: Number(weight), comment: comment || null })}
            >
              Принят и взвешен на складе
            </button>
          </div>
        )}
        {order.status === "at_pickup" && can(role, ["manager", "warehouse_uz"]) && (
          <div className="row">
            <input placeholder="Код покупателя" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary" onClick={() => act("deliver", { pickup_code: code })}>
              Выдать
            </button>
          </div>
        )}
        {(order.status === "created" || order.status === "paid") && can(role, ["manager"]) && (
          <button className="danger" onClick={() => act("cancel", { comment: comment || null })}>
            Отменить заказ
          </button>
        )}
        <ErrorText error={error} />
      </div>
      <OrderTimeline order={order} />
    </div>
  );
}

// --- товары ---

type VariantForm = { sku: string; attrs: string; price_cny: string; weight_g: string };
const emptyVariant: VariantForm = { sku: "", attrs: "", price_cny: "", weight_g: "" };

function parseAttrs(s: string): Record<string, string> {
  // "размер: M, цвет: чёрный"
  return Object.fromEntries(
    s
      .split(",")
      .map((p) => p.split(":").map((x) => x.trim()))
      .filter((p) => p.length === 2 && p[0] && p[1]),
  );
}

function OrgProducts({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const { data } = useQuery({
    queryKey: ["org-products", orgId],
    queryFn: () => api<Product[]>(`/organizations/${orgId}/products`),
  });
  const submit = useMutation({
    mutationFn: (id: number) => post(`/products/${id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-products", orgId] }),
  });
  const STATUS: Record<string, string> = {
    draft: "Черновик",
    pending: "На модерации",
    active: "Опубликован",
    rejected: "Отклонён",
    archived: "В архиве",
  };
  if (editing)
    return <ProductForm orgId={orgId} product={editing === "new" ? null : editing} onDone={() => setEditing(null)} />;
  return (
    <div>
      <button className="primary" onClick={() => setEditing("new")}>
        Добавить товар
      </button>
      <ErrorText error={submit.error} />
      <table className="list">
        <tbody>
          {data?.map((p) => (
            <tr key={p.id}>
              <td>{p.title_ru}</td>
              <td>
                {STATUS[p.status]}
                {p.rejection_reason && <div className="muted">{p.rejection_reason}</div>}
              </td>
              <td className="num">{money(p.min_price_uzs)} сум</td>
              <td>
                <button className="link" onClick={() => setEditing(p)}>
                  Изменить
                </button>
                {(p.status === "draft" || p.status === "rejected") && (
                  <button className="link" onClick={() => submit.mutate(p.id)}>
                    На модерацию
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductForm({ orgId, product, onDone }: { orgId: number; product: Product | null; onDone: () => void }) {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const [form, setForm] = useState({
    category_id: product?.category_id ?? 0,
    title_ru: product?.title_ru ?? "",
    title_uz: product?.title_uz ?? "",
    description_ru: product?.description_ru ?? "",
    description_uz: product?.description_uz ?? "",
    images: product?.images.join("\n") ?? "",
    supplier_url: product?.supplier_url ?? "",
  });
  const [variants, setVariants] = useState<VariantForm[]>(
    product?.variants
      .filter((v) => v.is_active)
      .map((v) => ({
        sku: v.sku,
        attrs: Object.entries(v.attributes)
          .map(([k, val]) => `${k}: ${val}`)
          .join(", "),
        price_cny: String(v.price_cny_fen / 100),
        weight_g: String(v.weight_g),
      })) ?? [{ ...emptyVariant }],
  );
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        category_id: form.category_id || categories.data?.[0]?.id,
        description_ru: form.description_ru || null,
        description_uz: form.description_uz || null,
        supplier_url: form.supplier_url || null,
        images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
        variants: variants.map((v) => ({
          sku: v.sku,
          attributes: parseAttrs(v.attrs),
          price_cny_fen: Math.round(Number(v.price_cny) * 100),
          weight_g: Number(v.weight_g),
        })),
      };
      return product ? put(`/products/${product.id}`, body) : post(`/organizations/${orgId}/products`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org-products", orgId] });
      onDone();
    },
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Card title={product ? "Редактирование товара" : "Новый товар"}>
      <Field label="Категория">
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}>
          <option value={0}>—</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ru}
            </option>
          ))}
        </select>
      </Field>
      <div className="row">
        <Field label="Название (рус)">
          <input value={form.title_ru} onChange={set("title_ru")} />
        </Field>
        <Field label="Nomi (o'zb)">
          <input value={form.title_uz} onChange={set("title_uz")} />
        </Field>
      </div>
      <div className="row">
        <Field label="Описание (рус)">
          <textarea value={form.description_ru} onChange={set("description_ru")} />
        </Field>
        <Field label="Tavsif (o'zb)">
          <textarea value={form.description_uz} onChange={set("description_uz")} />
        </Field>
      </div>
      <Field label="Ссылки на фото, по одной в строке">
        <textarea value={form.images} onChange={set("images")} />
      </Field>
      <Field label="Ссылка на товар у поставщика (видна только вам)">
        <input value={form.supplier_url} onChange={set("supplier_url")} />
      </Field>
      <h4>Варианты</h4>
      {variants.map((v, i) => (
        <div className="row" key={i}>
          {(["sku", "attrs", "price_cny", "weight_g"] as const).map((k) => (
            <input
              key={k}
              placeholder={{ sku: "Артикул", attrs: "размер: M, цвет: чёрный", price_cny: "Цена, ¥", weight_g: "Вес, г" }[k]}
              value={v[k]}
              onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
            />
          ))}
          {variants.length > 1 && (
            <button className="link" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="link" onClick={() => setVariants([...variants, { ...emptyVariant }])}>
        + вариант
      </button>
      <div className="row">
        <button className="primary" onClick={() => save.mutate()} disabled={save.isPending}>
          Сохранить
        </button>
        <button onClick={onDone}>Отмена</button>
      </div>
      <ErrorText error={save.error} />
    </Card>
  );
}

// --- тарифы ---

function OrgTariffs({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tariffs", orgId],
    queryFn: () => api<Tariff[]>(`/organizations/${orgId}/tariffs`),
  });
  const [form, setForm] = useState({ method: "auto", name: "", price: "", min: "0", dmin: "", dmax: "" });
  const create = useMutation({
    mutationFn: () =>
      post(`/organizations/${orgId}/tariffs`, {
        method: form.method,
        name: form.name,
        price_per_kg_uzs: Number(form.price),
        min_weight_g: Number(form.min),
        days_min: Number(form.dmin),
        days_max: Number(form.dmax),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tariffs", orgId] }),
  });
  const METHOD: Record<string, string> = { avia: "Авиа", auto: "Авто", rail: "Ж/д" };
  return (
    <div>
      <table className="list">
        <tbody>
          {data?.map((t) => (
            <tr key={t.id}>
              <td>{METHOD[t.method]}</td>
              <td>{t.name}</td>
              <td className="num">{money(t.price_per_kg_uzs)} сум/кг</td>
              <td>от {kg(t.min_weight_g)}</td>
              <td>
                {t.days_min}–{t.days_max} дн.
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Card title="Новый тариф">
        <div className="row">
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {Object.entries(METHOD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Сум за кг" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input placeholder="Мин. вес, г" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
          <input placeholder="Дней от" value={form.dmin} onChange={(e) => setForm({ ...form, dmin: e.target.value })} />
          <input placeholder="Дней до" value={form.dmax} onChange={(e) => setForm({ ...form, dmax: e.target.value })} />
          <button className="primary" onClick={() => create.mutate()}>
            Добавить
          </button>
        </div>
        <ErrorText error={create.error} />
      </Card>
    </div>
  );
}

// --- склады и ПВЗ ---

function OrgWarehouses({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["warehouses", orgId],
    queryFn: () => api<Warehouse[]>(`/organizations/${orgId}/warehouses`),
  });
  const [form, setForm] = useState({
    country: "UZ",
    kind: "pickup_point",
    name: "",
    city: "",
    address: "",
    working_hours: "",
  });
  const create = useMutation({
    mutationFn: () =>
      post(`/organizations/${orgId}/warehouses`, { ...form, working_hours: form.working_hours || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses", orgId] }),
  });
  return (
    <div>
      <table className="list">
        <tbody>
          {data?.map((w) => (
            <tr key={w.id}>
              <td>{w.country === "CN" ? "Китай" : "Узбекистан"}</td>
              <td>{w.kind === "pickup_point" ? "ПВЗ" : "Склад"}</td>
              <td>{w.name}</td>
              <td>
                {w.city}, {w.address}
              </td>
              <td className="muted">{w.working_hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Card title="Добавить склад или ПВЗ">
        <div className="row">
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            <option value="UZ">Узбекистан</option>
            <option value="CN">Китай</option>
          </select>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="pickup_point">ПВЗ</option>
            <option value="warehouse">Склад</option>
          </select>
          <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Город" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Адрес" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input
            placeholder="Часы работы"
            value={form.working_hours}
            onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
          />
          <button className="primary" onClick={() => create.mutate()}>
            Добавить
          </button>
        </div>
        <ErrorText error={create.error} />
      </Card>
    </div>
  );
}

// --- сотрудники ---

function OrgMembers({ orgId, isOwner }: { orgId: number; isOwner: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () =>
      api<{ user_id: number; phone: string; full_name: string | null; role: MemberRole }[]>(
        `/organizations/${orgId}/members`,
      ),
  });
  const [phone, setPhone] = useState("+");
  const [role, setRole] = useState<MemberRole>("manager");
  const add = useMutation({
    mutationFn: () => post(`/organizations/${orgId}/members`, { phone, role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
  return (
    <div>
      <table className="list">
        <tbody>
          {data?.map((m) => (
            <tr key={m.user_id}>
              <td>{m.phone}</td>
              <td>{m.full_name}</td>
              <td>{ROLE_LABELS[m.role]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isOwner && (
        <Card title="Добавить сотрудника">
          <div className="row">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              {(["manager", "warehouse_cn", "warehouse_uz"] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button className="primary" onClick={() => add.mutate()}>
              Добавить
            </button>
          </div>
          <ErrorText error={add.error} />
        </Card>
      )}
    </div>
  );
}
