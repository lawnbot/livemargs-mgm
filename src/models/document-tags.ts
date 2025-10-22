/**
 * Product category classification
 */
export enum ProductCategory {
    ROBOT = "robot",
    OPE = "ope", // Outdoor Power Equipment
    ERCO = "erco", // Leaf blowers
}

/**
 * Power type classification
 */
export enum PowerType {
    BATTERY = "battery",
    FUEL = "fuel",
    UNKNOWN = "unknown",
}

/**
 * Document specificity level
 */
export enum DocumentSpecificity {
    PRODUCT_SPECIFIC = "product_specific", // Specific to one model (e.g., TM-850)
    CATEGORY_COMMON = "category_common", // Common to all robots, all OPE, etc.
    GENERAL = "general", // General knowledge
}

/**
 * Extended metadata for RAG documents
 */
export interface DocumentTags {
    // Product classification
    product_category: ProductCategory | null;
    power_type: PowerType;

    // Model identification
    model_number: string | null; // e.g., "TM-850", "CS-350"
    model_series: string | null; // e.g., "TM", "CS"

    // Specificity
    specificity: DocumentSpecificity;

    // Additional filters
    applicable_models?: string[]; // For category docs that apply to multiple models
    tags?: string[]; // Additional free-form tags
}

/**
 * Model number patterns by category
 * Pattern explanation: (?:^|[^A-Z0-9]) - start or non-alphanumeric (non-capturing)
 *                      (PREFIX) - capturing group 1: model prefix
 *                      -? - optional hyphen
 *                      (NUMBER) - capturing group 2: model number
 *                      (?:[^A-Z0-9]|$) - non-alphanumeric or end (non-capturing)
 */
export const MODEL_PATTERNS = {
    [ProductCategory.ROBOT]: {
        pattern: /(?:^|[^A-Z0-9-])(TM|RP|BM|BP|EG)-?(\d{3,4})(?:[^A-Z0-9]|$)/gi,
        series: ["TM", "RP", "BM", "BP", "EG"],
    },
    [ProductCategory.OPE]: {
        pattern:
            /(?:^|[^A-Z0-9-])(CS|PPT|SRM|GT|PAS|PB|ES|HCA|HC|HCR|HCAS|HCS|CSG|MB|DCS|DPS|DPAS|DTT|DPPF|DPPT|DSRM|DLM|DPB|DHC|DHCA|DHCAS|DHCS|RP|LBP|LCJQ)-?(\d+[A-Z]*)(?:[^A-Z0-9]|$)/gi,
        series: [
            "CS",
            "PPT",
            "SRM",
            "GT",
            "PAS",
            "PB",
            "ES",
            "HCA",
            "HC",
            "HCR",
            "HCAS",
            "HCS",
            "CSG",
            "MB",
            "DCS",
            "DPS",
            "DPAS",
            "DTT",
            "DPPF",
            "DPPT",
            "DSRM",
            "DLM",
            "DPB",
            "DHC",
            "DHCA",
            "DHCAS",
            "DHCS",
            "RP",
            "LBP",
            "LCJQ",
        ],
    },
    [ProductCategory.ERCO]: {
        pattern:
            /(?:^|[^A-Z0-9-])(EB|ES|LG|EWB|EKM|SP|GHX|STF|ETM|EWM|ERM|ERSS|FM|KAH|SWZ)-?(\d+[A-Z]*)(?:[^A-Z0-9]|$)/gi,
        series: [
            "EB",
            "ES",
            "LG",
            "EWB",
            "EKM",
            "SP",
            "GHX",
            "STF",
            "ETM",
            "EWM",
            "ERM",
            "ERSS",
            "FM",
            "KAH",
            "SWZ",
        ],
    },
};

/**
 * OPE model prefixes that indicate battery power
 * These are 100% reliable indicators:
 * - D-series: All models starting with 'D' (e.g., DCS, DSRM, DLM, DPAS, etc.)
 * - LBP-series: Lithium Battery Powered blowers
 * - LCJQ-series: Lithium Cordless models
 */
export const OPE_BATTERY_PREFIXES = ['D', 'LBP', 'LCJQ'];


/**
 * Battery and fuel keywords for power type detection
 */
export const POWER_TYPE_KEYWORDS = {
    battery: [
        "battery",
        "batteries",
        "akku",
        "li-ion",
        "lithium",
        "cordless",
        "rechargeable",
        "akku-betrieben",
        "akku betrieben",
        "akku-system",
        "48v",
        "36v",
        "40v",
        "56v",
        "60v",
        "72v",
        "80v",
    ],
    fuel: [
        "gas",
        "gasoline",
        "petrol",
        "benzin",
        "2-stroke",
        "2 stroke",
        "2-cycle",
        "2 cycle",
        "2t",
        "mix",
        "carburetor",
        "vergaser",
    ],
};
