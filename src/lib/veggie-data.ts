// Browser-safe shared data & types (no map library imports here).
import {
  Carrot,
  Apple,
  Grape,
  Banana,
  Cherry,
  Salad,
  Leaf,
  Citrus,
  Sprout,
  Bean,
  Nut,
  Flame,
  Wheat,
  Vegan,
  type LucideIcon,
} from "lucide-react";

export type VeggieItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
  iconKey: string;
  icon: LucideIcon;
};

export const ICONS: Record<string, LucideIcon> = {
  carrot: Carrot,
  apple: Apple,
  grape: Grape,
  banana: Banana,
  cherry: Cherry,
  salad: Salad,
  leaf: Leaf,
  citrus: Citrus,
  sprout: Sprout,
  bean: Bean,
  nut: Nut,
  flame: Flame,
  wheat: Wheat,
  vegan: Vegan,
};

export function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Leaf;
}

/** Guess a produce icon from a free-text request like "blueberries". */
export function iconKeyFromName(name: string): string {
  const n = name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/berry|berries/, "cherry"],
    [/grape/, "grape"],
    [/banana|plantain/, "banana"],
    [/apple|pear|quince/, "apple"],
    [/orange|lemon|lime|naartjie|citrus|grapefruit/, "citrus"],
    [/carrot|beet|turnip|radish/, "carrot"],
    [/lettuce|salad|cabbage|broccoli/, "salad"],
    [/spinach|morogo|kale|herb|coriander|parsley/, "leaf"],
    [/bean|pea|lentil/, "bean"],
    [/chilli|chili|pepper|ginger/, "flame"],
    [/mielie|maize|corn|samp|rice|potato|butternut|pumpkin|onion/, "wheat"],
    [/nut|peanut|macadamia/, "nut"],
    [/avo|mango|pawpaw|papaya|melon/, "vegan"],
  ];
  for (const [re, key] of rules) if (re.test(n)) return key;
  return "sprout";
}

const base = (
  id: string,
  name: string,
  unit: string,
  price: number,
  iconKey: string,
): VeggieItem => ({ id, name, unit, price, iconKey, icon: iconFor(iconKey) });

export const CATALOG: VeggieItem[] = [
  base("carrots", "Carrots", "1kg", 22, "carrot"),
  base("spinach", "Spinach", "bunch", 15, "leaf"),
  base("lettuce", "Lettuce", "head", 18, "salad"),
  base("cabbage", "Cabbage", "head", 20, "salad"),
  base("potatoes", "Potatoes", "2kg", 38, "wheat"),
  base("onions", "Onions", "1kg", 20, "wheat"),
  base("butternut", "Butternut", "each", 25, "wheat"),
  base("tomatoes", "Tomatoes", "1kg", 28, "cherry"),
  base("chillies", "Chillies", "100g", 12, "flame"),
  base("apples", "Apples", "6 pack", 35, "apple"),
  base("bananas", "Bananas", "1kg", 24, "banana"),
  base("grapes", "Grapes", "500g", 40, "grape"),
  base("oranges", "Oranges", "2kg", 45, "citrus"),
  base("avocado", "Avocado", "each", 14, "vegan"),
];

/** Items promoted from repeated free-text requests. */
export type CustomItem = { id: string; name: string; unit: string; iconKey: string; price: number };

export function buildItem(c: CustomItem): VeggieItem {
  return { ...c, icon: iconFor(c.iconKey) };
}

export function catalogWith(custom: CustomItem[] = []): VeggieItem[] {
  return [...CATALOG, ...custom.map(buildItem)];
}

export type StockLine = { itemId: string; price: number };

export type Runner = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  online: boolean;
  rating: number;
  avatar?: string | null;
  stock: StockLine[];
  earnings: number;
};

export const BUYER_POSITION = { lat: -33.9249, lng: 18.4241 };

const stock = (entries: [string, number][]): StockLine[] =>
  entries.map(([itemId, price]) => ({ itemId, price }));

export const SEED_RUNNERS: Runner[] = [
  {
    id: "r1",
    name: "Thabo",
    lat: -33.9221,
    lng: 18.4189,
    online: true,
    rating: 4.8,
    earnings: 0,
    stock: stock([
      ["carrots", 20],
      ["spinach", 14],
      ["potatoes", 36],
      ["onions", 20],
      ["tomatoes", 26],
      ["bananas", 22],
    ]),
  },
  {
    id: "r2",
    name: "Nomsa",
    lat: -33.9302,
    lng: 18.4288,
    online: true,
    rating: 4.9,
    earnings: 0,
    stock: stock([
      ["spinach", 15],
      ["cabbage", 18],
      ["butternut", 24],
      ["apples", 34],
      ["oranges", 42],
      ["avocado", 12],
    ]),
  },
  {
    id: "r3",
    name: "Sipho",
    lat: -33.9188,
    lng: 18.4335,
    online: true,
    rating: 4.6,
    earnings: 0,
    stock: stock([
      ["potatoes", 40],
      ["onions", 22],
      ["chillies", 10],
      ["tomatoes", 30],
      ["grapes", 38],
    ]),
  },
  {
    id: "r4",
    name: "Lerato",
    lat: -33.9345,
    lng: 18.4152,
    online: false,
    rating: 4.7,
    earnings: 0,
    stock: stock([
      ["lettuce", 16],
      ["carrots", 24],
      ["apples", 36],
    ]),
  },
];

export function priceFor(runner: Runner, itemId: string): number | null {
  return runner.stock.find((s) => s.itemId === itemId)?.price ?? null;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkMinutes(km: number) {
  return Math.max(2, Math.round(km * 9));
}

export function formatRand(amount: number) {
  return `R${amount.toFixed(2)}`;
}
