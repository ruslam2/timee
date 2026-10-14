export type User = {
  id: number;
  phone: string;
  full_name: string | null;
  language: string;
  is_admin: boolean;
};

export type OrgStatus = "pending" | "verified" | "rejected" | "blocked";
export type MemberRole = "owner" | "manager" | "warehouse_cn" | "warehouse_uz";

export type Organization = {
  id: number;
  name: string;
  inn: string;
  description: string | null;
  phone: string | null;
  status: OrgStatus;
  commission_percent: string | null;
  rejection_reason: string | null;
};

export type MyOrganization = { organization: Organization; role: MemberRole };

export type Category = { id: number; slug: string; name_ru: string; name_uz: string };

export type Variant = {
  id: number;
  sku: string;
  attributes: Record<string, string>;
  price_cny_fen: number;
  weight_g: number;
  is_active: boolean;
  price_uzs: number | null;
};

export type ProductStatus = "draft" | "pending" | "active" | "rejected" | "archived";

export type Product = {
  id: number;
  organization_id: number;
  category_id: number;
  title_ru: string;
  title_uz: string;
  description_ru: string | null;
  description_uz: string | null;
  images: string[];
  status: ProductStatus;
  variants: Variant[];
  min_price_uzs: number | null;
  supplier_url?: string | null;
  rejection_reason?: string | null;
};

export type ProductPage = { items: Product[]; total: number; page: number; page_size: number };

export type Tariff = {
  id: number;
  organization_id: number;
  method: "avia" | "auto" | "rail";
  name: string;
  price_per_kg_uzs: number;
  min_weight_g: number;
  days_min: number;
  days_max: number;
  is_active: boolean;
};

export type Warehouse = {
  id: number;
  organization_id: number;
  country: "CN" | "UZ";
  kind: "warehouse" | "pickup_point";
  name: string;
  city: string;
  address: string;
  working_hours: string | null;
  is_active: boolean;
};

export type OrderStatus =
  | "created"
  | "paid"
  | "purchased"
  | "received_cn"
  | "shipped"
  | "customs"
  | "arrived_uz"
  | "at_pickup"
  | "delivered"
  | "cancelled"
  | "disputed";

export type Payment = {
  id: number;
  kind: "payment" | "surcharge" | "refund";
  status: "pending" | "paid" | "failed" | "cancelled";
  provider: string;
  amount_uzs: number;
  created_at: string;
};

export type Order = {
  id: number;
  number: string;
  organization_id: number;
  status: OrderStatus;
  goods_total_uzs: number;
  delivery_estimate_uzs: number;
  delivery_adjustment_uzs: number;
  commission_uzs: number;
  total_uzs: number;
  declared_weight_g: number;
  actual_weight_g: number | null;
  supplier_order_ref: string | null;
  comment: string | null;
  created_at: string;
  amount_due_uzs: number;
  pickup_code?: string;
  items: {
    variant_id: number;
    product_id: number;
    title: string;
    attributes: Record<string, string>;
    quantity: number;
    price_uzs: number;
  }[];
  events: { status: OrderStatus; comment: string | null; created_at: string }[];
  payments: Payment[];
};

export type OrderQuote = {
  organization_id: number;
  organization_name: string;
  declared_weight_g: number;
  goods_total_uzs: number;
  delivery_estimate_uzs: number;
  commission_uzs: number;
  total_uzs: number;
};
