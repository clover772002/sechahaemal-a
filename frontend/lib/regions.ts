export type MacroRegionId =
  | "capital"
  | "gangwon"
  | "chungcheong"
  | "jeolla"
  | "gyeongsang"
  | "jeju";

export interface MacroRegion {
  id: MacroRegionId;
  label: string;
  anchor: string;
  lat: number;
  lng: number;
  gridArea: string;
}

export const MACRO_REGIONS: MacroRegion[] = [
  {
    id: "capital",
    label: "수도권",
    anchor: "서울",
    lat: 37.5665,
    lng: 126.978,
    gridArea: "capital",
  },
  {
    id: "gangwon",
    label: "강원",
    anchor: "춘천",
    lat: 37.8813,
    lng: 127.7298,
    gridArea: "gangwon",
  },
  {
    id: "chungcheong",
    label: "충청",
    anchor: "대전",
    lat: 36.3504,
    lng: 127.3845,
    gridArea: "chungcheong",
  },
  {
    id: "jeolla",
    label: "전라",
    anchor: "광주",
    lat: 35.1595,
    lng: 126.8526,
    gridArea: "jeolla",
  },
  {
    id: "gyeongsang",
    label: "경상",
    anchor: "대구",
    lat: 35.8714,
    lng: 128.6014,
    gridArea: "gyeongsang",
  },
  {
    id: "jeju",
    label: "제주",
    anchor: "제주",
    lat: 33.4996,
    lng: 126.5312,
    gridArea: "jeju",
  },
];

export function getMacroRegion(id: MacroRegionId): MacroRegion {
  const region = MACRO_REGIONS.find((item) => item.id === id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}
