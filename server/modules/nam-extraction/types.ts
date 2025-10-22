/**
 * Types for NAM Extraction Module
 *
 * NAM (Numéro d'Assurance Maladie) - Quebec health insurance number
 * Format: 4 letters + 8 digits (e.g., ABCD12345678)
 */

/**
 * NAM result from extraction with validation status
 */
export interface NAMResult {
  nam: string; // The extracted NAM (normalized to uppercase)
  page: number; // Page number where NAM was found (1-indexed)
  valid: boolean; // Whether NAM passes format validation
  validationError?: string; // Reason why NAM is invalid (if valid=false)

  // Visit date and time fields
  visitDate: string | null; // Visit date in YYYY-MM-DD format (extracted or manually entered)
  visitTime: string; // Visit time in HH:MM 24h format (extracted, manually entered, or default "08:00")
  dateValid: boolean; // Whether visit date is valid
  timeValid: boolean; // Whether visit time is valid
  dateValidationError?: string; // Reason why date is invalid (if dateValid=false)
  timeValidationError?: string; // Reason why time is invalid (if timeValid=false)
}

/**
 * Text blocks extracted from PDF, grouped by page
 */
export interface TextByPage {
  [page: number]: string[]; // Array of text lines per page
}

/**
 * Extraction result from the pipeline
 */
export interface ExtractionResult {
  status: "queued" | "running" | "completed" | "failed";
  stage?: "ocr" | "ai_extraction" | "validation"; // Current processing stage
  message?: string; // User-friendly status message
  nams?: NAMResult[]; // Extracted NAMs (when completed)
  pageCount?: number; // Number of pages in PDF
  processingTimeMs?: number; // Total processing time
  errorMessage?: string; // Error details (when failed)
  errorCode?: string; // Error code: OCR_FAILED, AI_EXTRACTION_FAILED, etc.
}

/**
 * SSV file generation request
 */
export interface SSVGenerationRequest {
  runId: string; // NAM extraction run ID
  namIds: string[]; // Array of NAM result IDs to include in SSV
}

/**
 * SSV file header field names (26 fields)
 */
export const SSV_HEADER_FIELDS = [
  "doctorLicenceID",
  "doctorGroupNumber",
  "ClaimDate",
  "ProcedureTime",
  "HIN", // <-- NAM goes here (column 5)
  "PatientGender",
  "PatientFirstName",
  "PatientLastName",
  "PatientBirthdate",
  "PatientParentHIN",
  "Sector",
  "Diagnosis",
  "ProcedureCode",
  "Units",
  "ContextualElements",
  "referringDoctor",
  "CSSTAccidentDate",
  "HospitalisationDate",
  "ExitDate",
  "RAMQReferenceFacilityType",
  "RAMQReferenceFacilityId",
  "SpecialGroup",
  "OtherRelatedProfessionalType",
  "OtherRelatedProfessionals",
  "Type",
  "ShiftTime",
] as const;

/**
 * NAM format validation rules
 */
export const NAM_VALIDATION_RULES = {
  TOTAL_LENGTH: 12,
  LETTER_COUNT: 4,
  DIGIT_COUNT: 8,
  PATTERN: /^[A-Za-z]{4}\d{8}$/,
} as const;

/**
 * Error codes for NAM extraction
 */
export enum NAMExtractionErrorCode {
  OCR_FAILED = "OCR_FAILED",
  AI_EXTRACTION_FAILED = "AI_EXTRACTION_FAILED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  INVALID_PDF = "INVALID_PDF",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
}

/**
 * User-friendly error messages (French)
 */
export const ERROR_MESSAGES: Record<string, string> = {
  [NAMExtractionErrorCode.OCR_FAILED]:
    "Impossible d'extraire le texte du document. Le fichier PDF pourrait être corrompu.",
  [NAMExtractionErrorCode.AI_EXTRACTION_FAILED]:
    "Erreur lors de l'identification des NAM. Veuillez réessayer.",
  [NAMExtractionErrorCode.VALIDATION_FAILED]:
    "Erreur de validation des NAMs extraits.",
  [NAMExtractionErrorCode.INTERNAL_ERROR]:
    "Une erreur système s'est produite. Veuillez réessayer ou contacter l'administrateur.",
  [NAMExtractionErrorCode.INVALID_PDF]:
    "Le fichier PDF est invalide ou corrompu.",
  [NAMExtractionErrorCode.FILE_TOO_LARGE]:
    "Le fichier est trop volumineux. Taille maximale : 20 Mo.",
  [NAMExtractionErrorCode.UNSUPPORTED_FORMAT]:
    "Format de fichier non supporté. Veuillez téléverser un fichier PDF.",
};
