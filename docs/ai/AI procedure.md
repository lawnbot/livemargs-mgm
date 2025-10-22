# AI Procedure

Categorize
sales
after-sales

Avoid mixing specific product knowledge between products


Combine knowledge of
product specific search. Max result 1

product category search. Max result 3

classify products categories: ope, robots and erco leaf blowers
classify by fuel powered and battery powered
casssify by whether the model number can be extracted and is matching a scheme depending on the product category. Robots have a model name starting with TM- or RP- with 3 or 4 digits as suffix. like TM-850 or TM-2050 or RP-1250.
ope products start with CS-, SRM, DSRM,-



const BATTERY_KEYWORDS = [
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
];

/** Fuel indicators */
const FUEL_KEYWORDS = [
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
];


'DRM','CS', 'SRM', 'DSRM', 'DTT', DPB,  DPPT, PPT, DLM, DHC, DHCA, ES,'DPPF'
HC, HCR, HCS
HCAS
HCA


ERCO EWB
Prompt

How to tag documents whether product specific or common for a specific category?
Goal is to avoid in the search mixing specific product knowledge between different products.
Idea is classifiying the input and search for the model name.
Extract the model name

classify products categories: ope, robots and erco 
classify by fuel powered and battery powered
casssify by whether the model number can be extracted and is matching a scheme depending on the product category. Robots have a model name starting with TM- or RP- with 3 or 4 digits as suffix. like TM-850 or TM-2050 or RP-1250.
ope products start with CS-, SRM, DSRM,-
ERCO products start with ES- or LG- or 



// Query: "Wie warte ich den TM-850?"
// Filter: model_number = "TM-850" OR (specificity = category_common AND category = robot)
// Ergebnis: Nur TM-850 Dokumente + allgemeine Robot-Wartungsdokumente

// Query: "Wie funktioniert die Akku-Technologie bei Robotern?"
// Filter: product_category = robot OR specificity = general
// Ergebnis: Alle Robot-Dokumente, keine OPE-spezifischen Infos

robot-collection/
  ├── TM-850-manual.pdf              → product_specific, model_number: TM-850
  ├── Robot-battery-guide.pdf        → category_common, category: robot
  └── General-safety.pdf             → general

ope-collection/
  ├── CS-350-manual.pdf              → product_specific, model_number: CS-350
  └── OPE-maintenance.pdf            → category_common, category: ope

erco-collection/
  ├── ES-100-manual.pdf              → product_specific, model_number: ES-100
  └── Leaf-blower-tips.pdf           → category_common, category: erco