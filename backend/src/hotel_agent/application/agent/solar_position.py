from datetime import datetime
from math import asin, atan2, cos, degrees, pi, radians, sin, tan


def solar_position(at: datetime, longitude: float, latitude: float) -> dict[str, float]:
    if at.utcoffset() is None:
        raise ValueError("Solar calculation requires an explicit UTC offset")
    days = at.timestamp() / 86400 - 10957.5
    anomaly = radians(357.5291 + 0.98560028 * days)
    center = radians(1.9148 * sin(anomaly) + 0.02 * sin(2 * anomaly) + 0.0003 * sin(3 * anomaly))
    longitude_sun = anomaly + center + radians(102.9372) + pi
    obliquity = radians(23.4397)
    declination = asin(sin(longitude_sun) * sin(obliquity))
    ascension = atan2(sin(longitude_sun) * cos(obliquity), cos(longitude_sun))
    hour_angle = radians(280.16 + 360.9856235 * days + longitude) - ascension
    phi = radians(latitude)
    azimuth = atan2(sin(hour_angle), cos(hour_angle) * sin(phi) - tan(declination) * cos(phi))
    altitude = asin(sin(phi) * sin(declination) + cos(phi) * cos(declination) * cos(hour_angle))
    return {
        "sun_azimuth_deg": round((degrees(azimuth) + 180) % 360, 2),
        "sun_altitude_deg": round(degrees(altitude), 2),
        "daylight": float(altitude > 0),
    }
