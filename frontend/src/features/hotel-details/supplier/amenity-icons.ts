import en from "@/shared/i18n/locales/en/explore.json"
import ru from "@/shared/i18n/locales/ru/explore.json"
import type { IconName } from "@/shared/ui"

type Group = keyof typeof ru.supplierAmenityGroup
type Amenity = keyof typeof ru.supplierAmenity

const GROUP_ICONS: Readonly<Record<Group, IconName>> = {
  general: "building",
  inRooms: "room",
  services: "service",
  meals: "meals",
  internet: "wifi",
  languages: "languages",
  entertainment: "entertainment",
  sports: "fitness",
  kids: "kids",
  pets: "pets",
  poolBeach: "waves",
  business: "business",
  accessibility: "accessibility",
  wellness: "wellness",
  parking: "parking",
  hygiene: "security",
  transfer: "transfer",
  tourism: "compass",
}

const ITEM_ICONS: Readonly<Partial<Record<Amenity, IconName>>> = {
  vipAmenities: "star",
  firstAid: "wellness",
  banya: "wellness",
  bar: "bar",
  pool: "waves",
  heatedPool: "waves",
  freeWifi: "wifi",
  freeInternet: "wifi",
  freeTeaCoffee: "meals",
  fullBoard: "meals",
  halfBoard: "meals",
  ironingKit: "ironing",
  ironingService: "ironing",
  playground: "kids",
  kidsPool: "waves",
  jacuzzi: "wellness",
  intercom: "service",
  breakfast: "meals",
  privateCheckIn: "time",
  cableTv: "tv",
  airConditioning: "air-conditioning",
  conferenceHall: "business",
  frontDesk24: "service",
  indoorPool: "waves",
  copier: "business",
  elevator: "elevator",
  honeymoonSuite: "room",
  outdoorFurniture: "home",
  smokingArea: "smoking",
  allergyRooms: "room",
  nonSmokingRooms: "non-smoking",
  soundproofRooms: "noise",
  roomService: "service",
  fireExtinguisher: "security",
  banquets: "meals",
  nonSmokingHotel: "non-smoking",
  outdoorPool: "waves",
  heatedOutdoorPool: "waves",
  heating: "heating",
  noElevator: "minus",
  security: "security",
  parkingOnRequest: "parking",
  parkingNearby: "parking",
  steamRoom: "wellness",
  hiking: "walk",
  events: "entertainment",
  lateCheckOut: "time",
  beachTowels: "waves",
  laundry: "laundry",
  entertainmentEvents: "entertainment",
  waterActivities: "waves",
  familyFriendly: "kids",
  petsAllowed: "pets",
  petsNotAllowed: "minus",
  earlyCheckIn: "time",
  restaurant: "meals",
  buffetRestaurant: "meals",
  accessibleRestaurant: "accessibility",
  sauna: "wellness",
  inRoomSafe: "security",
  familyRooms: "guests",
  washingMachine: "laundry",
  dryer: "laundry",
  tv: "tv",
  lobbyTv: "tv",
  phone: "phone",
  tennisCourt: "fitness",
  terrace: "home",
  sunTerrace: "home",
  transfer: "transfer",
  airportTransfer: "transfer",
  beachAmenities: "waves",
  packedLunches: "meals",
  disinfection: "security",
  expressCheckIn: "time",
  concierge: "service",
  iron: "ironing",
  hairDryerOnRequest: "service",
  bathrobe: "ironing",
  fridge: "fridge",
  luggageStorage: "luggage",
  privateBeach: "waves",
  tourDesk: "compass",
  english: "languages",
  russian: "languages",
  atm: "atm",
  shops: "shops",
  dishwasher: "kitchen",
  cafe: "meals",
  kitchen: "kitchen",
  sharedKitchen: "kitchen",
  microwave: "microwave",
}

const normalized = (value: string) => value.trim().toLocaleLowerCase()
const groups = new Map<string, IconName>()
const items = new Map<string, IconName>()
for (const slug of Object.keys(GROUP_ICONS) as Group[])
  for (const copy of [ru, en])
    groups.set(normalized(copy.supplierAmenityGroup[slug]), GROUP_ICONS[slug])
for (const slug of Object.keys(ITEM_ICONS) as Amenity[]) {
  const icon = ITEM_ICONS[slug]
  if (icon) for (const copy of [ru, en]) items.set(normalized(copy.supplierAmenity[slug]), icon)
}

export function amenityGroupIcon(name: string): IconName {
  return groups.get(normalized(name)) ?? "list"
}

export function amenityIcon(name: string, group: string): IconName {
  return items.get(normalized(name)) ?? amenityGroupIcon(group)
}
