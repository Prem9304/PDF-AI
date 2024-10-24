import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, storage, db } from "../firebase-config";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getStorage,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import axios from "axios";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Tesseract from "tesseract.js";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const Home = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [subjects] = useState([
    "Artificial Intelligence",
    "Database Management System",
    "Information Retrieval",
    "Design and Analysis of Algorithms",
    "Data Structures And Algorithms"
  ]);
  const navigate = useNavigate();
  const [currentFolder, setCurrentFolder] = useState(null);

  useEffect(() => {
    loadUserFiles();
  }, [files]);

  const loadUserFiles = async (subject = null) => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "documents"),
      where("userId", "==", auth.currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    const subjectFiles = {};

    querySnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const subject = data.subject || "Uncategorized"; // Fallback to "Uncategorized"
      if (!subjectFiles[subject]) {
        subjectFiles[subject] = [];
      }
      subjectFiles[subject].push(data);
    });

    setFiles(subjectFiles);
    if (subject) {
      setCurrentFolder(subject);
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    const totalPages = pdf.numPages;
    const maxPages = Math.min(totalPages, 5);

    // Process each page to extract images for OCR
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // Perform OCR on the rendered canvas (image)
      const {
        data: { text: pageText },
      } = await Tesseract.recognize(canvas.toDataURL(), "eng", {
        logger: (info) => console.log(info), // Optional: log progress
      });

      text += pageText + " ";
    }
    return text;
  };

  const classifyPDFSubject = async (text) => {
    console.log(text)
    const prompt = `Based on the text provided below, please identify the most relevant subject from the following list: ${subjects.join(
      ", "
    )}. If none of the subjects fit, reply with "Uncategorized". 
  Text: ${text}
  Respond only with the subject name.`;

    const apiKey = "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";

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-8b-8192",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "API Response:",
        response.data.choices[0].message.content.trim()
      );
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error classifying the document:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      } else if (error.request) {
        console.error("No response received:", error.request);
      } else {
        console.error("Error setting up request:", error.message);
      }
      return "Uncategorized";
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.includes("pdf")) {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);
    try {
      const pdfText = await extractTextFromPDF(file);
      const subject = await classifyPDFSubject(pdfText.substring(0, 1000)); // Use first 1000 characters
      const uniqueFileName = `${file.name.split(".")[0]}_${Date.now()}.${file.name.split(".").pop()}`;

      const storageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${subject}/${uniqueFileName}` // Store under specific subject folder
      );

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const d = await addDoc(collection(db, "documents"), {
        userId: auth.currentUser.uid,
        name: uniqueFileName,
        url: url,
        subject: subject || "Uncategorized",
        uploadedAt: new Date().toISOString(),
      });

      loadUserFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file");
    }
    setUploading(false);
  };
  const handleDeleteFile = async (file) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      const storageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${file.subject}/${file.name}`
      ); // Correct storage path
      try {
        // Delete the file from Firebase Storage
        await deleteObject(storageRef);
        // Delete the document from Firestore
        await deleteDoc(doc(db, "documents", file.id));
        loadUserFiles(); // Refresh the file list
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Error deleting file");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">My Documents</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/chat")}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              AI Chat
            </button>
            <button
              onClick={() => signOut(auth)}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {uploading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          ) : (
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploading}
            />
          )}
        </div>

        {!uploading && (
          <div>
            {currentFolder ? (
              <div className="mb-4">
                <button
                  onClick={() => {
                    setCurrentFolder(null);
                    loadUserFiles(); // Load top-level folders again
                  }}
                  className="text-blue-600"
                >
                  Back to Folders
                </button>
              </div>
            ) : null}

            {/* Folders as Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 hover:cursor-pointer lg:grid-cols-3 gap-4 mb-4">
              {Object.keys(files).map((subject) =>
                currentFolder === null ? (
                  <div
                    key={subject}
                    className="bg-white rounded-lg p-4 shadow cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => loadUserFiles(subject)}
                  >
                    <h2 className="text-xl font-semibold flex items-center">
                      <span className="material-icons mr-2">folder</span>
                      <span>{subject}</span>
                    </h2>
                  </div>
                ) : null
              )}
            </div>

            {/* Files List */}
            {currentFolder && files[currentFolder] ? (
              <div>
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Name
                      </th>
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Uploaded
                      </th>
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {files && files[currentFolder].map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-gray-100"
                        onClick={() => navigate(`/document/${file.id}`)}
                      >
                        <td className="py-2 px-4 border-gray-300 hover:cursor-pointer flex justify-center">
                          <PictureAsPdfIcon
                            style={{ fontSize: 20, marginRight: 8 }}
                          />
                          {file.name}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-300 text-center">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-300 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent triggering onClick for the parent
                              handleDeleteFile(file);
                            }}
                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):  
              !files && <div>No files in this folder.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
