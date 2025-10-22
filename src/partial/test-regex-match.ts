import { MODEL_PATTERNS, ProductCategory } from "../models/document-tags.js";

const query = "Vorteile der DTT-2100";
const upperQuery = query.toUpperCase();

console.log("Testing query:", query);
console.log("Upper query:", upperQuery);
console.log("\n");

for (const [category, pattern] of Object.entries(MODEL_PATTERNS)) {
    console.log(`\n--- Testing category: ${category} ---`);
    console.log(`Pattern: ${pattern.pattern}`);
    
    const match = upperQuery.match(pattern.pattern);
    
    if (match) {
        console.log(`✅ MATCH FOUND!`);
        console.log(`Full match (match[0]):`, match[0]);
        console.log(`Group 1 (match[1]):`, match[1]);
        console.log(`Group 2 (match[2]):`, match[2]);
        console.log(`All groups:`, match);
        
        const modelNumber = `${match[1]}-${match[2]}`.trim();
        console.log(`Reconstructed model: ${modelNumber}`);
    } else {
        console.log(`❌ No match`);
    }
}
