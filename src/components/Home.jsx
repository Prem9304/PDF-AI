import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, storage, db } from '../firebase-config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const Home = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [subjects] = useState(['Math', 'Science', 'History']);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserFiles();
  }, []);

  const loadUserFiles = async () => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'documents'),
      where('userId', '==', auth.currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    const userFiles = [];
    querySnapshot.forEach((doc) => {
      userFiles.push({ id: doc.id, ...doc.data() });
    });
    setFiles(userFiles);
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ');
    }
    return text;
  };

  const classifyPDFSubject = async (text) => {
    const prompt = `Classify the following text into one of these subjects: ${subjects.join(', ')}.\n\nText: ${text}`;
    const apiKey = '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';

    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API Response:', response.data.choices[0].message.content.trim());
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
    if (!file || !file.type.includes('pdf')) {
      alert('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `documents/${auth.currentUser.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const pdfText = await extractTextFromPDF(file);
      const subject = await classifyPDFSubject(pdfText.substring(0, 1000)); // Use first 1000 characters
      
      await addDoc(collection(db, 'documents'), {
        userId: auth.currentUser.uid,
        name: file.name,
        url: url,
        subject: subject || 'Uncategorized',
        uploadedAt: new Date().toISOString(),
      });

      loadUserFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">My Documents</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/chat')}
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
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={uploading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/document/${file.id}`)}
            >
              <div className="text-lg font-semibold mb-2">{file.name}</div>
              <div className="text-sm text-gray-500">Subject: {file.subject}</div>
              <div className="text-sm text-gray-500">
                Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
