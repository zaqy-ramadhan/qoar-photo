
import { GoogleGenAI, Modality, GenerateContentResponse, Part } from "@google/genai";
import { EditedImageResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelName = 'gemini-2.5-flash-image-preview';

/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove the "data:image/jpeg;base64," part
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};


export const editImageWithGemini = async (
  imageFile: File,
  prompt: string,
  maskBase64?: string,
  objectImageFile?: File
): Promise<EditedImageResult> => {
  try {
    const base64ImageData = await fileToBase64(imageFile);
    if (!base64ImageData) {
      throw new Error("Failed to convert image to base64.");
    }

    const parts: Part[] = [];

    // 1. Add the main image
    parts.push({
      inlineData: { data: base64ImageData, mimeType: imageFile.type },
    });

    // 2. Add the mask if it exists
    if (maskBase64) {
      parts.push({
        inlineData: { data: maskBase64, mimeType: 'image/png' },
      });
    }

    // 3. Add the object image if it exists
    if (objectImageFile) {
        const base64ObjectData = await fileToBase64(objectImageFile);
        parts.push({
            inlineData: { data: base64ObjectData, mimeType: objectImageFile.type },
        });
    }

    // 4. Add the text prompt
    parts.push({ text: prompt });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    
    const result: EditedImageResult = { imageB64: '', text: null };
    const responseParts = response.candidates?.[0]?.content?.parts || [];

    let imageFound = false;
    for (const part of responseParts) {
      if (part.inlineData) {
        result.imageB64 = part.inlineData.data;
        imageFound = true;
      }
      if (part.text) {
        result.text = (result.text || "") + part.text;
      }
    }

    if (!imageFound) {
      throw new Error("API did not return an image. It might have been blocked due to safety policies or an invalid prompt.");
    }
    
    return result;
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to edit image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while editing the image.");
  }
};
