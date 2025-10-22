import { DocumentClassifier } from "../ai/document-classifier.js";
import { ProductCategory, PowerType, DocumentSpecificity } from "../models/document-tags.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=".repeat(80));
console.log("📁 OPE DOCUMENT CLASSIFICATION SCANNER");
console.log("=".repeat(80));
console.log();

// Path to OPE collection
const OPE_FOLDER = path.join(__dirname, "../../uploads/rag/ope-collection");

interface DocumentAnalysis {
    filename: string;
    filePath: string;
    category: ProductCategory | null;
    modelNumber: string | null;
    modelSeries: string | null;
    powerType: PowerType;
    specificity: DocumentSpecificity;
    applicableModels?: string[];
    contentPreview: string;
    fileSize: number;
}

/**
 * Get file size in KB
 */
function getFileSizeKB(filePath: string): number {
    const stats = fs.statSync(filePath);
    return Math.round(stats.size / 1024);
}

/**
 * Load and extract text from PDF
 */
async function loadDocumentContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
        if (ext === ".pdf") {
            const loader = new PDFLoader(filePath);
            const docs = await loader.load();
            return docs.map(doc => doc.pageContent).join("\n");
        } else {
            // For text files, read directly
            return fs.readFileSync(filePath, "utf-8");
        }
    } catch (error) {
        console.error(`   ⚠️  Error loading ${filePath}: ${error}`);
        return "";
    }
}

/**
 * Scan a single document and classify it
 */
async function analyzeDocument(filePath: string): Promise<DocumentAnalysis> {
    const filename = path.basename(filePath);
    const content = await loadDocumentContent(filePath);
    
    // Classify the document
    const tags = DocumentClassifier.classifyDocument(
        filename,
        filePath,
        content,
        "ope-collection"
    );
    
    return {
        filename,
        filePath,
        category: tags.product_category,
        modelNumber: tags.model_number,
        modelSeries: tags.model_series,
        powerType: tags.power_type,
        specificity: tags.specificity,
        applicableModels: tags.applicable_models,
        contentPreview: content.substring(0, 150).replace(/\n/g, " "),
        fileSize: getFileSizeKB(filePath),
    };
}

/**
 * Get all PDF and text files from directory
 */
function getDocumentFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
        console.error(`❌ Directory not found: ${dirPath}`);
        return [];
    }
    
    const files = fs.readdirSync(dirPath);
    const documentFiles: string[] = [];
    
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            if ([".pdf", ".txt", ".md", ".doc", ".docx"].includes(ext)) {
                documentFiles.push(fullPath);
            }
        }
    }
    
    return documentFiles;
}

/**
 * Print classification summary
 */
function printDocumentSummary(analysis: DocumentAnalysis, index: number) {
    console.log(`\n${index}. 📄 ${analysis.filename}`);
    console.log(`   ${"─".repeat(76)}`);
    console.log(`   📂 Path: ${path.relative(process.cwd(), analysis.filePath)}`);
    console.log(`   💾 Size: ${analysis.fileSize} KB`);
    console.log();
    console.log(`   🏷️  Classification:`);
    console.log(`      Category:    ${analysis.category || "❓ Unknown"}`);
    console.log(`      Model:       ${analysis.modelNumber || "❓ Not detected"}`);
    console.log(`      Series:      ${analysis.modelSeries || "N/A"}`);
    console.log(`      Power Type:  ${getPowerTypeIcon(analysis.powerType)} ${analysis.powerType}`);
    console.log(`      Specificity: ${getSpecificityIcon(analysis.specificity)} ${analysis.specificity}`);
    
    if (analysis.applicableModels && analysis.applicableModels.length > 0) {
        console.log(`      Models:      ${analysis.applicableModels.join(", ")}`);
    }
    
    console.log();
    console.log(`   📝 Preview: ${analysis.contentPreview}...`);
}

/**
 * Get icon for power type
 */
function getPowerTypeIcon(powerType: PowerType): string {
    switch (powerType) {
        case PowerType.BATTERY:
            return "🔋";
        case PowerType.FUEL:
            return "⛽";
        default:
            return "❓";
    }
}

/**
 * Get icon for specificity
 */
