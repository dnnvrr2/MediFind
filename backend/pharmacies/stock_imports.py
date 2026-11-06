"""Branch-scoped CSV previews. Only explicit confirmation changes inventory."""
import csv
import io
import re
import unicodedata
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError

from administration.models import MedicineRequest, PharmacyApplication
from administration.views import Conflict
from .models import Inventory, StockImport, StockSettings
from .serializers import InventoryInput
from .services import audit

FIELDS = ("medicine_id", "name", "strength", "form", "unit", "stock", "price", "low_stock", "available")
MAX_BYTES, MAX_ROWS = 2 * 1024 * 1024, 1000


def settings_data(member):
    config, _ = StockSettings.objects.get_or_create(pharmacy=member.pharmacy)
    history = StockImport.objects.filter(pharmacy=member.pharmacy, state="applied").order_by("-applied_at")[:5]
    imports = [{"id": str(b.pk), "filename": b.filename, "rows": b.row_count, "at": b.applied_at, "actor": b.actor.full_name} for b in history.select_related("actor")]
    return {"method": config.method, "column_mapping": config.column_mapping, "version": config.version, "can_configure": member.role == "owner", "last_import": imports[0] if imports else None, "history": imports}


def clean_mapping(value, headers=None):
    if not isinstance(value, dict) or any(k not in FIELDS or not isinstance(v, str) for k, v in value.items()):
        raise ValidationError("Invalid column mapping.")
    result = {k: v for k, v in value.items() if v}
    if not result.get("stock") or not (result.get("medicine_id") or result.get("name")):
        raise ValidationError("Match the stock column and either medicine ID or medicine name.")
    if len(set(result.values())) != len(result):
        raise ValidationError("Each CSV column can be matched to one field only.")
    if headers is not None and any(v not in headers for v in result.values()):
        raise ValidationError("A matched column is missing from this file. Match the columns again.")
    if any(len(v) > 150 for v in result.values()):
        raise ValidationError("Column names are too long.")
    return result


class SettingsInput(serializers.Serializer):
    method = serializers.ChoiceField(choices=("manual", "csv"))
    version = serializers.IntegerField(min_value=1)
    column_mapping = serializers.JSONField(required=False)


def save_settings(member, payload):
    if member.role != "owner":
        raise PermissionDenied("Only the branch owner can change stock settings.")
    serializer = SettingsInput(data=payload)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    with transaction.atomic():
        config, _ = StockSettings.objects.select_for_update().get_or_create(pharmacy=member.pharmacy)
        updates = {"method": values["method"], "version": F("version") + 1, "updated_at": timezone.now()}
        if "column_mapping" in values:
            updates["column_mapping"] = clean_mapping(values["column_mapping"])
        if not StockSettings.objects.filter(pk=config.pk, version=values["version"]).update(**updates):
            raise Conflict("Stock settings changed. Refresh before saving again.")
        audit(member.pharmacy, member.user, "Stock settings updated", note=values["method"])
    return settings_data(member)


def require_csv(member):
    config, _ = StockSettings.objects.get_or_create(pharmacy=member.pharmacy)
    if config.method != "csv":
        raise ValidationError("The branch owner must enable CSV imports in Stock settings first.")


