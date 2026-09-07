export type PixelCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CroppableImage = {
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
  clientWidth?: number;
  clientHeight?: number;
};

export function getDisplayedImageSize(image: CroppableImage) {
  const width = image.clientWidth || image.width;
  const height = image.clientHeight || image.height;
  return { width, height };
}

export function getLogoCropDrawParams(image: CroppableImage, crop: PixelCropBox) {
  const displayed = getDisplayedImageSize(image);
  if (!image.naturalWidth || !image.naturalHeight || !displayed.width || !displayed.height) {
    throw new Error('Logo image is not ready to crop.');
  }
  if (!crop.width || !crop.height) {
    throw new Error('Select a crop area before saving the logo.');
  }

  const scaleX = image.naturalWidth / displayed.width;
  const scaleY = image.naturalHeight / displayed.height;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  return {
    sourceX: crop.x * scaleX,
    sourceY: crop.y * scaleY,
    sourceWidth,
    sourceHeight,
    destWidth: Math.max(1, Math.round(sourceWidth)),
    destHeight: Math.max(1, Math.round(sourceHeight)),
  };
}

export function cropLogoToCanvas(
  image: CanvasImageSource & CroppableImage,
  crop: PixelCropBox,
  canvas: HTMLCanvasElement
) {
  const params = getLogoCropDrawParams(image, crop);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No 2d context');
  }

  canvas.width = params.destWidth;
  canvas.height = params.destHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    params.sourceX,
    params.sourceY,
    params.sourceWidth,
    params.sourceHeight,
    0,
    0,
    params.destWidth,
    params.destHeight
  );
}
