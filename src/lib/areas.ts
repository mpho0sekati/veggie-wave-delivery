export type Area = {
  name: string;
  province: "Gauteng" | "Western Cape" | "KwaZulu-Natal";
  lat: number;
  lng: number;
};

/** Township centres a buyer can jump to when GPS is off or they order for someone else. */
export const AREAS: Area[] = [
  { name: "Soweto", province: "Gauteng", lat: -26.2485, lng: 27.854 },
  { name: "Alexandra", province: "Gauteng", lat: -26.1035, lng: 28.0966 },
  { name: "Tembisa", province: "Gauteng", lat: -25.9964, lng: 28.2268 },
  { name: "Mamelodi", province: "Gauteng", lat: -25.7097, lng: 28.3943 },
  { name: "Diepsloot", province: "Gauteng", lat: -25.9333, lng: 28.0122 },
  { name: "Joburg CBD", province: "Gauteng", lat: -26.2041, lng: 28.0473 },
  { name: "Khayelitsha", province: "Western Cape", lat: -34.0405, lng: 18.6778 },
  { name: "Mitchells Plain", province: "Western Cape", lat: -34.0466, lng: 18.6186 },
  { name: "Gugulethu", province: "Western Cape", lat: -33.9786, lng: 18.5675 },
  { name: "Langa", province: "Western Cape", lat: -33.9436, lng: 18.5277 },
  { name: "Cape Town CBD", province: "Western Cape", lat: -33.9249, lng: 18.4241 },
  { name: "Umlazi", province: "KwaZulu-Natal", lat: -29.9707, lng: 30.8835 },
  { name: "KwaMashu", province: "KwaZulu-Natal", lat: -29.7445, lng: 30.9792 },
  { name: "Inanda", province: "KwaZulu-Natal", lat: -29.6983, lng: 30.9533 },
  { name: "Durban CBD", province: "KwaZulu-Natal", lat: -29.8587, lng: 31.0218 },
];

export const PROVINCES = ["Gauteng", "Western Cape", "KwaZulu-Natal"] as const;

export function searchAreas(query: string): Area[] {
  const q = query.trim().toLowerCase();
  if (!q) return AREAS;
  return AREAS.filter(
    (a) => a.name.toLowerCase().includes(q) || a.province.toLowerCase().includes(q),
  );
}
