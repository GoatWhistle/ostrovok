import type { components } from "@/shared/api/schema.gen"
import { SupplierAmenities } from "./supplier-amenities"
import { SupplierDescription } from "./supplier-description"
import { SupplierNearby } from "./supplier-nearby"
import { termPattern, wishTerms } from "./wish-terms"

type Details = components["schemas"]["SupplierDetails"]

export function SupplierDetails({
  details,
  wishes = [],
}: {
  readonly details: Details
  readonly wishes?: readonly string[]
}) {
  const pattern = termPattern(wishTerms(wishes))
  return (
    <>
      <SupplierDescription sections={details.description} pattern={pattern} />
      <SupplierAmenities groups={details.amenity_groups} pattern={pattern} />
      <SupplierNearby places={details.nearby} />
    </>
  )
}
