export const MARKETPLACE_MAX_ZIP_BYTES = 200 * 1024 * 1024;
export const MARKETPLACE_UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const MARKETPLACE_DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const MARKETPLACE_COVER_URL_TTL_MS = 60 * 60 * 1000;

export type MarketplaceProductStatus = 'draft' | 'published';

export type MarketplaceProduct = {
  id: string;
  title: string;
  description: string;
  tokenPrice: number;
  fileName: string | null;
  fileSize: number | null;
  storagePath: string;
  coverStoragePath: string | null;
  coverDownloadUrl?: string | null;
  status: MarketplaceProductStatus;
  createdBy: string | null;
};

export function purchaseDocId(uid: string, productId: string) {
  return `${uid}_${productId}`;
}

export function marketplaceZipPath(productId: string) {
  return `marketplace/${productId}/file.zip`;
}

export function marketplaceCoverPath(productId: string, extension: string) {
  return `marketplace/${productId}/cover.${extension}`;
}

export function isAllowedZipContentType(contentType: string | undefined) {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized === 'application/zip' || normalized === 'application/x-zip-compressed';
}

export function resolveZipContentType(contentType: string | undefined, fileName: string) {
  if (isAllowedZipContentType(contentType)) {
    return contentType!.toLowerCase() === 'application/x-zip-compressed'
      ? 'application/x-zip-compressed'
      : 'application/zip';
  }
  if (fileName.toLowerCase().endsWith('.zip') && (!contentType || contentType === 'application/octet-stream')) {
    return 'application/zip';
  }
  return null;
}

export function isAllowedCoverContentType(contentType: string | undefined) {
  if (!contentType) return false;
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType.toLowerCase());
}

export function coverExtensionForContentType(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export function sanitizeZipFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() || 'product.zip';
  return base.toLowerCase().endsWith('.zip') ? base : `${base}.zip`;
}
