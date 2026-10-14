"""Импорт всех моделей, чтобы Alembic и create_all видели полную схему."""

from app.modules.accounts.models import User
from app.modules.catalog.models import Category, ExchangeRate, Product, ProductVariant
from app.modules.orders.models import Order, OrderItem, Payment, TrackingEvent
from app.modules.organizations.models import Membership, Organization, ShippingTariff, Warehouse

__all__ = [
    "Category",
    "ExchangeRate",
    "Membership",
    "Order",
    "OrderItem",
    "Organization",
    "Payment",
    "Product",
    "ProductVariant",
    "ShippingTariff",
    "TrackingEvent",
    "User",
    "Warehouse",
]
