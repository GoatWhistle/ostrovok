import os

import psycopg

from hotel_agent.adapters.db.geo_features import PostgresGeoFeatureRepository
from hotel_agent.adapters.db.named_places import PostgresNamedPlaceRepository
from hotel_agent.adapters.db.view_scenes import PostgresViewScenes
from hotel_agent.application.dto import GeoFeatureRecord


async def test_scene_reads_buildings_along_the_entire_path_not_only_500_m() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute("""INSERT INTO buildings (id,region_id,footprint,tags,height_m,levels)
          VALUES ('view-test-own','sochi',ST_MakeEnvelope(-0.0001,-0.0001,0.0001,0.0001,4326),
             '{"building":"hotel","height":"20","building:levels":"5"}',20,5),
          ('view-test-far','sochi',ST_MakeEnvelope(0.0099,-0.0001,0.0101,0.0001,4326),
             '{"building":"yes","height":"40"}',40,NULL)""")
        await connection.execute("""INSERT INTO hotels(id,region_id,name,location,building_id)
          VALUES('view-test-hotel','sochi','View test',ST_SetSRID(ST_MakePoint(0,0),4326),'view-test-own')""")
        repo = PostgresViewScenes(connection)
        own = await repo.hotel_buildings(("view-test-hotel",))
        result = await repo.path_buildings({"ray": ((0.00011, 0), (0.02, 0))})
        assert own["view-test-hotel"].levels == 5
        assert not result.truncated
        assert any(
            building.id == "view-test-far" and building.height_m == 40
            for building in result.buildings["ray"]
        )
        assert own["view-test-hotel"].tags["building:levels"] == "5"
    finally:
        await connection.rollback()
        await connection.close()


async def test_window_map_evidence_round_trips_and_updates_in_one_transaction() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        repo = PostgresGeoFeatureRepository(connection)
        feature = GeoFeatureRecord(
            id="window-map-integration-ray",
            kind="line",
            characteristic_key="spatial:window-test",
            geometry={"type": "LineString", "coordinates": [[39, 43], [39.01, 43]]},
            name="View ray",
            label="View ray",
            osm_ref=None,
            style_hint="line",
        )
        await repo.save_batch((feature,))
        await repo.save_batch((feature,))
        restored = await repo.get_batch((feature.id,))
        assert len(restored) == 1
        assert restored[0].geometry == feature.geometry
        assert restored[0].kind == "line"
    finally:
        await connection.rollback()
        await connection.close()


async def test_target_type_excludes_same_named_hotel_and_finds_actual_mountain() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute("""INSERT INTO pois(id,region_id,location,tags) VALUES
          ('view-test-named-hotel','sochi',ST_SetSRID(ST_MakePoint(0,0),4326),
           '{"name":"Lookout","tourism":"hotel"}'),
          ('view-test-named-mountain','sochi',ST_SetSRID(ST_MakePoint(0.02,0),4326),
           '{"name":"Lookout West","natural":"volcano"}')""")
        target = await PostgresNamedPlaceRepository(connection).by_name(
            "Lookout", (-0.1, -0.1, 0.1, 0.1), "natural", ("peak", "volcano")
        )
        assert target is not None
        assert target.id == "view-test-named-mountain"
    finally:
        await connection.rollback()
        await connection.close()


async def test_typed_target_accepts_unique_name_variant_and_preserves_ambiguity() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute("""INSERT INTO pois(id,region_id,location,tags) VALUES
          ('view-test-variant-tower','sochi',ST_SetSRID(ST_MakePoint(0,0),4326),
           '{"name":"Lookout Television Tower","man_made":"tower"}')""")
        repo = PostgresNamedPlaceRepository(connection)
        target = await repo.by_name(
            "Lookout TeleTower", (-0.1, -0.1, 0.1, 0.1), "man_made", ("tower",)
        )
        assert target is not None and target.id == "view-test-variant-tower"
        await connection.execute("""INSERT INTO pois(id,region_id,location,tags) VALUES
          ('view-test-other-tower','sochi',ST_SetSRID(ST_MakePoint(0.02,0),4326),
           '{"name":"Lookout Other Tower","man_made":"tower"}')""")
        assert (
            await repo.by_name("Lookout TeleTower", (-0.1, -0.1, 0.1, 0.1), "man_made", ("tower",))
            is None
        )
    finally:
        await connection.rollback()
        await connection.close()


async def test_rare_name_token_outweighs_a_common_building_category() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        await connection.execute("""INSERT INTO pois(id,region_id,location,tags) VALUES
          ('view-test-rare-name','sochi',ST_SetSRID(ST_MakePoint(0,0),4326),
           '{"name":"Кул-Шариф","amenity":"place_of_worship"}'),
          ('view-test-generic-a','sochi',ST_SetSRID(ST_MakePoint(0.01,0),4326),
           '{"name":"Мечеть Центральная","amenity":"place_of_worship"}'),
          ('view-test-generic-b','sochi',ST_SetSRID(ST_MakePoint(0.02,0),4326),
           '{"name":"Мечеть Новая","amenity":"place_of_worship"}')""")
        target = await PostgresNamedPlaceRepository(connection).by_name(
            "мечеть Кул-Шариф", (-0.1, -0.1, 0.1, 0.1), "amenity", ("place_of_worship",)
        )
        assert target is not None and target.id == "view-test-rare-name"
    finally:
        await connection.rollback()
        await connection.close()
