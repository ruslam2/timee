import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { api, post } from "../api";
import { useMe } from "../auth";
import { Card, ErrorText } from "../components/ui";
import { dateTime, money } from "../format";
import type { Category, Organization, Product } from "../types";

export default function AdminPage() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <p className="muted">Загрузка…</p>;
  if (!me?.is_admin) return <Navigate to="/" />;
  return (
    <div>
      <h1>Администрирование</h1>
      <ExchangeRate />
      <Organizations />
      <Moderation />
      <Categories />
    </div>
  );
}

function ExchangeRate() {
  const qc = useQueryClient();
  const [rate, setRate] = useState("");
  const current = useQuery({
    queryKey: ["rate"],
    queryFn: () =>
      api<{ rate_uzs: string; source: string; fetched_at: string }>("/exchange-rates/current"),
    retry: false,
  });
  const done = () => qc.invalidateQueries({ queryKey: ["rate"] });
  const setManual = useMutation({ mutationFn: () => post("/admin/exchange-rates", { rate_uzs: rate }), onSuccess: done });
  const refresh = useMutation({ mutationFn: () => post("/admin/exchange-rates/refresh"), onSuccess: done });
  return (
    <Card title="Курс юаня">
      {current.data ? (
        <p>
          1 CNY = <b>{current.data.rate_uzs}</b> сум ({current.data.source}, {dateTime(current.data.fetched_at)})
        </p>
      ) : (
        <p className="warn">Курс не задан: цены в каталоге не считаются.</p>
      )}
      <div className="row">
        <input placeholder="Курс вручную" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button onClick={() => setManual.mutate()}>Сохранить</button>
        <button className="primary" onClick={() => refresh.mutate()}>
          Загрузить из ЦБ РУз
        </button>
      </div>
      <ErrorText error={setManual.error ?? refresh.error} />
    </Card>
  );
}

function Organizations() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => api<Organization[]>("/admin/organizations?status=pending"),
  });
  const done = () => qc.invalidateQueries({ queryKey: ["admin-orgs"] });
  const verify = useMutation({ mutationFn: (id: number) => post(`/admin/organizations/${id}/verify`), onSuccess: done });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      post(`/admin/organizations/${id}/reject`, { reason }),
    onSuccess: done,
  });
  return (
    <Card title="Карго-компании на проверке">
      {data?.length === 0 && <p className="muted">Нет заявок</p>}
      <table className="list">
        <tbody>
          {data?.map((o) => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>ИНН {o.inn}</td>
              <td>{o.phone}</td>
              <td>
                <button className="primary" onClick={() => verify.mutate(o.id)}>
                  Подтвердить
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    const reason = prompt("Причина отказа");
                    if (reason) reject.mutate({ id: o.id, reason });
                  }}
                >
                  Отклонить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText error={verify.error ?? reject.error} />
    </Card>
  );
}

function Moderation() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-products"], queryFn: () => api<Product[]>("/admin/products") });
  const done = () => qc.invalidateQueries({ queryKey: ["admin-products"] });
  const approve = useMutation({ mutationFn: (id: number) => post(`/admin/products/${id}/approve`), onSuccess: done });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => post(`/admin/products/${id}/reject`, { reason }),
    onSuccess: done,
  });
  return (
    <Card title="Модерация товаров">
      {data?.length === 0 && <p className="muted">Очередь пуста</p>}
      <table className="list">
        <tbody>
          {data?.map((p) => (
            <tr key={p.id}>
              <td>
                {p.title_ru}
                <div className="muted">{p.title_uz}</div>
              </td>
              <td>{p.variants.length} вар.</td>
              <td className="num">{money(p.min_price_uzs)} сум</td>
              <td>
                {p.supplier_url && (
                  <a href={p.supplier_url} target="_blank" rel="noreferrer">
                    поставщик
                  </a>
                )}
              </td>
              <td>
                <button className="primary" onClick={() => approve.mutate(p.id)}>
                  Опубликовать
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    const reason = prompt("Причина отказа");
                    if (reason) reject.mutate({ id: p.id, reason });
                  }}
                >
                  Отклонить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText error={approve.error ?? reject.error} />
    </Card>
  );
}

function Categories() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const [form, setForm] = useState({ slug: "", name_ru: "", name_uz: "" });
  const create = useMutation({
    mutationFn: () => post("/categories", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
  return (
    <Card title="Категории">
      <p className="muted">{data?.map((c) => c.name_ru).join(", ")}</p>
      <div className="row">
        <input placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input placeholder="Название (рус)" value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} />
        <input placeholder="Nomi (o'zb)" value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} />
        <button className="primary" onClick={() => create.mutate()}>
          Добавить
        </button>
      </div>
      <ErrorText error={create.error} />
    </Card>
  );
}
