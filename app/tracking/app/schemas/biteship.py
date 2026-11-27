"""Bentuk response Biteship (https://biteship.com/en/docs/api).

Docs menyatakan "Please assume all field Nullable", jadi semua field opsional dan field
tambahan diterima (extra="allow"): kode tidak rusak bila Biteship menambah atau
menghilangkan field. Nama field diverifikasi terhadap halaman orders/create,
orders/retrieve, trackings/retrieve dan webhook/overview.
"""
from pydantic import BaseModel, ConfigDict


class BiteshipModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class Coordinate(BiteshipModel):
    latitude: float | None = None
    longitude: float | None = None


class Party(BiteshipModel):
    """`origin` / `destination` pada order dan tracking."""

    contact_name: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    note: str | None = None
    postal_code: int | str | None = None
    coordinate: Coordinate | None = None


class HistoryItem(BiteshipModel):
    note: str | None = None
    status: str | None = None
    updated_at: str | None = None
    service_type: str | None = None


class Courier(BiteshipModel):
    tracking_id: str | None = None
    waybill_id: str | None = None
    company: str | None = None
    type: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_photo_url: str | None = None
    driver_plate_number: str | None = None
    link: str | None = None
    # Hanya ada di GET /v1/orders/{id}.
    history: list[HistoryItem] | None = None


class Delivery(BiteshipModel):
    datetime: str | None = None
    type: str | None = None
    distance: float | None = None
    distance_unit: str | None = None


class OrderResponse(BiteshipModel):
    """POST /v1/orders dan GET /v1/orders/{id}."""

    success: bool | None = None
    message: str | None = None
    id: str | None = None
    origin: Party | None = None
    destination: Party | None = None
    courier: Courier | None = None
    delivery: Delivery | None = None
    reference_id: str | None = None
    price: float | None = None
    status: str | None = None


class TrackingResponseBiteship(BiteshipModel):
    """GET /v1/trackings/{id}."""

    success: bool | None = None
    id: str | None = None
    waybill_id: str | None = None
    courier: Courier | None = None
    origin: Party | None = None
    destination: Party | None = None
    history: list[HistoryItem] | None = None
    link: str | None = None
    order_id: str | None = None
    status: str | None = None


class WebhookPayload(BiteshipModel):
    """Body webhook `order.status`, `order.price` dan `order.waybill_id`.

    Contoh payload di docs bukan JSON yang valid (koma hilang), jadi nama field di sini
    perlu dicek sekali terhadap webhook sandbox yang sebenarnya.
    # TODO: verifikasi di docs / payload sandbox asli.
    """

    event: str | None = None
    order_id: str | None = None
    status: str | None = None
    courier_tracking_id: str | None = None
    courier_waybill_id: str | None = None
    courier_company: str | None = None
    courier_type: str | None = None
    courier_driver_name: str | None = None
    courier_driver_phone: str | None = None
    courier_driver_plate_number: str | None = None
    courier_link: str | None = None
