import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, storage, db } from '../firebase-config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const Home = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
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
      
      // Add document metadata to Firestore
      await addDoc(collection(db, 'documents'), {
        userId: auth.currentUser.uid,
        name: file.name,
        url: url,
        subject: 'Pending Classification', // This would be updated by AI
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