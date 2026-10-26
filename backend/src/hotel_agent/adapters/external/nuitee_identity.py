from collections.abc import Mapping

from hotel_agent.domain.hotel_identity import HotelIdentity


def hotel_identity(data: Mapping[str, object]) -> HotelIdentity:
    name, country = data.get("name"), data.get("country")
    location = data.get("location")
    position = location if isinstance(location, dict) else data
    lon, lat = position.get("longitude"), position.get("latitude")
    if (
        not isinstance(name, str)
        or not name.strip()
        or not isinstance(country, str)
        or len(country) != 2
    ):
        raise ValueError("Hotel name and ISO-2 country are required")
    if (
        isinstance(lon, bool)
        or isinstance(lat, bool)
        or not isinstance(lon, (int, float))
        or not isinstance(lat, (int, float))
    ):
        raise TypeError("Hotel coordinates are required")
    address = data.get("address")
    return HotelIdentity(
        name=name,
        country=country.upper(),
        location=(float(lon), float(lat)),
        address=address if isinstance(address, str) and address.strip() else None,
    )
