import asyncio
from collections import Counter
from math import cos, floor, isfinite, radians
from pathlib import Path

import rasterio

from hotel_agent.application.ports.place_research import PlaceResearchRequest, PlaceResearchResult

BASE_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
CLASSES = {
    10: "trees",
    20: "shrubs",
    30: "grass",
    40: "crops",
    50: "built",
    60: "bare",
    70: "snow",
    80: "water",
    90: "wetland",
    95: "mangrove",
    100: "moss",
}

LABELS = {
    "trees": "древесный покров (включая сады и плантации)",
    "shrubs": "кустарники",
    "grass": "травянистый покров",
    "crops": "пашня",
    "built": "застройка",
    "bare": "голая поверхность",
    "snow": "снег и лёд",
    "water": "постоянная вода",
    "wetland": "травянистые водно-болотные угодья",
    "mangrove": "мангры",
    "moss": "мхи и лишайники",
}


def tile_name(lon: float, lat: float) -> str:
    x, y = floor(lon / 3) * 3, floor(lat / 3) * 3
    return f"{'N' if y >= 0 else 'S'}{abs(y):02d}{'E' if x >= 0 else 'W'}{abs(x):03d}"


class WorldCover:
    def __init__(self, directory: Path | None = None) -> None:
        self._directory = directory

    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        if not all(isfinite(v) for v in (*request.location, request.radius_m)):
            raise ValueError("Finite coordinates and radius are required")
        lon, lat = request.location
        if not -180 <= lon < 180 or not -60 < lat < 82.75 or not 50 <= request.radius_m <= 2000:
            raise ValueError("WorldCover supports radius 50–2000 m and latitude -60..82.75")
        try:
            async with asyncio.timeout(20):
                return await asyncio.to_thread(self._sample, request)
        except (rasterio.errors.RasterioError, TimeoutError, OSError) as error:
            raise ValueError("WorldCover tile is unavailable; land cover is unknown") from error

    def _sample(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        lon, lat = request.location
        dy = request.radius_m / 111320
        dx = dy / cos(radians(lat))
        groups: dict[str, list[tuple[float, float]]] = {}
        for x in range(-2, 3):
            for y in range(-2, 3):
                if x * x + y * y > 4:
                    continue
                point = (lon + x * dx / 2, lat + y * dy / 2)
                groups.setdefault(tile_name(*point), []).append(point)
        counts: Counter[int] = Counter()
        sources = []
        with rasterio.Env(
            GDAL_HTTP_TIMEOUT="4",
            GDAL_HTTP_CONNECTTIMEOUT="2",
            GDAL_HTTP_MAX_RETRY="0",
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
        ):
            for name, points in groups.items():
                filename = f"ESA_WorldCover_10m_2021_v200_{name}_Map.tif"
                url = f"{BASE_URL}/{filename}"
                target = str(self._directory / filename) if self._directory else f"/vsicurl/{url}"
                with rasterio.open(target) as dataset:
                    if dataset.crs is None or dataset.crs.to_epsg() != 4326:
                        raise ValueError("WorldCover raster must use EPSG:4326")
                    for value in dataset.sample(points, indexes=1, masked=True):
                        if not value.mask[0] and int(value[0]) in CLASSES:
                            counts[int(value[0])] += 1
                sources.append(url)
        total = sum(counts.values())
        descriptions = {
            f"{label}_sample_pct": f"ESA WorldCover 2021: доля точек класса «{LABELS[label]}» среди не менее 10 из 13 точек в радиусе {request.radius_m:g} м, %; выборка, не измерение площади и не вид из окна"
            for label in CLASSES.values()
        }
        return PlaceResearchResult(
            descriptions=descriptions,
            values={
                f"{label}_sample_pct": round(100 * counts[code] / total, 1)
                for code, label in CLASSES.items()
            }
            if total >= 10
            else {},
            sources=(*sources, "https://creativecommons.org/licenses/by/4.0/"),
            points=(request.location,),
            note=f"ESA WorldCover 2021 v200, CC BY 4.0; {total}/13 valid samples. At least 10 required for metrics. Class percentages are sampled points, not exact areas or current conditions.",
        )
