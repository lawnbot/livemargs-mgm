import {
    DocumentSpecificity,
    DocumentTags,
    MODEL_PATTERNS,
    OPE_BATTERY_PREFIXES,
    POWER_TYPE_KEYWORDS,
    PowerType,
    ProductCategory,
} from "../models/document-tags.js";

/**
 * Classify a document based on its content and metadata
 */
export class DocumentClassifier {
    /**
     * Extract model numbers from text
     */
    static extractModelNumbers(
        text: string,
        category: ProductCategory | null,
    ): string[] {
        if (!category) return [];

        const pattern = MODEL_PATTERNS[category];
        if (!pattern) return [];

        const matches = text.matchAll(pattern.pattern);
        const modelNumbers = new Set<string>();

        for (const match of matches) {
            // match[1] is the prefix (e.g., "CS"), match[2] is the number (e.g., "4010")
            // Reconstruct the full model number with hyphen
            const modelNumber = `${match[1]}-${match[2]}`.toUpperCase();
            modelNumbers.add(modelNumber);
        }

        return Array.from(modelNumbers);
    }

    /**
     * Determine product category from filename, path, or content
     */
    static detectProductCategory(
        filename: string,
        filePath: string,
        content: string,
    ): ProductCategory | null {
        const fullText = `${filename} ${filePath} ${content}`.toLowerCase();

        // Check for category keywords
        if (
            fullText.includes("robot") || fullText.includes("/robot-") ||
            fullText.includes("\\robot-")
        ) {
            return ProductCategory.ROBOT;
        }
        if (
            fullText.includes("ope-") || fullText.includes("/ope-") ||
            fullText.includes("\\ope-")
        ) {
            return ProductCategory.OPE;
        }
        if (
            fullText.includes("erco-") || fullText.includes("/erco-") ||
            fullText.includes("\\erco-")
        ) {
            return ProductCategory.ERCO;
        }

        // Check for model patterns in content
        for (const [category, pattern] of Object.entries(MODEL_PATTERNS)) {
            if (pattern.pattern.test(content)) {
                return category as ProductCategory;
            }
        }

        return null;
    }

    /**
     * Detect power type from content and model number
     */
    static detectPowerType(
        content: string,
        modelNumber: string | null,
        category: ProductCategory | null,
    ): PowerType {
        // SAFE DETECTION: OPE models with 'D', 'LBP', or 'LCJQ' prefix are BATTERY-powered
        if (category === ProductCategory.OPE && modelNumber) {
            const upperModel = modelNumber.toUpperCase();
            if (
                OPE_BATTERY_PREFIXES.some((prefix) =>
                    upperModel.startsWith(prefix)
                )
            ) {
                return PowerType.BATTERY;
            }
        }
        if (category === ProductCategory.ROBOT && modelNumber) {
            return PowerType.BATTERY;
        }

        // Fallback to keyword-based detection
        const lowerContent = content.toLowerCase();

        const batteryMatches = POWER_TYPE_KEYWORDS.battery.filter(
            (keyword) => lowerContent.includes(keyword),
        ).length;

        const fuelMatches = POWER_TYPE_KEYWORDS.fuel.filter(
            (keyword) => lowerContent.includes(keyword),
        ).length;

        if (batteryMatches > fuelMatches && batteryMatches > 0) {
            return PowerType.BATTERY;
        } else if (fuelMatches > batteryMatches && fuelMatches > 0) {
            return PowerType.FUEL;
        }

        return PowerType.UNKNOWN;
    }

    /**
     * Determine document specificity
     */
    static detectSpecificity(
        modelNumbers: string[],
        category: ProductCategory | null,
        filename: string,
    ): DocumentSpecificity {
        // Check filename for hints
        const lowerFilename = filename.toLowerCase();

        if (
            lowerFilename.includes("general") ||
            lowerFilename.includes("overview")
        ) {
            return DocumentSpecificity.GENERAL;
        }

        // Check if any model number appears in the filename
        const modelInFilename = modelNumbers.some(
            (model) => lowerFilename.includes(model.toLowerCase()),
        );

        // If model number found in filename, it's product-specific
        if (modelInFilename) {
            // Even if multiple models in content, if one is in filename, it's that product's doc
            return DocumentSpecificity.PRODUCT_SPECIFIC;
        }

        // If specific model number found in content (even if not in filename)
        if (modelNumbers.length === 1) {
            return DocumentSpecificity.PRODUCT_SPECIFIC;
        }

        // If multiple models found in content (and none in filename)
        if (modelNumbers.length > 1) {
            return DocumentSpecificity.CATEGORY_COMMON;
        }

        // If category detected but no specific model
        if (category && modelNumbers.length === 0) {
            return DocumentSpecificity.CATEGORY_COMMON;
        }

        return DocumentSpecificity.GENERAL;
    }

    /**
     * Extract model series (e.g., "TM" from "TM-850")
     */
    static extractModelSeries(modelNumber: string | null): string | null {
        if (!modelNumber) return null;

        const match = modelNumber.match(/^([A-Z]+)/);
        return match ? match[1] : null;
    }

    /**
     * Full classification of a document
     */
    static classifyDocument(
        filename: string,
        filePath: string,
        content: string,
        collectionName: string,
    ): DocumentTags {
        // Detect category
        const category = this.detectProductCategory(
            filename,
            filePath,
            content,
        );

        // PRIORITY 1: Extract model number from filename first (most reliable)
        const filenameModels = category
            ? this.extractModelNumbers(filename, category)
            : [];
        
        // PRIORITY 2: Extract from content (for documents without model in filename)
        const contentModels = category && filenameModels.length === 0
            ? this.extractModelNumbers(content, category)
            : [];
        
        // Combine: prefer filename models, fallback to content models
        const modelNumbers = filenameModels.length > 0 ? filenameModels : contentModels;
        const primaryModel = modelNumbers[0] || null;

        // Detect power type (now with model-based detection)
        const powerType = this.detectPowerType(content, primaryModel, category);

        // Determine specificity (using filename to prioritize)
        const specificity = this.detectSpecificity(
            modelNumbers,
            category,
            filename,
        );

        return {
            product_category: category,
            power_type: powerType,
            model_number: primaryModel,
            model_series: this.extractModelSeries(primaryModel),
            specificity: specificity,
            applicable_models: modelNumbers.length > 1
                ? modelNumbers
                : undefined,
            tags: [
                collectionName,
                category || "uncategorized",
                specificity,
                powerType,
            ].filter(Boolean),
        };
        /*.filter(Boolean): Means to filter out falsy values like. For category there is a fallback to uncategorized
            undefined, null, false, 0, "" (empty string)
        */
    }
}
