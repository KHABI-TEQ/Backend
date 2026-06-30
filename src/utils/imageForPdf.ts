import sharp from "sharp";

const PDFKIT_SUPPORTED = new Set(["jpeg", "png"]);

/**
 * PDFKit only embeds JPEG and PNG. Convert WebP and other formats first.
 */
export async function normalizeImageForPdf(
  buffer: Buffer | null | undefined
): Promise<Buffer | null> {
  if (!buffer?.length) return null;

  try {
    const image = sharp(buffer, { failOn: "none" });
    const meta = await image.metadata();
    const format = meta.format?.toLowerCase();

    if (format && PDFKIT_SUPPORTED.has(format)) {
      return buffer;
    }

    return await image.png().toBuffer();
  } catch (error) {
    console.warn("normalizeImageForPdf failed:", (error as Error).message);
    return null;
  }
}
