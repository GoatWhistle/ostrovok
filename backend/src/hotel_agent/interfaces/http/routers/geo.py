from fastapi import APIRouter

from hotel_agent.application.use_cases.get_geo_features import GetGeoFeatures
from hotel_agent.interfaces.http.geo_schemas import (
    GeoFeatureBatchRequest,
    GeoFeatureCollectionSchema,
    geo_feature_schema,
)


def build_router(get_geo_features: GetGeoFeatures) -> APIRouter:
    router = APIRouter(tags=["geo"])

    @router.post("/geo-features:batch", response_model=GeoFeatureCollectionSchema)
    async def batch(request: GeoFeatureBatchRequest) -> GeoFeatureCollectionSchema:
        items = await get_geo_features(request.ids)
        return GeoFeatureCollectionSchema(features=[geo_feature_schema(item) for item in items])

    return router
