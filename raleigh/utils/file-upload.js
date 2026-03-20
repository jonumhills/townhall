/**
 * File Upload Utility — Townhall MVP
 *
 * For demo: accepts base64-encoded deed documents from frontend
 * and stores them inline in Supabase (deed_document_url = data:application/pdf;base64,...)
 *
 * For production: Replace with IPFS (Pinata/NFT.Storage) or S3 upload.
 */

/**
 * Validates a deed document upload
 * @param {string} base64Data - base64-encoded file data with data URL prefix
 * @param {number} maxSizeMB - maximum file size in MB (default: 10MB)
 * @returns {{ valid: boolean, error?: string, mimeType?: string, sizeKB?: number }}
 */
export function validateDeedDocument(base64Data, maxSizeMB = 10) {
  if (!base64Data || typeof base64Data !== "string") {
    return { valid: false, error: "No document data provided" };
  }

  // Parse data URL: data:application/pdf;base64,JVBERi0xLjQK...
  const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!dataUrlMatch) {
    return { valid: false, error: "Invalid data URL format" };
  }

  const mimeType = dataUrlMatch[1];
  const base64Content = dataUrlMatch[2];

  // Only allow PDF for deed documents
  if (mimeType !== "application/pdf") {
    return {
      valid: false,
      error: `Only PDF files are allowed. Got: ${mimeType}`,
    };
  }

  // Calculate file size (base64 is ~33% larger than binary)
  const sizeBytes = (base64Content.length * 3) / 4;
  const sizeKB = Math.round(sizeBytes / 1024);
  const sizeMB = sizeKB / 1024;

  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large: ${sizeMB.toFixed(1)}MB (max: ${maxSizeMB}MB)`,
    };
  }

  return {
    valid: true,
    mimeType,
    sizeKB,
  };
}

/**
 * Store deed document (MVP: inline base64 in Supabase)
 * In production: upload to IPFS or S3 and return URL
 *
 * @param {string} base64Data - data URL with base64-encoded PDF
 * @param {string} pin - parcel PIN (for filename)
 * @returns {Promise<{ url: string, sizeKB: number }>}
 */
export async function storeDeedDocument(base64Data, pin) {
  const validation = validateDeedDocument(base64Data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // MVP: return the data URL as-is (stored inline in Supabase)
  // This works for demo but NOT recommended for production (large text fields)
  const url = base64Data;

  console.log(
    `Deed document for PIN ${pin}: ${validation.sizeKB}KB (stored inline)`
  );

  // TODO: Production implementation
  // Option A — IPFS (decentralized, immutable):
  //   const ipfs = await ipfsClient.add(Buffer.from(base64Content, 'base64'))
  //   return { url: `ipfs://${ipfs.path}`, sizeKB: validation.sizeKB }
  //
  // Option B — S3 (centralized, mutable):
  //   const s3Key = `deeds/${countyId}/${pin}-${Date.now()}.pdf`
  //   await s3.putObject({ Bucket: 'townhall-deeds', Key: s3Key, Body: buffer })
  //   return { url: `s3://${s3Key}`, sizeKB: validation.sizeKB }

  return {
    url,
    sizeKB: validation.sizeKB,
  };
}

/**
 * Retrieve a deed document URL for display
 * (In production: resolve IPFS/S3 URL to HTTP gateway)
 *
 * @param {string} storedUrl - URL from deed_document_url column
 * @returns {string} - HTTP URL for browser display
 */
export function getDeedDocumentUrl(storedUrl) {
  if (!storedUrl) return null;

  // MVP: data URL is already browser-ready
  if (storedUrl.startsWith("data:")) {
    return storedUrl;
  }

  // Production IPFS: convert ipfs:// to HTTP gateway
  if (storedUrl.startsWith("ipfs://")) {
    const cid = storedUrl.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${cid}`;
  }

  // Production S3: convert s3:// to presigned URL
  if (storedUrl.startsWith("s3://")) {
    // TODO: generate presigned URL with AWS SDK
    return storedUrl; // fallback
  }

  return storedUrl;
}
