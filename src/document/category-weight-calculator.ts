import { CATEGORY_WEIGHTS, Category } from "../constants/category.js";
import { Result } from "./bm25-calculator.js";
import { Document } from "./document.js";

export class CategoryWeightCalculator {
  private readonly weights: Record<Category, number>;

  constructor(customWeights?: Partial<Record<Category, number>>) {
    this.weights = { ...CATEGORY_WEIGHTS, ...customWeights };
  }

  /**
   * Apply category-based weights to BM25 results and reorder
   */
  apply(results: Result[], documents: Document[]): Result[] {
    // Create Map for fast lookup by document ID
    const documentMap = this.createDocumentMap(documents);

    return results
      .map((result) => {
        const document = documentMap.get(result.id);
        if (!document) {
          console.warn(`Document not found for id: ${result.id}`);
          return result;
        }

        const categoryWeight = this.weights[document.category];

        return {
          ...result,
          score: result.score * categoryWeight,
        };
      })
      .sort((a, b) => b.score - a.score); // Reorder after applying weights
  }

  /**
   * Update weight for specific category
   */
  updateWeight(category: Category, weight: number): void {
    this.weights[category] = weight;
  }

  /**
   * Get current weight settings
   */
  getWeights(): Readonly<Record<Category, number>> {
    return this.weights;
  }

  /**
   * Get weight for specific category
   */
  getWeight(category: Category): number {
    return this.weights[category];
  }

  /**
   * Convert document array to ID-based Map (performance optimization)
   */
  private createDocumentMap(
    documents: Document[]
  ): Map<number, Document> {
    const map = new Map<number, Document>();
    for (const doc of documents) {
      map.set(doc.id, doc);
    }
    return map;
  }
}
