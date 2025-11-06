export enum SearchMode {
  BROAD = "broad",
  BALANCED = "balanced",
  PRECISE = "precise",
}

export type Bm25Config = {
  k1: number;
  b: number;
};

export const BM25_CONFIGS: Record<SearchMode, Bm25Config> = {
  broad: {
    k1: 1.0, // Low k1 = less sensitive to term frequency
    b: 0.5, // Low b = less sensitive to document length
  },
  balanced: {
    k1: 1.2, // Standard BM25 value
    b: 0.75, // Standard BM25 value
  },
  precise: {
    k1: 1.5, // High k1 = more sensitive to term frequency
    b: 0.9, // High b = more sensitive to document length
  },
};

export const MIN_SCORE_RATIO = {
  broad: 0.1,
  balanced: 0.5,
  precise: 1.0,
};
