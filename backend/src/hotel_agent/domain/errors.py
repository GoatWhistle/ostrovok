class DomainError(Exception):
    code = "domain_error"
    message = "Request failed"

    def __init__(self, message: str | None = None) -> None:
        if message is not None:
            self.message = message
        super().__init__(self.message)


class NotFound(DomainError):
    code = "not_found"
    message = "Not found"


class TerrainNotFound(NotFound):
    message = "Terrain tile not found"


class PlaceNotFound(NotFound):
    message = "Place not found"


class HotelNotFound(NotFound):
    message = "Hotel not found"


class ConversationNotFound(NotFound):
    message = "Conversation not found"


class FactNotFound(NotFound):
    message = "Fact not found"


class QuestionNotFound(NotFound):
    message = "Question not found"


class RegionNotFound(NotFound):
    message = "Region not found"


class MapVersionChanged(DomainError):
    code = "map_version_changed"
    message = "Map data version changed; reload the map style"


class InvalidValue(DomainError):
    code = "invalid_value"
    message = "Value is outside its allowed range"


class UnknownCharacteristic(DomainError):
    code = "unknown_characteristic"
    message = "Characteristic is not registered"


class InvalidRegistry(DomainError):
    code = "invalid_registry"
    message = "Characteristic registry is invalid"


class InvalidQuery(DomainError):
    code = "invalid_query"
    message = "Search query is invalid"


class InvalidConversationTitle(InvalidQuery):
    code = "invalid_title"
    message = "Conversation title must be 1 to 80 characters"


class ModelFailure(DomainError):
    code = "model_failure"
    message = "Language model failed"