def upload_csv(member, file):
    require_csv(member)
    if not file or not file.name.lower().endswith(".csv"):
        raise ValidationError("Choose a .csv file exported as UTF-8.")
    if file.size > MAX_BYTES:
        raise ValidationError("CSV files must be 2 MB or smaller.")
    try:
        content = file.read(MAX_BYTES + 1).decode("utf-8-sig")
        if len(content.encode("utf-8")) > MAX_BYTES or "\x00" in content:
            raise ValueError()
        try:
            dialect = csv.Sniffer().sniff(content[:8192], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(io.StringIO(content, newline=""), dialect, strict=True)
        headers = [v.strip() for v in next(reader)]
        if not headers or len(headers) > 64 or any(not h or len(h) > 150 for h in headers) or len(set(h.casefold() for h in headers)) != len(headers):
            raise ValidationError("Use 1–64 unique, nonempty column headers (up to 150 characters each).")
        records = []
        for row in reader:
            if not any(v.strip() for v in row):
                continue
            if len(row) != len(headers):
                raise ValidationError(f"CSV row {reader.line_num} has a different number of columns than the header.")
            if any(len(v) > 1000 for v in row):
                raise ValidationError(f"CSV row {reader.line_num} contains a cell longer than 1,000 characters.")
            records.append({"row": reader.line_num, "values": dict(zip(headers, (v.strip() for v in row)))})
            if len(records) > MAX_ROWS:
                raise ValidationError("Import up to 1,000 rows at a time.")
        if not records:
            raise ValidationError("The CSV needs at least one medicine row.")
    except (UnicodeError, ValueError, StopIteration, csv.Error):
        raise ValidationError("Could not read this CSV. Export it as UTF-8 with a header row.")
    now = timezone.now()
    # Discard expired drafts; completed imports remain as the branch's audit history.
    StockImport.objects.filter(pharmacy=member.pharmacy, expires_at__lt=now).exclude(state="applied").delete()
    batch = StockImport.objects.create(pharmacy=member.pharmacy, actor=member.user, filename=Path(file.name.replace('\\', '/')).name[:200], headers=headers, records=records, row_count=len(records), expires_at=now + timedelta(minutes=30))
    return {"id": str(batch.pk), "filename": batch.filename, "headers": headers, "sample": [r["values"] for r in records[:3]], "row_count": len(records), "expires_at": batch.expires_at}


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", str(value)).casefold().split())


def get_batch(member, pk, lock=False):
    query = StockImport.objects.select_for_update() if lock else StockImport.objects
    batch = query.filter(pk=pk, pharmacy=member.pharmacy, actor=member.user).first()
    if not batch:
        raise ValidationError("This import is not available to this account.")
    if batch.state != "applied" and batch.expires_at <= timezone.now():
        raise Conflict("This import expired. Upload the file again.")
    return batch


def preview_data(batch):
    return {"id": str(batch.pk), "filename": batch.filename, "version": batch.version, "row_count": batch.row_count, "valid_count": batch.row_count - batch.error_count, "error_count": batch.error_count, "rows": batch.preview, "expires_at": batch.expires_at}


@transaction.atomic
def preview_import(member, pk, mapping):
    require_csv(member)
    batch = get_batch(member, pk, lock=True)
    if batch.state == "applied":
        raise Conflict("This file was already imported. Upload a new file to make further changes.")
    mapping = clean_mapping(mapping, batch.headers)
    medicines = list(MedicineRequest.objects.filter(pharmacy=member.pharmacy, status="Approved"))
    by_id = {str(m.pk): m for m in medicines}
    by_name = {}
    for m in medicines:
        by_name.setdefault(normalized(m.name), []).append(m)
    inventory = {str(i.medicine_id): i for i in Inventory.objects.filter(medicine__pharmacy=member.pharmacy)}
    plan, preview, seen = [], [], set()
    for record in batch.records:
        values = {field: record["values"][column] for field, column in mapping.items()}
        row = {"row": record["row"], "medicine": values.get("name") or values.get("medicine_id") or "Unmatched medicine"}
        try:
            if values.get("medicine_id"):
                try:
                    medicine = by_id.get(str(uuid.UUID(values["medicine_id"])))
                except (ValueError, AttributeError):
                    medicine = None
                if not medicine:
                    raise ValueError("Medicine ID must belong to an approved medicine in this branch.")
            else:
                candidates = by_name.get(normalized(values.get("name", "")), [])
                for field in ("strength", "form", "unit"):
                    if values.get(field):
                        candidates = [m for m in candidates if normalized(getattr(m, field)) == normalized(values[field])]
                if len(candidates) != 1:
                    raise ValueError("No unique approved match. Use a medicine ID, or match name, strength, form, and unit. New medicines need approval first.")
                medicine = candidates[0]
            mid = str(medicine.pk)
            row["medicine"] = f"{medicine.name} · {medicine.strength} · {medicine.form} · {medicine.unit}"
            if mid in seen:
                raise ValueError("Duplicate medicine in this file. Keep one stock count per medicine.")
            seen.add(mid)
            old = inventory.get(mid)
            data = {"version": old.version if old else 0, "stock": values.get("stock", ""), "price": values.get("price") or (str(old.price) if old else ""), "low_stock": values.get("low_stock") or (old.low_stock if old else 10), "available": values.get("available") or (old.available if old else True)}
            # Reject rounding and fractional counts rather than silently coercing them.
            for field in ("stock", "low_stock"):
                if not re.fullmatch(r"\d+", str(data[field])):
                    raise ValueError(f"{field.replace('_', ' ').capitalize()} must be a whole number, without separators.")
            if not data["price"]:
                raise ValueError("Match a price column to initialize inventory for this medicine.")
            serializer = InventoryInput(data=data)
            if not serializer.is_valid():
                raise ValueError("; ".join(f"{key.replace('_', ' ')}: {', '.join(map(str, errors))}" for key, errors in serializer.errors.items()))
            parsed = serializer.validated_data
            reserved = old.reserved if old else 0
            if parsed["stock"] < reserved:
                raise ValueError(f"Physical stock cannot be below the {reserved} units reserved for orders.")
            row.update({"old_stock": old.stock if old else None, "stock": parsed["stock"], "reserved": reserved, "available_stock": parsed["stock"] - reserved if parsed["available"] else 0, "old_price": str(old.price) if old else None, "price": str(parsed["price"]), "low_stock": parsed["low_stock"], "available": parsed["available"]})
            plan.append({"medicine_id": mid, **{key: str(value) if isinstance(value, Decimal) else value for key, value in parsed.items()}})
        except ValueError as exc:
            row["error"] = str(exc)
        preview.append(row)
    batch.mapping, batch.preview, batch.plan = mapping, preview, plan
    batch.error_count = sum("error" in row for row in preview)
    batch.version += 1
    batch.state = "previewed"
    batch.save(update_fields=["mapping", "preview", "plan", "error_count", "version", "state"])
    return preview_data(batch)


def confirm_import(member, pk, version):
    if not isinstance(version, int) or isinstance(version, bool):
        raise ValidationError("Supply the preview version.")
    try:
        with transaction.atomic():
            PharmacyApplication.objects.select_for_update().get(pk=member.pharmacy_id)
            require_csv(member)
            batch = get_batch(member, pk, lock=True)
            if batch.state == "applied":
                return {"imported": batch.row_count, "already_applied": True, "settings": settings_data(member)}
            if batch.version != version or batch.state != "previewed" or batch.error_count or not batch.plan:
                raise Conflict("Preview this file and fix every row before confirming.")
            for item in sorted(batch.plan, key=lambda i: i["medicine_id"]):
                medicine = MedicineRequest.objects.select_for_update().filter(pk=item["medicine_id"], pharmacy=member.pharmacy, status="Approved").first()
                if not medicine:
                    raise Conflict("A medicine's approval changed. Generate a fresh preview.")
                inventory = Inventory.objects.select_for_update().filter(medicine=medicine).first()
                if (inventory.version if inventory else 0) != item["version"]:
                    raise Conflict("Stock or reservations changed since preview. Generate a fresh preview; nothing was imported.")
                if inventory and item["stock"] < inventory.reserved:
                    raise Conflict("New reservations exceed this stock count. Generate a fresh preview.")
                changes = {key: item[key] for key in ("stock", "price", "low_stock", "available")}
                if inventory:
                    if not Inventory.objects.filter(pk=inventory.pk, version=item["version"]).update(**changes, version=F("version") + 1, updated_at=timezone.now()):
                        raise Conflict("Inventory changed during import. Generate a fresh preview.")
                else:
                    Inventory.objects.create(medicine=medicine, **changes)
            now = timezone.now()
            if not StockImport.objects.filter(pk=batch.pk, state="previewed", version=version).update(state="applied", applied_at=now, records=[], plan=[]):
                raise Conflict("This preview changed. Refresh before confirming.")
            audit(member.pharmacy, member.user, "CSV stock imported", batch.pk, f"{batch.row_count} medicines from {batch.filename}", {"rows": batch.row_count})
    except IntegrityError:
        raise Conflict("Inventory changed during import. Generate a fresh preview; nothing was imported.")
    return {"imported": batch.row_count, "already_applied": False, "settings": settings_data(member)}


def template_data(member):
    medicines = MedicineRequest.objects.filter(pharmacy=member.pharmacy, status="Approved").order_by("name", "strength", "id")
    inventory = {str(i.medicine_id): i for i in Inventory.objects.filter(medicine__pharmacy=member.pharmacy)}
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([*FIELDS, "reserved"])
    def safe(value):
        value = str(value)
        return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value
    for m in medicines:
        row = inventory.get(str(m.pk))
        writer.writerow([str(m.pk), safe(m.name), safe(m.strength), safe(m.form), safe(m.unit), row.stock if row else "", str(row.price) if row else "", row.low_stock if row else 10, str(row.available).lower() if row else "true", row.reserved if row else 0])
    return {"filename": "medifind-stock.csv", "content": "\ufeff" + output.getvalue(), "count": medicines.count()}
