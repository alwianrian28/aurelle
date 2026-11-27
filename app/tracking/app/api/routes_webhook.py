"""Webhook Biteship: `order.status`, `order.price`, `order.waybill_id`.

Menurut https://biteship.com/en/docs/api/webhook/overview :
- Saat webhook ditambahkan, Biteship mengirim POST uji dengan body KOSONG (bukan `{}`) tetapi
  ber-Content-Type application/json, dan hanya menyimpan webhook bila dijawab 2xx. Karena itu
  body dibaca mentah, tidak lewat parser JSON FastAPI.
- Keaslian: tidak ada HMAC. Bila "signature key" dan "signature secret" diisi di dashboard,
  Biteship mengirim header bernama key itu dengan nilai secret itu.
- Jawaban harus 2xx dalam 45 detik; pekerjaan berat dijalankan setelah menjawab.
"""
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import ValidationError

from app.schemas.biteship import WebhookPayload
from app.services.tracking import process_webhook

from .deps import DepsDep

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/webhooks/biteship")
async def biteship_webhook(request: Request, background: BackgroundTasks, deps: DepsDep) -> dict[str, object]:
    raw = await request.body()
    # Ping instalasi / tombol tes di dashboard: tidak ada yang diproses, cukup jawab 200.
    if not raw.strip():
        return {"ok": True}

    secret = deps.settings.BITESHIP_WEBHOOK_SECRET.get_secret_value()
    if secret:
        sent = request.headers.get(deps.settings.BITESHIP_WEBHOOK_HEADER, "")
        if not hmac.compare_digest(sent.encode(), secret.encode()):
            raise HTTPException(401, "Secret webhook salah.")
    else:
        # Tanpa secret siapa pun bisa memanggil alamat ini. Dampaknya terbatas (webhook hanya
        # memicu baca ulang dari Biteship), tetapi isi BITESHIP_WEBHOOK_SECRET untuk production.
        log.warning("webhook_without_secret")

    try:
        payload = WebhookPayload.model_validate(json.loads(raw))
    except (ValueError, ValidationError):
        return {"ok": True, "ignored": "bukan_json"}
    if not payload.order_id:
        return {"ok": True, "ignored": "tanpa_order_id"}

    log.info(
        "webhook_received",
        extra={"webhook_event": payload.event, "order_id": payload.order_id, "status": payload.status, "delivery_id": request.headers.get("X-Biteship-Delivery-Id")},
    )
    background.add_task(process_webhook, request.app.state.sessionmaker, deps, payload)
    return {"ok": True}
