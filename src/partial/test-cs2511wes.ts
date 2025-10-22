import { DocumentClassifier } from "../ai/document-classifier.js";

const testCases = [
    "CS-2511WES_product_tips.pdf",
    "DHCAS-2600HD_product_tips.pdf"
];

testCases.forEach(testFilename => {
    console.log(`\nTesting: ${testFilename}`);
    console.log("=".repeat(50));

    const tags = DocumentClassifier.classifyDocument(
        testFilename,
        "/uploads/rag/ope-collection/" + testFilename,
        "Test content about product",
        "ope-collection"
    );

    console.log("Classification Results:");
    console.log(`  Model Number: ${tags.model_number || "❌ NOT RECOGNIZED"}`);
    console.log(`  Model Series: ${tags.model_series}`);
    console.log(`  Product Category: ${tags.product_category}`);
    console.log(`  Specificity: ${tags.specificity}`);
    console.log(`  Power Type: ${tags.power_type}`);

    const expectedModel = testFilename.split("_")[0];
    if (tags.model_number === expectedModel) {
        console.log(`\n✅ ${expectedModel} is correctly recognized!`);
    } else {
        console.log(`\n❌ Expected ${expectedModel} but got ${tags.model_number}`);
    }
});
