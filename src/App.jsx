import { useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import { uploadAIVoice, generateAIVoice, deleteData } from "./lib/upload";
import { LoaderIcon } from "./components/Icons";
import "react-toastify/dist/ReactToastify.css";
import Swal from "sweetalert2";

// or via CommonJS

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

function App() {
  const [state, setState] = useState({
    status: STOP,
    loading: false,
    error: null,
  });

  const audioRef = useRef([]);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  const notify = (message) => toast(message);

  const handleListening = () =>
    setState((prevState) => ({
      ...prevState,
      status: prevState.status === PLAY ? STOP : PLAY,
    }));

  const uploadAudio = async (blob) => {
    setState((prevState) => ({ ...prevState, loading: true }));
    notify("Uploading audio... Please wait.");
    const file = new File([blob], "audio.mp3", { type: blob.type });

    try {
      const audio = await generateAIVoice(file);
      await uploadAIVoice(audio);
      setState((prevState) => ({
        ...prevState,
        loading: false,
        error: null,
      }));

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

  useEffect(() => {
    const processing = async () => {
      const { status } = state;
      if (status === PLAY) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          streamRef.current = stream;
          recorderRef.current = new MediaRecorder(stream);

          recorderRef.current.ondataavailable = (event) => {
            audioRef.current.push(event.data);
          };

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
        recorderRef.current.stop();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
    };
    processing();
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [state.status]);
  const { status, loading } = state;
  const [audioFiles, setAudioFiles] = useState([]);

  useEffect(() => {
    fetchFiles();
  }, []);
  const fetchFiles = async () => {
    const params = { Bucket: import.meta.env.VITE_R2_BUCKET_NAME };
    try {
      const data = await s3.send(new ListObjectsV2Command(params));

      // Ensure that data.Contents is defined and is an array
      const mp3Files = data.Contents
        ? data.Contents.filter((file) => file.Key.endsWith(".mp3"))
        : [];

      setAudioFiles(mp3Files);
    } catch (error) {
      console.error("Error fetching audio files:", error);
    }
  };
  const handelDelete = async (item) => {
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
          await deleteData(item);
          await fetchFiles();

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
        {audioFiles.length > 0 ? (
          <div>
            <h2 className="text-center  font-semibold text-purple-600 text-4xl leading-relaxed">
              Audio Files
            </h2>
            <ul>
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
                      onClick={() => handelDelete(file.Key)}
                      className="py-2 px-4 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-center  font-semibold text-purple-600 text-4xl leading-relaxed">
            No Data
          </p>
        )}
      </div>
      <ToastContainer autoClose={2000} />
    </>
  );
}

export default App;
