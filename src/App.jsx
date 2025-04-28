import { useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import { uploadAIVoice, generateAIVoice, deleteData } from "./lib/upload";
import { LoaderIcon } from "./components/Icons";
import "react-toastify/dist/ReactToastify.css";
import Swal from "sweetalert2";

// or via CommonJS

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// S3 client setup for interacting with the storage bucket
const s3 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});
const PLAY = "PLAY";
const STOP = "STOP";

export default function App() {
    // State to manage recording status, loading state, and error messages
  const [state, setState] = useState({
    status: STOP,      // Are we currently recording? ("PLAY" or "STOP")
    loading: false,    // Are we uploading or processing audio?
    error: null,       // Any error messages
  });
  const [keyword, setKeyword] = useState(null);
  

    // State to hold the list of audio files fetched from the bucket
  const [audioFiles, setAudioFiles] = useState([]);

  // Refs to manage audio recording and stream
  const audioRef = useRef([]);        // Holds audio data chunks during recording
  const recorderRef = useRef(null);   // MediaRecorder instance
  const streamRef = useRef(null);     // MediaStream instance

  // Helper to show toast notifications
  const notify = (message) => toast(message);
  const matchingFile = audioFiles.find(file => keyword && file.Key === `${keyword}.mp3`);
  
  // Toggles recording status between PLAY and STOP
  const handleListening = () =>
    setState((prevState) => ({
      ...prevState,
      status: prevState.status === PLAY ? STOP : PLAY,
    }));

  
// Handles uploading the recorded audio:
  // 1. Transcribes audio and generates AI voice (TTS)
  // 2. Uploads the resulting file to the bucket
  // 3. Refreshes the file list and shows notifications
  const uploadAudio = async (blob) => {
    setState((prevState) => ({ ...prevState, loading: true }));
    notify("Uploading audio... Please wait.");
    const file = new File([blob], "audio.mp3", { type: blob.type });

    try {
       // Transcribe and generate AI voice
      // const audio = await generateAIVoice(file);
      // Upload the generated audio
      // await uploadAIVoice(audio);
       const [foundKeyword, mp3] = await generateAIVoice(file);
      setKeyword(foundKeyword);
      await uploadAIVoice([foundKeyword, mp3]);
      
      setState((prevState) => ({
        ...prevState,
        loading: false,
        error: null,
      }));
    // Refresh file list
      await fetchFiles();
      notify("Audio uploaded successfully!");
    } catch (error) {
      console.log(error);
      setState((prevState) => ({
        ...prevState,
        loading: false,
        error: `Error uploading audio`,
      }));
      await fetchFiles();
      notify(`Error: ${error.message}`);
    }
  };
  
  // Effect to handle starting/stopping audio recording when status changes
  useEffect(() => {
    const processing = async () => {
      const { status } = state;
      if (status === PLAY) {
         // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          streamRef.current = stream;
          recorderRef.current = new MediaRecorder(stream);
          // Collect audio data chunks
          recorderRef.current.ondataavailable = (event) => {
            audioRef.current.push(event.data);
          };
        // When recording stops, process the audio
          recorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioRef.current, {
              type: "audio/mp3",
            });
            if (audioBlob.size > 0) {
              await uploadAudio(audioBlob);
              setState((prevState) => ({ ...prevState, error: null }));
            } else {
              const errorMessage = "No audio data captured";
              setState((prevState) => ({
                ...prevState,
                error: errorMessage,
              }));
              notify(errorMessage);
            }
          };
         // Start recording, collect data every second
          recorderRef.current.start(1000);
          audioRef.current = [];
        } catch (error) {
          const errorMessage =
            "Failed to start recording. Please ensure microphone access.";
          setState((prevState) => ({
            ...prevState,
            error: errorMessage,
          }));
          notify(errorMessage);
        }
      } else if (status === STOP && recorderRef.current) {
         // Stop recording and release resources
        recorderRef.current.stop();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
    };
    processing();

     // Cleanup: stop recording and release microphone if component unmounts
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [state.status]); // Runs whenever recording status changes
  const { status, loading } = state;
  

  // Effect to fetch audio files from the bucket when the component mounts
  useEffect(() => {
    fetchFiles();
  }, []);
  
  useEffect(() => {
    console.log("AudioFiles: ", audioFiles)
  }, [audioFiles]);
  
  useEffect(() => {
    console.log("Keyword: ", keyword)
  }, [keyword]);

  

   // Fetches the list of .mp3 files from the storage bucket and updates state
  const fetchFiles = async () => {
    const params = { Bucket: import.meta.env.VITE_R2_BUCKET_NAME };
    try {
      const data = await s3.send(new ListObjectsV2Command(params));

      // Ensure that data.Contents is defined and is an array
       // Only keep files ending in .mp3
      const mp3Files = data.Contents
        ? data.Contents.filter((file) => file.Key.endsWith(".mp3"))
        : [];

      setAudioFiles(mp3Files);
    } catch (error) {
      console.error("Error fetching audio files:", error);
    }
  };

  // Handles deleting an audio file from the bucket, with confirmation dialog
  const handleDelete = async (item) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteData(item);      // Delete the file from the bucket
          await fetchFiles();         // Refresh file list

          Swal.fire({
            title: "Deleted!",
            text: "Your file has been deleted.",
            icon: "success",
          });
        } catch (error) {
          Swal.fire({
            title: "Error!",
            text: "There was an error deleting the file: " + error.message,
            icon: "error",
          });
        }
      }
    });
  };

  return (
    <>
      <div className="min-h-screen place-items-center font-inter bg-gray-200 grid grid-cols-1 md:grid-cols-2 p-[1em]">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-6xl mb-7 font-semibold text-purple-600">
            Speech To AI-Speech 
          </h1>
          <button
            className={`px-6 py-2 min-w-48 min-h-12 rounded text-white relative hover:bg-purple-600/90 transition-colors shadow overflow-hidden ${
              loading ? "bg-purple-600/70 pointer-events-none" : "bg-purple-600"
            }`}
            onClick={handleListening}
            disabled={loading}
          >
            {loading ? (
              <span className="absolute inset-0 flex items-center justify-center animate-loading">
                <LoaderIcon />
              </span>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                {status === PLAY ? "Stop Listening" : "Start Listening"}
              </span>
            )}
          </button>
        </div>
        {matchingFile ? (
          <div>
            {matchingFile && (
      <div key={matchingFile.Key}>
        <p className="text-base uppercase leading-relaxed mt-2 mb-2">
          {matchingFile.Key}
        </p>
        <div className="flex justify-center items-center gap-3">
          <audio
            controls
            src={`${import.meta.env.VITE_PUBLIC_R2_BUCKET_URL}/${matchingFile.Key}`}
            type="audio/mpeg"
          ></audio>
          <button
            onClick={() => handleDelete(matchingFile.Key)}
            className="py-2 px-4 bg-red-500 text-white rounded"
          >
            Delete
          </button>
        </div>
      </div>
    )}
{/*             <ul>
              
              {audioFiles.map((file) => (
                <li key={file.Key}>
                  <p className="text-base uppercase leading-relaxed mt-2 mb-2">
                    {file.Key}
                  </p>
                  <div className="flex justify-center items-center gap-3">
                    <audio
                      controls
                      src={`${import.meta.env.VITE_PUBLIC_R2_BUCKET_URL}/${
                        file.Key
                      }`}
                      type="audio/mpeg"
                    ></audio>
                    <button
                      onClick={() => handleDelete(file.Key)}
                      className="py-2 px-4 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul> */}
          </div>
        ) : (
          <p className="text-center  font-semibold text-purple-600 text-4xl leading-relaxed">
          {!keyword
    ? 'Waiting for input'
    : state.loading
      ? `Loading your query: ${keyword}`
      : 'Please try again'}
          </p>
        )}
      </div>
      <ToastContainer autoClose={2000} />
    </>
  );
}


