export interface BasketItem {
  id: string;
  barcode?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface PriceHistoryEntry {
  lastPrice: number;
  lastStore: string;
  lastDate: string;
}

export interface TripItem {
  id: string;
  barcode?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
}

export interface Trip {
  id: string;
  date: string;
  time: string;
  store: string;
  storeIcon: string;
  total: number;
  currency: string;
  items: TripItem[];
}

export type Language = "ar" | "fr" | "en";
