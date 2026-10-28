export function hotelPoint(
  location: readonly number[] | null | undefined,
): [number, number] | undefined {
  const [lon, lat] = location ?? []
  if (
    typeof lon !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat)
  )
    return undefined
  if (Math.abs(lon) > 180 || Math.abs(lat) > 85.051129) return undefined
  return [lon, lat]
}
