import QRCode from "qrcode";

/**
 * Generate a QR code as a base64 data URL
 * The QR encodes the check-in URL so any scanner app works,
 * but our staff scanner uses the token directly.
 *
 * @param {string} token - the qr_token from the tickets table
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function generateQrDataUrl(token) {
  const checkinUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/checkin?token=${token}`;

  const dataUrl = await QRCode.toDataURL(checkinUrl, {
    errorCorrectionLevel: "H",
    type: "image/png",
    quality: 0.95,
    margin: 2,
    width: 400,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return dataUrl;
}
