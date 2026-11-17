export const CIH_BANK_DETAILS = {
  accountHolder: 'HASSAN AIT BOUMLIK',
  accountNumber: '4698323211022800',
} as const;

export interface ProcessedCihReceipt {
  cihReceiptName: string;
  cihReceiptPreview: string;
  cihReceiptUploadedAt: string;
}

/**
 * Compresses image CIH receipts on an HTML5 <canvas> so previews stay well below
 * the 200,000-char Firestore rule bound while remaining legible in Admin Dashboard.
 */
export function processCihReceiptFile(file: File): Promise<ProcessedCihReceipt> {
  const cihReceiptName = file.name.trim().slice(0, 160) || 'CIH_Receipt';
  const cihReceiptUploadedAt = new Date().toISOString();

  if (!file.type.startsWith('image/')) {
    return Promise.resolve({
      cihReceiptName,
      cihReceiptPreview: '',
      cihReceiptUploadedAt,
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ cihReceiptName, cihReceiptPreview: '', cihReceiptUploadedAt });
    };
    reader.onload = () => {
      const rawResult = typeof reader.result === 'string' ? reader.result : '';
      if (!rawResult) {
        resolve({ cihReceiptName, cihReceiptPreview: '', cihReceiptUploadedAt });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({ cihReceiptName, cihReceiptPreview: '', cihReceiptUploadedAt });
      };
      img.onload = () => {
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ cihReceiptName, cihReceiptPreview: '', cihReceiptUploadedAt });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let compressed = canvas.toDataURL('image/jpeg', 0.65);
        if (compressed.length > 180000) {
          compressed = canvas.toDataURL('image/jpeg', 0.45);
        }
        resolve({
          cihReceiptName,
          cihReceiptPreview: compressed.length <= 195000 ? compressed : '',
          cihReceiptUploadedAt,
        });
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  });
}
