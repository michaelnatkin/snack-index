/**
 * Sharing utilities for Snack Index
 */

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/**
 * Check if Web Share API is supported
 */
export function isShareSupported(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Share content using Web Share API or fallback to clipboard
 */
export async function share(data: ShareData): Promise<boolean> {
  if (isShareSupported()) {
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      // User cancelled or error
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
      return false;
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(data.url);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Generate share URL for a place
 */
export function getPlaceShareUrl(placeId: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/s/${placeId}`;
}

/**
 * Generate share URL for a specific dish
 */
export function getDishShareUrl(placeId: string, dishId: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/s/${placeId}/dish/${dishId}`;
}

/**
 * Share a place
 */
export async function sharePlace(
  placeName: string,
  placeId: string
): Promise<boolean> {
  return share({
    title: placeName,
    text: `Check out ${placeName} on Snack Index!`,
    url: getPlaceShareUrl(placeId),
  });
}

/**
 * Share a dish
 */
export async function shareDish(
  dishName: string,
  placeName: string,
  placeId: string,
  dishId: string
): Promise<boolean> {
  return share({
    title: `${dishName} at ${placeName}`,
    text: `Try the ${dishName} at ${placeName}!`,
    url: getDishShareUrl(placeId, dishId),
  });
}

