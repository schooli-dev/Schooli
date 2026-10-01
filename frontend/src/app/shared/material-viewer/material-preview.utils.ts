export type PreviewKind = 'pdf' | 'image' | 'video' | 'text' | 'docx' | 'pptx' | 'unsupported';

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const videoExtensions = new Set(['mp4', 'webm']);
const textExtensions = new Set([
  'txt', 'csv', 'md', 'json', 'xml', 'yml', 'yaml', 'log',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'sql', 'sh', 'css', 'scss'
]);

export function fileExtension(fileName: string | null | undefined): string {
  const name = (fileName ?? '').toLowerCase();
  return name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
}

/** Decides how a private file is rendered inside the website. Extension wins because browsers report unreliable MIME types for code files. */
export function detectPreviewKind(fileName: string | null | undefined, mimeType: string | null | undefined): PreviewKind {
  const extension = fileExtension(fileName);
  const mime = (mimeType ?? '').toLowerCase();

  if (extension === 'pdf' || mime === 'application/pdf') return 'pdf';
  // Legacy binary Office formats (doc/ppt/xls) cannot be rendered by the browser and are no longer
  // accepted on upload; anything already stored with one of these extensions falls through to 'unsupported'.
  if (extension === 'docx') return 'docx';
  if (extension === 'pptx') return 'pptx';
  if (imageExtensions.has(extension)) return 'image';
  if (videoExtensions.has(extension)) return 'video';
  if (textExtensions.has(extension)) return 'text';
  if (!extension && mime.startsWith('image/')) return 'image';
  if (!extension && mime.startsWith('video/')) return 'video';
  if (!extension && mime.startsWith('text/')) return 'text';
  return 'unsupported';
}
