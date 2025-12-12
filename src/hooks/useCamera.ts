import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const useCamera = () => {
  const isNative = Capacitor.isNativePlatform();

  const takePhoto = async () => {
    if (!isNative) {
      // For web, return null and let the component handle file input
      return null;
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });

      return image;
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  };

  const pickFromGallery = async () => {
    if (!isNative) {
      return null;
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });

      return image;
    } catch (error) {
      console.error('Error picking from gallery:', error);
      throw error;
    }
  };

  return {
    isNative,
    takePhoto,
    pickFromGallery,
  };
};
