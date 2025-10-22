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
            // Reset regex state (important for global flag)
            pattern.pattern.lastIndex = 0;
            
            // Use exec() instead of match() to get capture groups
            const match = pattern.pattern.exec(upperQuery);
            if (match) {
                // match[1] is the prefix, match[2] is the number
                // Reconstruct the model number with hyphen and trim whitespace
                const modelNumber = `${match[1]}-${match[2]}`.trim();
                return {
                    modelNumber: modelNumber,
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
            // Product-specific query: ONLY exact model OR category-common/general docs for that category
            // Explicitly exclude product-specific docs from other models
            return {
                $or: [
                    // Exact model match
                    { model_number: { $eq: modelNumber } },
                    // Category-common docs (not product-specific)
                    { 
                        $and: [
                            { specificity: { $eq: DocumentSpecificity.CATEGORY_COMMON } },
                            { product_category: { $eq: category } }
                        ]
                    },
                    // General docs (not product-specific)
                    { 
                        $and: [
                            { specificity: { $eq: DocumentSpecificity.GENERAL } },
                            { product_category: { $eq: category } }
                        ]
                    }
                ]
            };
        } else if (category) {
            // Category query: include category docs but exclude product-specific from other categories
            return {
                $and: [
                    {
                        $or: [
                            { product_category: { $eq: category } },
                            { specificity: { $eq: DocumentSpecificity.GENERAL } }
                        ]
                    },
                    // Exclude product-specific docs (they should only appear for exact model queries)
                    { specificity: { $ne: DocumentSpecificity.PRODUCT_SPECIFIC } }
                ]
            };
        }
        
        // General query: ONLY general and category-common docs, exclude all product-specific
        return {
            specificity: {
                $in: [DocumentSpecificity.GENERAL, DocumentSpecificity.CATEGORY_COMMON]
            }
        };
    }
}