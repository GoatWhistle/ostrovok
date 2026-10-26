from collections.abc import Sequence

from hotel_agent.application.dto import GeoFeatureRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.walk_refs import parse_walk_ref, walk_feature


class GetGeoFeatures:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]:
        async with self._uow() as uow:
            features = list(await uow.geo_features.get_batch(ids))
            walks: dict[str, list[str]] = {}
            for id in ids:
                if pair := parse_walk_ref(id):
                    walks.setdefault(pair[0], []).append(pair[1])
            for hotel_id, targets in walks.items():
                paths = await uow.walk.routes(hotel_id, targets[:5], 500)
                features.extend(walk_feature(path) for path in paths)
            by_id = {feature.id: feature for feature in features}
            return [by_id[id] for id in dict.fromkeys(ids) if id in by_id]
