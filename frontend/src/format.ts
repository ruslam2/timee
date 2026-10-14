export const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("ru-RU").format(v);

export const kg = (grams: number) => `${(grams / 1000).toLocaleString("ru-RU")} кг`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
