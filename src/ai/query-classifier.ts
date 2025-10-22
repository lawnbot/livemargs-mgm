import { DocumentClassifier } from './document-classifier.js';
import { ProductCategory, DocumentSpecificity, MODEL_PATTERNS } from '../models/document-tags.js';

/**
 * Classify user query to determine search strategy
 */
export class QueryClassifier {
    
    /**
     * Extract model number from user query
     */
    static extractModelFromQuery(query: string): {
        modelNumber: string | null;
        category: ProductCategory | null;
    } {
        const upperQuery = query.toUpperCase();
        
        // Try each category pattern
        for (const [category, pattern] of Object.entries(MODEL_PATTERNS)) {
            const match = upperQuery.match(pattern.pattern);
            if (match) {
                return {
                    modelNumber: match[0],
                    category: category as ProductCategory
                };
            }
        }
        
        return { modelNumber: null, category: null };
    }
    
    /**
     * Build metadata filter for ChromaDB search
     */
    static buildSearchFilter(query: string): Record<string, any> | undefined {
        const { modelNumber, category } = this.extractModelFromQuery(query);
        
        if (modelNumber) {
            // Product-specific query: search for exact model OR category-common docs
            return {
                $or: [
                    { model_number: modelNumber },
                    { 
                        specificity: DocumentSpecificity.CATEGORY_COMMON,
                        product_category: category
                    }
                ]
            };
        } else if (category) {
            // Category query: exclude product-specific docs from other categories
            return {
                $or: [
                    { product_category: category },
                    { specificity: DocumentSpecificity.GENERAL }
                ]
            };
        }
        
        // General query: prefer general and category-common docs
        return {
            specificity: {
                $in: [DocumentSpecificity.GENERAL, DocumentSpecificity.CATEGORY_COMMON]
            }
        };
    }
}