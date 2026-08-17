/**
 * Loads the font + logo bytes `renderDocumentBlob` needs, once, from static
 * assets bundled by Vite. See src/pdf/index.js for the consumer.
 */
import serifRegularUrl from '../../assets/fonts/Prata-Regular.ttf?url';
import sansRegularUrl from '../../assets/fonts/JosefinSans-Regular.ttf?url';
import sansSemiBoldUrl from '../../assets/fonts/JosefinSans-SemiBold.ttf?url';
import logoUrl from '../../docs/sheer_aura/sheer aura logo.png?url';

let cached = null;

async function loadBytes(url) {
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * @returns {Promise<import('../pdf/index.js').DocumentAssets>}
 */
export async function loadDocumentAssets() {
  if (cached) return cached;
  const [serifRegular, sansRegular, sansSemiBold, logoPng] = await Promise.all([
    loadBytes(serifRegularUrl),
    loadBytes(sansRegularUrl),
    loadBytes(sansSemiBoldUrl),
    loadBytes(logoUrl),
  ]);
  // Prata ships a single weight; render-samples.mjs falls back bold -> regular too.
  cached = { serifRegular, serifBold: serifRegular, sansRegular, sansSemiBold, logoPng };
  return cached;
}
