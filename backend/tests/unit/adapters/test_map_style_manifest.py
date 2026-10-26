import json
from pathlib import Path

import pytest

from hotel_agent.adapters.map_style.manifest_files import ManifestFiles
from hotel_agent.domain.errors import InvalidRegistry

SEED = Path(__file__).resolve().parents[4] / "data" / "seed"


def write_basemap(root: Path, archive: str = "a-1.pmtiles", create: bool = True) -> Path:
    directory = root / "demo-map" / "basemap"
    directory.mkdir(parents=True)
    if create:
        (directory / archive).write_bytes(b"PMTiles")
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "version": "basemap-1",
                "archive": archive,
                "glyphs": "fonts/{fontstack}/{range}.pbf",
                "sprite": "sprites/black",
                "min_zoom": 0,
                "max_zoom": 15,
                "bbox": [39.5, 43.3, 40.0, 43.8],
            }
        )
    )
    return directory


def test_the_committed_sochi_basemap_is_complete() -> None:
    record = ManifestFiles(SEED).region("sochi")
    assert record.basemap is not None
    assert record.basemap.version.startswith("basemap-")
    assert record.basemap.archive.endswith(".pmtiles")
    assert record.tiles_version is not None
    assert record.terrain


def test_a_region_without_files_has_no_basemap(tmp_path: Path) -> None:
    record = ManifestFiles(tmp_path).region("demo")
    assert record.basemap is None
    assert record.tiles_version is None
    assert not record.terrain


def test_a_manifest_without_its_archive_is_not_offered(tmp_path: Path) -> None:
    write_basemap(tmp_path, create=False)
    assert ManifestFiles(tmp_path).region("demo").basemap is None


def test_an_archive_outside_the_folder_is_not_offered(tmp_path: Path) -> None:
    write_basemap(tmp_path, archive="../x.pmtiles", create=False)
    assert ManifestFiles(tmp_path).region("demo").basemap is None


def test_a_broken_manifest_fails_loudly(tmp_path: Path) -> None:
    directory = write_basemap(tmp_path)
    (directory / "manifest.json").write_text(json.dumps({"archive": "a-1.pmtiles"}))
    with pytest.raises(InvalidRegistry):
        ManifestFiles(tmp_path).region("demo")


def test_a_large_regional_basemap_comes_from_the_basemaps_folder(tmp_path: Path) -> None:
    seed, basemaps = tmp_path / "seed", tmp_path / "basemaps"
    seed.mkdir()
    write_basemap(tmp_path / "staging")
    (basemaps).mkdir()
    (tmp_path / "staging" / "demo-map" / "basemap").rename(basemaps / "demo")
    record = ManifestFiles(seed, basemaps).region("demo")
    assert record.basemap is not None
    assert record.basemap.version == "basemap-1"
    assert ManifestFiles(seed).region("demo").basemap is None
