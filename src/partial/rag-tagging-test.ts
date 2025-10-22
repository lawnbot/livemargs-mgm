import { AIServiceType } from "../ai/ai-interface.js";
import { getChromaManagerByServiceType } from "../db/chroma-mgm.js";
import { DocumentClassifier } from "../ai/document-classifier.js";
import { ProductCategory, PowerType, DocumentSpecificity } from "../models/document-tags.js";

console.log("=".repeat(80));
console.log("🔍 DOCUMENT TAGGING VERIFICATION SCRIPT");
console.log("=".repeat(80));
console.log();

// Test cases for classification
const testCases = [
    {
        name: "Robot-specific Document",
        filename: "TM-850-manual.pdf",
        filePath: "/uploads/rag/robot-collection/TM-850-manual.pdf",
        content: "The TM-850 robotic mower features advanced navigation. Battery capacity: 5.0Ah Li-ion.",
        collectionName: "robot-collection",
        expected: {
            category: ProductCategory.ROBOT,
            powerType: PowerType.BATTERY,
            modelNumber: "TM-850",
            modelSeries: "TM",
            specificity: DocumentSpecificity.PRODUCT_SPECIFIC,
        }
    },
    {
        name: "OPE Battery Model (D-prefix)",
        filename: "DCS-5000-guide.pdf",
        filePath: "/uploads/rag/ope-collection/DCS-5000-guide.pdf",
        content: "The DCS-5000 is a powerful cordless chainsaw with 50cm bar length.",
        collectionName: "ope-collection",
        expected: {
            category: ProductCategory.OPE,
            powerType: PowerType.BATTERY,
            modelNumber: "DCS-5000",
            modelSeries: "DCS",
            specificity: DocumentSpecificity.PRODUCT_SPECIFIC,
        }
    },
    {
        name: "OPE Fuel Model",
        filename: "CS-370-manual.pdf",
        filePath: "/uploads/rag/ope-collection/CS-370-manual.pdf",
        content: "The CS-370 chainsaw uses a 2-stroke engine. Mix fuel at 50:1 ratio with gasoline.",
        collectionName: "ope-collection",
        expected: {
            category: ProductCategory.OPE,
            powerType: PowerType.FUEL,
            modelNumber: "CS-370",
            modelSeries: "CS",
            specificity: DocumentSpecificity.PRODUCT_SPECIFIC,
        }
    },
    {
        name: "OPE LBP Battery Series",
        filename: "LBP-560-instructions.pdf",
        filePath: "/uploads/rag/ope-collection/LBP-560-instructions.pdf",
        content: "The LBP-560 lithium battery powered blower delivers excellent performance.",
        collectionName: "ope-collection",
        expected: {
            category: ProductCategory.OPE,
            powerType: PowerType.BATTERY,
            modelNumber: "LBP-560",
            modelSeries: "LBP",
            specificity: DocumentSpecificity.PRODUCT_SPECIFIC,
        }
    },
    {
        name: "ERCO Leaf Blower",
        filename: "EB-9013-manual.pdf",
        filePath: "/uploads/rag/erco-collection/ES-250-manual.pdf",
        content: "The ES-9013 leaf blower is ideal for gardeners.",
        collectionName: "erco-collection",
        expected: {
            category: ProductCategory.ERCO,
            powerType: PowerType.FUEL,
            modelNumber: "EB-9013",
            modelSeries: "EB",
            specificity: DocumentSpecificity.PRODUCT_SPECIFIC,
        }
    },
    {
        name: "Category Common Document",
        filename: "Robot-maintenance-guide.pdf",
        filePath: "/uploads/rag/robot-collection/Robot-maintenance-guide.pdf",
        content: "General maintenance procedures for robotic mowers. Applicable to all TM and RP series.",
        collectionName: "robot-collection",
        expected: {
            category: ProductCategory.ROBOT,
            powerType: PowerType.UNKNOWN,
            modelNumber: null,
            specificity: DocumentSpecificity.CATEGORY_COMMON,
        }
    },
    {
        name: "General Safety Document",
        filename: "General-safety-overview.pdf",
        filePath: "/uploads/rag/robot-collection/General-safety-overview.pdf",
        content: "General safety guidelines for all power equipment users.",
        collectionName: "robot-collection",
        expected: {
            category: ProductCategory.ROBOT,
            powerType: PowerType.UNKNOWN,
            specificity: DocumentSpecificity.GENERAL,
        }
    },
    {
        name: "Multiple Models Document",
        filename: "TM-series-comparison.pdf",
        filePath: "/uploads/rag/robot-collection/TM-series-comparison.pdf",
        content: "Comparison of TM-850, TM-2000, and TM-2050 models. All feature Li-ion batteries.",
        collectionName: "robot-collection",
        expected: {
            category: ProductCategory.ROBOT,
            powerType: PowerType.BATTERY,
            specificity: DocumentSpecificity.CATEGORY_COMMON,
            applicableModels: ["TM-850", "TM-2000", "TM-2050"],
        }
    },
];

