import type { Quote } from "./yahoo";
import type { EtfSuggestion } from "./engine";

export type { Quote, EtfSuggestion };

export type IndexRow = {
  symbol: string;
  name: string;
  short: string;
  group: "Broad" | "Sector" | "Commodity";
  featured: boolean;
  quote: Quote | null;
  etfCount: number;
};

export type SuggestionGroup = {
  indexSymbol: string;
  indexName: string;
  changePct: number;
  etfs: EtfSuggestion[];
};

export type MarketPayload = {
  asOf: string;
  asOfIst: string;
  market: { open: boolean; label: string; detail: string };
  indices: IndexRow[];
  suggestions: SuggestionGroup[];
  errors: Record<string, string>;
};

export type RuleRow = {
  id: string;
  symbol: string;
  label: string;
  direction: string;
  thresholdPct: number;
  basis: string;
  enabled: boolean;
  cooldownMinutes: number;
  channels: string;
  lastTriggeredAt: string | null;
  createdAt: string;
};

export type EventRow = {
  id: string;
  symbol: string;
  label: string;
  price: number;
  prevClose: number;
  changePct: number;
  basis: string;
  title: string;
  message: string;
  etfs: EtfSuggestion[] | null;
  read: boolean;
  telegramSent: boolean;
  emailSent: boolean;
  deliveryLog: string | null;
  createdAt: string;
};