function getSpecificityIcon(specificity: DocumentSpecificity): string {
    switch (specificity) {
        case DocumentSpecificity.PRODUCT_SPECIFIC:
            return "🎯";
        case DocumentSpecificity.CATEGORY_COMMON:
            return "📁";
        case DocumentSpecificity.GENERAL:
            return "🌐";
        default:
            return "❓";
    }
}

/**
 * Main scanning function
 */
async function scanOPEDocuments() {
    console.log(`📂 Scanning folder: ${OPE_FOLDER}`);
    console.log();
    
    const files = getDocumentFiles(OPE_FOLDER);
    
    if (files.length === 0) {
        console.log("⚠️  No documents found in OPE collection folder.");
        console.log(`   Create folder: ${OPE_FOLDER}`);
        console.log(`   Add PDF or text files to scan.`);
        return;
    }
    
    console.log(`📊 Found ${files.length} document(s) to analyze...`);
    console.log();
    
    const analyses: DocumentAnalysis[] = [];
    
    // Analyze each document
    for (let i = 0; i < files.length; i++) {
        console.log(`⏳ Analyzing ${i + 1}/${files.length}: ${path.basename(files[i])}...`);
        const analysis = await analyzeDocument(files[i]);
        analyses.push(analysis);
    }
    
    console.log();
    console.log("=".repeat(80));
    console.log("📋 CLASSIFICATION RESULTS");
    console.log("=".repeat(80));
    
    // Print all analyses
    analyses.forEach((analysis, index) => {
        printDocumentSummary(analysis, index + 1);
    });
    
    // Print statistics
    console.log();
    console.log("=".repeat(80));
    console.log("📊 STATISTICS");
    console.log("=".repeat(80));
    console.log();
    
    const stats = {
        totalDocs: analyses.length,
        byPowerType: {} as Record<string, number>,
        bySpecificity: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        batteryModels: new Set<string>(),
        fuelModels: new Set<string>(),
    };
    
    analyses.forEach(analysis => {
        // Power type stats
        stats.byPowerType[analysis.powerType] = (stats.byPowerType[analysis.powerType] || 0) + 1;
        
        // Specificity stats
        stats.bySpecificity[analysis.specificity] = (stats.bySpecificity[analysis.specificity] || 0) + 1;
        
        // Model stats
        if (analysis.modelNumber) {
            stats.byModel[analysis.modelNumber] = (stats.byModel[analysis.modelNumber] || 0) + 1;
            
            if (analysis.powerType === PowerType.BATTERY) {
                stats.batteryModels.add(analysis.modelNumber);
            } else if (analysis.powerType === PowerType.FUEL) {
                stats.fuelModels.add(analysis.modelNumber);
            }
        }
    });
    
    console.log(`   Total Documents: ${stats.totalDocs}`);
    console.log();
    
    console.log(`   Power Type Distribution:`);
    Object.entries(stats.byPowerType).forEach(([type, count]) => {
        const icon = type === PowerType.BATTERY ? "🔋" : type === PowerType.FUEL ? "⛽" : "❓";
        console.log(`      ${icon} ${type}: ${count} (${Math.round(count / stats.totalDocs * 100)}%)`);
    });
    console.log();
    
    console.log(`   Specificity Distribution:`);
    Object.entries(stats.bySpecificity).forEach(([spec, count]) => {
        const icon = getSpecificityIcon(spec as DocumentSpecificity);
        console.log(`      ${icon} ${spec}: ${count} (${Math.round(count / stats.totalDocs * 100)}%)`);
    });
    console.log();
    
    if (Object.keys(stats.byModel).length > 0) {
        console.log(`   Models Found: ${Object.keys(stats.byModel).length}`);
        console.log(`      🔋 Battery Models (${stats.batteryModels.size}): ${Array.from(stats.batteryModels).join(", ") || "None"}`);
        console.log(`      ⛽ Fuel Models (${stats.fuelModels.size}): ${Array.from(stats.fuelModels).join(", ") || "None"}`);
    }
    
    console.log();
    console.log("=".repeat(80));
    console.log("✅ SCAN COMPLETE");
    console.log("=".repeat(80));
}

// Run the scanner
scanOPEDocuments().catch(console.error);
