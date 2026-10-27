import json
import os
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

records = json.loads(Path(__file__).with_name("hotel-media.json").read_text())
with psycopg.connect(os.environ["DATABASE_URL"]) as db:
    for record in records:
        row = db.execute("SELECT name FROM hotels WHERE id=%s FOR UPDATE", (record["hotel_id"],)).fetchone()
        if row is None:
            raise ValueError(f"Unknown hotel: {record['hotel_id']}")
        db.execute(
            """INSERT INTO hotel_supplier_content(hotel_id,supplier,details)
            VALUES (%s,'official_gallery',%s) ON CONFLICT(hotel_id,supplier)
            DO UPDATE SET details=hotel_supplier_content.details || EXCLUDED.details,updated_at=now()""",
            (record["hotel_id"], Jsonb(record["details"])),
        )
        print(f"Imported {len(record['details']['photos'])} photos for {record['hotel_id']}: {row[0]}")
