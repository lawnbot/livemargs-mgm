import { DocumentClassifier } from "../ai/document-classifier.js";
import { ProductCategory } from "../models/document-tags.js";

// Test filenames
const testFilenames = [
    "CS-4010_product_tips.pdf",
    "DSRM-2600_product_tips.pdf",
    "DTT-2100_product_tips.pdf",
    "DHC-2200R_DHC-2800R_product_tips.pdf",
    "CS-4510ES_product_tips.pdf"
];

console.log("🧪 Testing model number extraction from filenames:\n");

for (const filename of testFilenames) {
    console.log(`\n--- Testing: ${filename} ---`);
    
    // Test category detection
    const category = DocumentClassifier.detectProductCategory(
        filename,
        "/uploads/rag/ope-collection/" + filename,
        "Test content"
    );
    console.log(`Category: ${category}`);
    
    // Test model extraction
    const models = DocumentClassifier.extractModelNumbers(filename, category);
    console.log(`Extracted models: ${models.length > 0 ? models.join(", ") : "❌ NONE"}`);
    
    // Full classification
    const tags = DocumentClassifier.classifyDocument(
        filename,
        "/uploads/rag/ope-collection/" + filename,
        "Test content with some text",
        "ope-collection"
    );
    
    console.log(`Classification:`);
    console.log(`  - Model Number: ${tags.model_number || "❌ MISSING"}`);
    console.log(`  - Specificity: ${tags.specificity}`);
    console.log(`  - Power Type: ${tags.power_type}`);
}