// Run classifier tests
console.log("📋 RUNNING CLASSIFIER TESTS");
console.log("-".repeat(80));
console.log();

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
    console.log(`\n🧪 Test: ${testCase.name}`);
    console.log(`   File: ${testCase.filename}`);
    
    const result = DocumentClassifier.classifyDocument(
        testCase.filename,
        testCase.filePath,
        testCase.content,
        testCase.collectionName
    );
    
    // Check results
    const checks = [
        { 
            name: "Product Category", 
            actual: result.product_category, 
            expected: testCase.expected.category,
            match: result.product_category === testCase.expected.category
        },
        { 
            name: "Power Type", 
            actual: result.power_type, 
            expected: testCase.expected.powerType,
            match: result.power_type === testCase.expected.powerType
        },
        { 
            name: "Model Number", 
            actual: result.model_number, 
            expected: testCase.expected.modelNumber,
            match: result.model_number === testCase.expected.modelNumber
        },
        { 
            name: "Specificity", 
            actual: result.specificity, 
            expected: testCase.expected.specificity,
            match: result.specificity === testCase.expected.specificity
        },
    ];
    
    if (testCase.expected.modelSeries) {
        checks.push({
            name: "Model Series",
            actual: result.model_series,
            expected: testCase.expected.modelSeries,
            match: result.model_series === testCase.expected.modelSeries
        });
    }
    
    if (testCase.expected.applicableModels) {
        const actualModels = result.applicable_models?.sort().join(",") || "";
        const expectedModels = testCase.expected.applicableModels.sort().join(",");
        checks.push({
            name: "Applicable Models",
            actual: actualModels,
            expected: expectedModels,
            match: actualModels === expectedModels
        });
    }
    
    let testPassed = true;
    for (const check of checks) {
        const icon = check.match ? "✅" : "❌";
        console.log(`   ${icon} ${check.name}: ${check.actual} ${!check.match ? `(expected: ${check.expected})` : ''}`);
        if (!check.match) testPassed = false;
    }
    
    if (testPassed) {
        passed++;
        console.log(`   ✅ TEST PASSED`);
    } else {
        failed++;
        console.log(`   ❌ TEST FAILED`);
    }
}

console.log();
console.log("=".repeat(80));
console.log(`📊 CLASSIFIER TEST RESULTS: ${passed}/${testCases.length} passed, ${failed} failed`);
console.log("=".repeat(80));
console.log();

// Now check actual documents in ChromaDB
console.log("\n🔍 VERIFYING DOCUMENTS IN CHROMADB");
console.log("-".repeat(80));

const aiServiceType = process.env.AI_SERVICE_TYPE?.toLowerCase() === 'ollama' 
    ? AIServiceType.OLLAMA 
    : AIServiceType.OPENAI;

const collections = ['robot', 'ope', 'erco'];

