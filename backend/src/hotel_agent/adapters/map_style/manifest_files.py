import json
from pathlib import Path

from hotel_agent.application.ports.map_style import BasemapRecord, RegionMapRecord
from hotel_agent.domain.errors import InvalidRegistry


class ManifestFiles:
    def __init__(self, seed_dir: Path) -> None:
        self._seed_dir = seed_dir

    def region(self, region_id: str) -> RegionMapRecord:
        directory = self._seed_dir / f"{region_id}-map"
        return RegionMapRecord(
            basemap=self._basemap(directory / "basemap"),
            tiles_version=self._tiles_version(directory / "manifest.json"),
            terrain=(self._seed_dir / region_id / "dem.tif").is_file(),
        )

    def _basemap(self, directory: Path) -> BasemapRecord | None:
        path = directory / "manifest.json"
        if not path.is_file():
            return None
        value = json.loads(path.read_text(encoding="utf-8"))
        try:
            archive = str(value["archive"])
            bbox = tuple(float(item) for item in value["bbox"])
            record = BasemapRecord(
                version=str(value["version"]),
                archive=archive,
                glyphs=str(value["glyphs"]),
                sprite=str(value["sprite"]),
                min_zoom=int(value["min_zoom"]),
                max_zoom=int(value["max_zoom"]),
                bbox=(bbox[0], bbox[1], bbox[2], bbox[3]),
            )
        except (KeyError, TypeError, ValueError, IndexError) as error:
            raise InvalidRegistry(f"Invalid basemap manifest in {path}") from error
        if not (directory / archive).is_file() or "/" in archive:
            return None
        return record

    def _tiles_version(self, path: Path) -> str | None:
        if not path.is_file():
            return None
        value = json.loads(path.read_text(encoding="utf-8"))
        stamp = value.get("osm_timestamp")
        return f"osm-{stamp}" if isinstance(stamp, str) else None
