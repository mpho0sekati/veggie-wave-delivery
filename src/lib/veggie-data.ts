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
  type LucideIcon,
} from "lucide-react";

export type VeggieItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
  icon: LucideIcon;
};

export const CATALOG: VeggieItem[] = [
  { id: "carrots", name: "Carrots", unit: "1kg", price: 22, icon: Carrot },
  { id: "spinach", name: "Spinach", unit: "bunch", price: 15, icon: Leaf },
  { id: "lettuce", name: "Lettuce", unit: "head", price: 18, icon: Salad },
  { id: "apples", name: "Apples", unit: "6 pack", price: 35, icon: Apple },
  { id: "bananas", name: "Bananas", unit: "1kg", price: 24, icon: Banana },
  { id: "grapes", name: "Grapes", unit: "500g", price: 40, icon: Grape },
  { id: "oranges", name: "Oranges", unit: "2kg", price: 45, icon: Citrus },
  { id: "tomatoes", name: "Tomatoes", unit: "1kg", price: 28, icon: Cherry },
];

export type Runner = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  online: boolean;
  rating: number;
  avatar?: string | null;
};

export const BUYER_POSITION = { lat: -33.9249, lng: 18.4241 };

export const SEED_RUNNERS: Runner[] = [
  { id: "r1", name: "Thabo", lat: -33.9221, lng: 18.4189, online: true, rating: 4.8 },
  { id: "r2", name: "Nomsa", lat: -33.9302, lng: 18.4288, online: true, rating: 4.9 },
  { id: "r3", name: "Sipho", lat: -33.9188, lng: 18.4335, online: true, rating: 4.6 },
  { id: "r4", name: "Lerato", lat: -33.9345, lng: 18.4152, online: false, rating: 4.7 },
];

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

export function formatRand(cents: number) {
  return `R${cents.toFixed(2)}`;
}