for (const topic of collections) {
    try {
        console.log(`\n📁 Checking collection: ${topic}`);
        
        const chromaManager = await getChromaManagerByServiceType(aiServiceType, topic);
        const vectorStore = chromaManager.getVectorStore();
        
        if (!vectorStore) {
            console.log(`   ⚠️  Collection not initialized`);
            continue;
        }
        
        const collectionInfo = chromaManager.getCollectionInfo();
        console.log(`   Collection Name: ${collectionInfo.name}`);
        console.log(`   AI Service: ${collectionInfo.aiServiceType}`);
        console.log(`   Embedding Model: ${collectionInfo.embeddingModel}`);
        
        // Sample search to verify documents
        const sampleQuery = topic === 'robot' ? "maintenance" : 
                          topic === 'ope' ? "chainsaw" : "blower";
        
        const results = await vectorStore.similaritySearch(sampleQuery, 5);
        
        console.log(`   📄 Sample Documents (${results.length} found):`);
        
        if (results.length === 0) {
            console.log(`   ⚠️  No documents found in collection`);
            continue;
        }
        
        // Analyze document metadata
        const categoryStats: Record<string, number> = {};
        const specificityStats: Record<string, number> = {};
        const powerTypeStats: Record<string, number> = {};
        const modelCount: Record<string, number> = {};
        
        for (const doc of results) {
            const meta = doc.metadata;
            
            // Count categories
            if (meta.product_category) {
                categoryStats[meta.product_category] = (categoryStats[meta.product_category] || 0) + 1;
            }
            
            // Count specificity
            if (meta.specificity) {
                specificityStats[meta.specificity] = (specificityStats[meta.specificity] || 0) + 1;
            }
            
            // Count power types
            if (meta.power_type) {
                powerTypeStats[meta.power_type] = (powerTypeStats[meta.power_type] || 0) + 1;
            }
            
            // Count models
            if (meta.model_number) {
                modelCount[meta.model_number] = (modelCount[meta.model_number] || 0) + 1;
            }
            
            // Show first document details
            if (results.indexOf(doc) === 0) {
                console.log(`\n   📄 Sample Document Metadata:`);
                console.log(`      Filename: ${meta.filename || 'N/A'}`);
                console.log(`      Category: ${meta.product_category || 'N/A'}`);
                console.log(`      Model: ${meta.model_number || 'N/A'}`);
                console.log(`      Series: ${meta.model_series || 'N/A'}`);
                console.log(`      Power Type: ${meta.power_type || 'N/A'}`);
                console.log(`      Specificity: ${meta.specificity || 'N/A'}`);
                console.log(`      Tags: ${meta.tags?.join(', ') || 'N/A'}`);
                console.log(`      Preview: ${doc.pageContent.substring(0, 100)}...`);
            }
        }
        
        // Show statistics
        console.log(`\n   📊 Collection Statistics:`);
        console.log(`      Categories: ${JSON.stringify(categoryStats)}`);
        console.log(`      Specificity: ${JSON.stringify(specificityStats)}`);
        console.log(`      Power Types: ${JSON.stringify(powerTypeStats)}`);
        console.log(`      Models Found: ${Object.keys(modelCount).length}`);
        if (Object.keys(modelCount).length > 0) {
            console.log(`      Top Models: ${Object.entries(modelCount).slice(0, 3).map(([model, count]) => `${model}(${count})`).join(', ')}`);
        }
        
    } catch (error) {
        console.log(`   ❌ Error checking collection: ${error}`);
    }
}

console.log();
console.log("=".repeat(80));
console.log("✅ VERIFICATION COMPLETE");
console.log("=".repeat(80));

// Test metadata filtering
console.log("\n🔎 TESTING METADATA FILTERING");
console.log("-".repeat(80));

const filterTests = [
    {
        name: "Find specific model (TM-850)",
        topic: "robot",
        query: "maintenance",
        filter: { model_number: "TM-850" }
    },
    {
        name: "Find battery-powered documents",
        topic: "ope",
        query: "operation",
        filter: { power_type: PowerType.BATTERY }
    },
    {
        name: "Find category-common documents",
        topic: "robot",
        query: "guide",
        filter: { specificity: DocumentSpecificity.CATEGORY_COMMON }
    },
    {
        name: "Find product-specific documents",
        topic: "ope",
        query: "manual",
        filter: { specificity: DocumentSpecificity.PRODUCT_SPECIFIC }
    }
];

for (const test of filterTests) {
    try {
        console.log(`\n🧪 ${test.name}`);
        console.log(`   Topic: ${test.topic}`);
        console.log(`   Filter: ${JSON.stringify(test.filter)}`);
        
        const chromaManager = await getChromaManagerByServiceType(aiServiceType, test.topic);
        const results = await chromaManager.similaritySearch(test.query, 3, test.filter);
        
        console.log(`   📄 Results: ${results.length} documents`);
        
        for (const doc of results) {
            const meta = doc.metadata;
            console.log(`      - ${meta.filename || 'Unknown'} [${meta.model_number || 'N/A'}] (${meta.specificity || 'N/A'})`);
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
}

console.log();
console.log("=".repeat(80));
console.log("🎉 ALL TESTS COMPLETE");
console.log("=".repeat(80));