from typing import Literal

from pydantic import BaseModel, Field

from hotel_agent.application.dto import GeoFeatureRecord


class GeoFeatureBatchRequest(BaseModel):
    ids: list[str] = Field(max_length=200)


class GeoFeatureSchema(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: dict[str, object]
    properties: dict[str, object]


class GeoFeatureCollectionSchema(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GeoFeatureSchema]


def geo_feature_schema(item: GeoFeatureRecord) -> GeoFeatureSchema:
    return GeoFeatureSchema(
        id=item.id,
        geometry=item.geometry,
        properties={
            "kind": item.kind,
            "characteristic_key": item.characteristic_key,
            "name": item.name,
            "label": item.label,
            "osm_ref": item.osm_ref,
            "style_hint": item.style_hint,
        },
    )
