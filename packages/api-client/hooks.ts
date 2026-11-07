"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";
import { api, type DataQuery, type IndicatorQuery, type SeriesQuery } from "./endpoints";

const STALE_MS = 5 * 60 * 1000;
const GC_MS = 30 * 60 * 1000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // apiFetch already retries network failures once.
      queries: { staleTime: STALE_MS, gcTime: GC_MS, retry: false },
    },
  });
}

export function usePillars(locale: string) {
  return useQuery({
    queryKey: ["pillars", locale],
    queryFn: ({ signal }) => api.pillars({ locale, signal }),
  });
}

export function useIndicators(locale: string, query: IndicatorQuery = {}) {
  return useQuery({
    queryKey: ["indicators", locale, query],
    queryFn: ({ signal }) => api.indicators({ locale, signal }, query),
  });
}

export function useIndicator(locale: string, code: string) {
  return useQuery({
    queryKey: ["indicator", locale, code],
    queryFn: ({ signal }) => api.indicator({ locale, signal }, code),
  });
}

export function useAreas(locale: string, query: { level?: string; parent?: string } = {}) {
  return useQuery({
    queryKey: ["areas", locale, query],
    queryFn: ({ signal }) => api.areas({ locale, signal }, query),
  });
}

export function useSeries(locale: string, query: SeriesQuery) {
  return useQuery({
    queryKey: ["series", locale, query],
    queryFn: ({ signal }) => api.series({ locale, signal }, query),
  });
}

export function useData(locale: string, query: DataQuery) {
  return useQuery({
    queryKey: ["data", locale, query],
    queryFn: ({ signal }) => api.data({ locale, signal }, query),
  });
}

export function useBenchmark(
  locale: string,
  query: { indicator: string; group: string; year?: string },
) {
  return useQuery({
    queryKey: ["benchmark", locale, query],
    queryFn: ({ signal }) => api.benchmark({ locale, signal }, query),
  });
}
