"""POST /api/webhooks/biteship. Biteship dipalsukan dengan respx."""
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select

from app.models import Shipment, ShipmentHistory

from .conftest import BITESHIP, order_json, tracking_json

URL = "/api/webhooks/biteship"
T1, T2 = "2026-01-08T08:00:00+07:00", "2026-01-08T10:30:00+07:00"
PAYLOAD = {
    "event": "order.status", "order_id": "ord_1", "status": "picked",
    "courier_tracking_id": "trk_1", "courier_waybill_id": "WYB-1700000000001", "courier_company": "JNE", "courier_type": "REG",
}


def mock_biteship(mock_http, status: str, history: list[tuple[str, str, str]]):
    orders = mock_http.get(f"{BITESHIP}/v1/orders/ord_1").mock(return_value=httpx.Response(200, json=order_json(status)))
    trackings = mock_http.get(f"{BITESHIP}/v1/trackings/trk_1").mock(return_value=httpx.Response(200, json=tracking_json(status, history)))
    return orders, trackings


async def load(session) -> tuple[Shipment, list[ShipmentHistory]]:
    shipment = (await session.execute(select(Shipment))).scalar_one()
    return shipment, sorted(shipment.histories, key=lambda h: h.occurred_at)


async def test_payload_normal(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1")
    orders, _ = mock_biteship(mock_http, "picked", [("confirmed", T1, "Order dikonfirmasi"), ("picked", T2, "Paket diambil kurir")])

    response = await client.post(URL, json=PAYLOAD)

    assert response.status_code == 200 and response.json() == {"ok": True}
    # API key dikirim apa adanya di header Authorization, hanya dari server.
    assert orders.calls.last.request.headers["authorization"] == "biteship_test.kunci_palsu"
    shipment, histories = await load(session)
    assert shipment.status_terakhir == "picked"
    assert shipment.biteship_tracking_id == "trk_1" and shipment.waybill_id == "WYB-1700000000001"
    assert shipment.picked_at == datetime(2026, 1, 8, 3, 30, tzinfo=timezone.utc)  # 10:30 WIB, disimpan UTC
    assert shipment.status_terakhir_at == shipment.picked_at
    assert shipment.last_synced_at is not None and shipment.delivered_at is None
    assert [(h.status, h.source, h.memo) for h in histories] == [("confirmed", "biteship", "Order dikonfirmasi"), ("picked", "biteship", "Paket diambil kurir")]
    assert histories[1].tahap == "Tiba di lokasi muat / barang diambil"


async def test_pengiriman_ganda_tidak_menduplikasi(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1")
    mock_biteship(mock_http, "picked", [("confirmed", T1, ""), ("picked", T2, "")])

    for _ in range(3):
        assert (await client.post(URL, json=PAYLOAD, headers={"X-Biteship-Delivery-Id": "sama"})).status_code == 200

    assert (await session.execute(select(func.count()).select_from(ShipmentHistory))).scalar_one() == 2
    shipment, _ = await load(session)
    assert shipment.status_terakhir == "picked"


async def test_delivered_mengisi_delivered_at(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1", status_terakhir="dropping_off")
    t3 = "2026-01-08T16:00:00+07:00"
    mock_biteship(mock_http, "delivered", [("picked", T2, ""), ("delivered", t3, "Diterima oleh Budi")])

    await client.post(URL, json={**PAYLOAD, "status": "delivered"})

    shipment, _ = await load(session)
    assert shipment.status_terakhir == "delivered"
    assert shipment.delivered_at == datetime(2026, 1, 8, 9, 0, tzinfo=timezone.utc)
    assert shipment.picked_at == datetime(2026, 1, 8, 3, 30, tzinfo=timezone.utc)


async def test_status_tak_dikenal(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1", status_terakhir="on_hold", progress_terakhir=0.4)
    mock_biteship(mock_http, "sorting_center", [("sorting_center", T2, "Di gudang sortir")])

    response = await client.post(URL, json={**PAYLOAD, "status": "sorting_center"})

    assert response.status_code == 200
    shipment, histories = await load(session)
    assert shipment.status_terakhir == "sorting_center"
    assert shipment.progress_terakhir == 0.4  # progress tetap di posisi terakhir
    assert histories[0].tahap == "sorting_center"
    page = await client.get(f"/tracking/{shipment.no_resi}")
    assert page.status_code == 200 and "sorting_center" in page.text
    data = (await client.get(f"/api/tracking/{shipment.no_resi}")).json()
    assert data["map"]["progress"] == 0.4 and data["summary"]["status_label"] == "sorting_center"


async def test_ping_kosong(client, session, make_shipment, mock_http):
    """Tes instalasi dari dashboard Biteship: body kosong ber-Content-Type JSON harus 200."""
    await make_shipment(biteship_order_id="ord_1")

    kosong = await client.post(URL, content=b"", headers={"Content-Type": "application/json"})
    tanpa_order = await client.post(URL, json={"event": "order.status"})
    bukan_json = await client.post(URL, content=b"halo", headers={"Content-Type": "application/json"})

    assert kosong.status_code == tanpa_order.status_code == bukan_json.status_code == 200
    assert kosong.json() == {"ok": True}
    assert not mock_http.calls  # tidak ada yang diproses
    shipment, histories = await load(session)
    assert shipment.status_terakhir == "confirmed" and histories == []


async def test_order_tidak_dikenal_tetap_200(client, mock_http):
    response = await client.post(URL, json={**PAYLOAD, "order_id": "ord_orang_lain"})
    assert response.status_code == 200 and not mock_http.calls


async def test_biteship_mati_memakai_isi_webhook(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1", last_synced_at=datetime.now(timezone.utc))
    mock_http.get(f"{BITESHIP}/v1/orders/ord_1").mock(side_effect=httpx.ConnectTimeout("timeout"))

    response = await client.post(URL, json=PAYLOAD)

    assert response.status_code == 200
    shipment, histories = await load(session)
    assert shipment.status_terakhir == "picked" and shipment.picked_at is not None
    assert shipment.last_synced_at is None  # disinkronkan penuh saat halaman dibuka berikutnya
    assert histories == []


async def test_secret_webhook(app, client, make_shipment, mock_http, monkeypatch):
    from pydantic import SecretStr

    await make_shipment(biteship_order_id="ord_1")
    mock_biteship(mock_http, "picked", [("picked", T2, "")])
    monkeypatch.setattr(app.state.deps.settings, "BITESHIP_WEBHOOK_SECRET", SecretStr("rahasia"))

    assert (await client.post(URL, json=PAYLOAD)).status_code == 401
    assert (await client.post(URL, json=PAYLOAD, headers={"X-Webhook-Secret": "salah"})).status_code == 401
    assert not mock_http.calls
    assert (await client.post(URL, json=PAYLOAD, headers={"X-Webhook-Secret": "rahasia"})).status_code == 200
    # Ping instalasi tetap dijawab 200.
    assert (await client.post(URL, content=b"")).status_code == 200
