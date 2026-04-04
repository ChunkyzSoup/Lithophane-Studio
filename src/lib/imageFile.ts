export async function readFileBytes(file: File) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function readImageDimensionsFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();

        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        image.onerror = () =>
          reject(new Error("The selected file could not be decoded as an image."));
        image.src = objectUrl;
      },
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
