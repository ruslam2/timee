import { createContext, useContext, useState, type ReactNode } from "react";

// Переводы на узбекский нужно вычитать носителю языка перед запуском.
const ru = {
  catalog: "Каталог",
  cart: "Корзина",
  orders: "Мои заказы",
  cargo: "Кабинет карго",
  admin: "Админка",
  login: "Войти",
  logout: "Выйти",
  search: "Поиск товаров",
  allCategories: "Все категории",
  from: "от",
  sum: "сум",
  addToCart: "В корзину",
  added: "Добавлено в корзину",
  quantity: "Количество",
  variant: "Вариант",
  weight: "Вес",
  phone: "Номер телефона",
  getCode: "Получить код",
  code: "Код из SMS",
  confirm: "Подтвердить",
  devCode: "Код для разработки",
  emptyCart: "Корзина пуста",
  delivery: "Доставка",
  pickupPoint: "Пункт выдачи",
  goods: "Товары",
  commission: "Сервисный сбор",
  total: "Итого",
  checkout: "Оформить заказ",
  calculate: "Рассчитать",
  noOrders: "Заказов пока нет",
  pay: "Оплатить",
  amountDue: "К оплате",
  pickupCode: "Код получения",
  cancelOrder: "Отменить заказ",
  history: "История",
  remove: "Удалить",
  days: "дн.",
  perKg: "за кг",
  noProducts: "Товары не найдены",
  loading: "Загрузка…",
  noDelivery: "Продавец ещё не настроил доставку",
  status_created: "Ожидает оплаты",
  status_paid: "Оплачен",
  status_purchased: "Выкуплен у поставщика",
  status_received_cn: "На складе в Китае",
  status_shipped: "В пути",
  status_customs: "На таможне",
  status_arrived_uz: "Прибыл в Узбекистан",
  status_at_pickup: "Ждёт в пункте выдачи",
  status_delivered: "Выдан",
  status_cancelled: "Отменён",
  status_disputed: "Спор",
};

type Dict = typeof ru;

const uz: Dict = {
  catalog: "Katalog",
  cart: "Savat",
  orders: "Buyurtmalarim",
  cargo: "Kargo kabineti",
  admin: "Admin",
  login: "Kirish",
  logout: "Chiqish",
  search: "Mahsulot qidirish",
  allCategories: "Barcha toifalar",
  from: "dan",
  sum: "so'm",
  addToCart: "Savatga",
  added: "Savatga qo'shildi",
  quantity: "Soni",
  variant: "Variant",
  weight: "Og'irligi",
  phone: "Telefon raqami",
  getCode: "Kod olish",
  code: "SMS kod",
  confirm: "Tasdiqlash",
  devCode: "Dasturchi uchun kod",
  emptyCart: "Savat bo'sh",
  delivery: "Yetkazib berish",
  pickupPoint: "Topshirish punkti",
  goods: "Mahsulotlar",
  commission: "Xizmat haqi",
  total: "Jami",
  checkout: "Buyurtma berish",
  calculate: "Hisoblash",
  noOrders: "Hozircha buyurtmalar yo'q",
  pay: "To'lash",
  amountDue: "To'lov uchun",
  pickupCode: "Olish kodi",
  cancelOrder: "Buyurtmani bekor qilish",
  history: "Tarix",
  remove: "O'chirish",
  days: "kun",
  perKg: "kg uchun",
  noProducts: "Mahsulot topilmadi",
  loading: "Yuklanmoqda…",
  noDelivery: "Sotuvchi hali yetkazib berishni sozlamagan",
  status_created: "To'lov kutilmoqda",
  status_paid: "To'langan",
  status_purchased: "Yetkazib beruvchidan sotib olindi",
  status_received_cn: "Xitoydagi omborda",
  status_shipped: "Yo'lda",
  status_customs: "Bojxonada",
  status_arrived_uz: "O'zbekistonga yetib keldi",
  status_at_pickup: "Topshirish punktida",
  status_delivered: "Topshirildi",
  status_cancelled: "Bekor qilindi",
  status_disputed: "Nizo",
};

export type Lang = "ru" | "uz";
const dicts: Record<Lang, Dict> = { ru, uz };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof Dict) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    (localStorage.getItem("mz_lang") as Lang | null) ?? "uz",
  );
  const setLang = (l: Lang) => {
    localStorage.setItem("mz_lang", l);
    setLangState(l);
  };
  const t = (k: keyof Dict) => dicts[lang][k];
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}

export function useStatusLabel() {
  const { t } = useI18n();
  return (s: string) => t(`status_${s}` as keyof Dict) ?? s;
}
