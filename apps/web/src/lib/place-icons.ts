import { pointIconSvg } from "./point-icons";
import type { PlaceCategory, PlaceGroup } from "./places";

/**
 * A small coloured picture for each kind of place in the directory (24 x 24 grid, flat colours, drawn for a white disc),
 * the same family as the waypoint pictures: toilets, rest areas, water, vending machines, stations, bus stops and parking
 * share theirs, and the shops and food places get their own. Fixed markup written here, never from user input.
 */
const INK = "#2b2523";
const RED = "#c0392b";
const BLUE = "#1e50a2";
const SKY = "#2a9bd8";
const AMBER = "#f2b705";
const WOOD = "#8a5a2b";
const STONE = "#8d8680";

export const placeIconSvg: Record<PlaceCategory, string> = {
  // A bowl of rice with a pickled plum on top and chopsticks.
  restaurant:
    `<path d="M4.4 15.4c.3-4.2 3.2-7.2 7.6-7.2s7.3 3 7.6 7.2z" fill="#fff" stroke="${STONE}" stroke-width="1"/><circle cx="12" cy="11.4" r="1.5" fill="${RED}"/>` +
    `<path d="M3 15.2h18a9 9 0 0 1-18 0z" fill="${RED}"/><rect x="8.6" y="21" width="6.8" height="1.6" rx=".8" fill="${INK}"/>` +
    `<path d="M15 2.5 11.6 10.6M18.4 3.6l-3.2 7.4" stroke="${WOOD}" stroke-width="1.5" stroke-linecap="round"/>`,
  // A coffee cup on a saucer with steam.
  cafe:
    `<path d="M8 2.8c-1.1 1.4 1.1 2.3 0 3.9M12 2.8c-1.1 1.4 1.1 2.3 0 3.9" fill="none" stroke="${STONE}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M4 9.2h13.2v4.4a5.4 5.4 0 0 1-5.4 5.4H9.4A5.4 5.4 0 0 1 4 13.6z" fill="${WOOD}"/><ellipse cx="10.6" cy="9.4" rx="6.6" ry="1.4" fill="#4a2c17"/>` +
    `<path d="M17.2 10.6h1.3a2.6 2.6 0 0 1 0 5.2h-2.1" fill="none" stroke="${WOOD}" stroke-width="1.8" stroke-linecap="round"/><rect x="2.4" y="19.6" width="17.6" height="2" rx="1" fill="${STONE}"/>`,
  // A wrapped gift with a ribbon.
  souvenir_shop:
    `<rect x="3.5" y="10.2" width="17" height="11" rx="1.6" fill="${RED}"/><rect x="2.5" y="7.4" width="19" height="4" rx="1.2" fill="#dc5a49"/><rect x="10.8" y="7.4" width="2.4" height="13.8" fill="${AMBER}"/>` +
    `<path d="M12 7.4C9.2 2 5.6 3.6 7.2 6c.9 1.4 4.8 1.4 4.8 1.4zM12 7.4C14.8 2 18.4 3.6 16.8 6c-.9 1.4-4.8 1.4-4.8 1.4z" fill="${AMBER}"/>`,
  // A small shop with a striped awning.
  convenience_store:
    `<rect x="3.5" y="9.6" width="17" height="11.6" fill="#fff" stroke="${BLUE}" stroke-width="1.3"/><path d="M3 3.6h18l1.4 6H1.6z" fill="${BLUE}"/>` +
    `<path d="M8.4 3.6 7.6 9.6M13 3.6v6M17.6 3.6l.8 6" stroke="#fff" stroke-width="1.5"/><rect x="9.4" y="13.2" width="5.2" height="8" fill="${SKY}"/><rect x="5" y="12.2" width="3" height="3.4" fill="${AMBER}"/>`,
  toilet: pointIconSvg.toilet,
  rest_area: pointIconSvg.rest_area,
  drinking_water: pointIconSvg.drinking_water,
  vending_machine: pointIconSvg.vending_machine,
  station: pointIconSvg.station,
  bus_stop: pointIconSvg.bus_stop,
  parking: pointIconSvg.parking,
  other: pointIconSvg.other,
};

/** The picture that stands for a whole group of places (a chip that turns the group on or off). */
export const groupPictureCategory: Record<PlaceGroup, PlaceCategory> = {
  rest: "toilet",
  shops: "restaurant",
  vending: "vending_machine",
  transport: "station",
  other: "other",
};
