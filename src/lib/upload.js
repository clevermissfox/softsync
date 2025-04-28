// Import S3 client and commands for interacting with object storage
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
// Import OpenAI SDK for transcription and TTS
import OpenAI from "openai";
// Import keyword mapping and list of keywords to search for in transcription
import { myKeyWord, myKeyWordFindKeys } from "../components/MyKeyWord";


// Initialize S3 client for R2 storage with credentials and endpoint from environment variables
const s3 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true // Required for some S3-compatible endpoints (like Cloudflare R2)
});

// Initialize OpenAI client for transcription and TTS with API key from environment variables
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

/**
 * Transcribes the given audio file, searches for keywords,
 * and generates an AI TTS response if a keyword is found.
 * @param {File} file - The audio file to transcribe and process
 * @returns {[string, any]} - [keyword, TTS mp3 response]
 */
export async function generateAIVoice(file) {
  try {
     // Transcribe audio using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
    });
      // Search for keywords in the transcription
    const text = [];
    myKeyWordFindKeys.forEach((item) => {
      if (transcription.text.toLowerCase().includes(item.toLowerCase())) {
        text.push([item, myKeyWord[item]]);
      }
    });

    if (text.length === 0) {
      throw new Error("No keywords found in the transcription.");
    }
    // Generate TTS audio for the first found keyword using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text[0][1], // Use the mapped response text for the keyword
      language: "en",
    });
    // Return [keyword, mp3 response]
    return [text[0][0], mp3];
  } catch (error) {
    console.error("Error generating AI voice from generateAIVoice fx:", error);
    throw error;
  }
}

/**
 * Uploads the generated AI voice (mp3) to the R2 bucket with the keyword as filename.
 * @param {[string, any]} file - [keyword, mp3 response]
 */
export async function uploadAIVoice(file) {
   // Destructure keyword and mp3 response
  const [a, b] = file;
   // Convert mp3 response to a Blob and then to a File object
  const blob = await b.blob();
  const audio = new File([blob], "audio.mp3", { type: blob.type });

  try {
    // Prepare the S3 PutObject command with the keyword as the filename
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
      Key: `${a}.mp3`,  // Save as <keyword>.mp3
      Body: audio,
      ContentType: "audio/mpeg",
    });

    await s3.send(command);   // Upload the file to the bucket
  } catch (error) {
  console.error("Error uploading AI voice:", error); // Handle common S3 errors for easier debugging
  if (error.name === 'AccessDenied') {
    console.error("Access denied. Check your R2 permissions.");
  } else if (error.name === 'NoSuchBucket') {
    console.error("Bucket not found. Check your bucket name.");
  }
  throw error;
}
}

/**
 * Deletes a file from the R2 bucket by filename.
 * @param {string} fileName - The name of the file to delete (e.g. "keyword.mp3")
 * @returns {Promise<any>} - The response from the delete operation
 */
export async function deleteData(fileName) {
  try {
     // Prepare the S3 DeleteObject command
    const deleteCommand = new DeleteObjectCommand({
      Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
      Key: fileName,
    });
    const response = await s3.send(deleteCommand);    // Execute the delete command
    return response;
  } catch (error) {
    console.error("Error deleting file from deleteData fx: ", error);
    throw new Error("Failed to delete file. Please try again.");
  }
}

