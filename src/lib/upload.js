import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { myKeyWord, myKeyWordFindKeys } from "../components/MyKeyWord";

const s3 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true
});

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function generateAIVoice(file) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
    });

    const text = [];
    myKeyWordFindKeys.forEach((item) => {
      if (transcription.text.toLowerCase().includes(item.toLowerCase())) {
        text.push([item, myKeyWord[item]]);
      }
    });

    if (text.length === 0) {
      throw new Error("No keywords found in the transcription.");
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text[0][1],
      language: "en",
    });

    return [text[0][0], mp3];
  } catch (error) {
    console.error("Error generating AI voice from generateAIVoice fx:", error);
    throw error;
  }
}

export async function uploadAIVoice(file) {
  const [a, b] = file;
  const blob = await b.blob();
  const audio = new File([blob], "audio.mp3", { type: blob.type });

  try {
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
      Key: `${a}.mp3`,
      Body: audio,
      ContentType: "audio/mpeg",
    });

    await s3.send(command);
  } catch (error) {
    console.log("Error uploading AI voice from uploadAIVoice fx:", error);
    throw error;
  }
}

export async function deleteData(fileName) {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
      Key: fileName,
    });
    const response = await s3.send(deleteCommand);
    return response;
  } catch (error) {
    console.error("Error deleting file: ", error);
    throw new Error("Failed to delete file. Please try again.");
  }
}
