import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { collection, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebase-config';
import * as pdfjsLib from 'pdfjs-dist';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import MCQGenerator from './MCQGenerator';

// Initialize PDF.js with the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const DocumentViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [processingAi, setProcessingAi] = useState(false);
  const [mcqs, setMcqs] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [pdfText, setPdfText] = useState('');
  const [showMcqGenerator, setShowMcqGenerator] = useState(false);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    loadDocument();
  }, [id]);

  const extractPdfText = async (url) => {
    try {
      // Fetch the PDF file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

 const loadDocument = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'documents', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError('Document not found');
        return;
      }

      const documentData = { id: docSnap.id, ...docSnap.data() };
      setDocument(documentData);

      const storage = getStorage();
      const fileRef = ref(storage, `documents/${auth.currentUser.uid}/${documentData.subject}/${documentData.name}`);
      const url = await getDownloadURL(fileRef);
      setPdfUrl(url);

      // Extract text after getting URL
      setExtractingText(true);
      const extractedText = await extractPdfText(url);
      setPdfText(extractedText);
      setError(null);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Error loading document. Please try again later.');
    } finally {
      setLoading(false);
      setExtractingText(false);
    }
  };

  const handleAiAction = async (action) => {
    setProcessingAi(true);
    setAiResponse(null);
    setMcqs([]);
    setShowResults(false);
    setSelectedAnswers({});
  
    try {
      switch (action) {
        case 'summarize':
          setAiResponse("This is a placeholder summary of the document. Replace with actual AI-generated summary.");
          break;
        case 'explain':
          setAiResponse("This is a placeholder explanation of the document. Replace with actual AI-generated explanation.");
          break;
        case 'generate-mcqs':
          setShowMcqGenerator(true);
          break;
        default:
          throw new Error('Invalid AI action');
      }
    } catch (err) {
      console.error('Error processing AI action:', err);
      setError('Error processing AI request');
    } finally {
      setProcessingAi(false);
    }
  };

  const handleMCQsGenerated = (generatedMcqs) => {
    setMcqs(generatedMcqs);
    setShowMcqGenerator(false);
  };

  const handleAnswerSelect = (questionId, optionIndex) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    mcqs.forEach(question => {
      if (selectedAnswers[question.id] === question.correctAnswer) {
        correct++;
      }
    });
    return {
      correct,
      total: mcqs.length,
      percentage: Math.round((correct / mcqs.length) * 100)
    };
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{document?.name}</h1>
            <button
              onClick={() => navigate('/home')}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4">
            <button
              onClick={() => handleAiAction('summarize')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={processingAi || extractingText}
            >
              Summarize
            </button>
            <button
              onClick={() => handleAiAction('explain')}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
              disabled={processingAi || extractingText}
            >
              Explain
            </button>
            <button
              onClick={() => handleAiAction('generate-mcqs')}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400"
              disabled={processingAi || extractingText}
            >
              Generate MCQs
            </button>
          </div>
        </div>

        {extractingText && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              Extracting text from PDF...
            </div>
          </div>
        )}

        {processingAi && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              Processing...
            </div>
          </div>
        )}

        {aiResponse && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-xl font-bold mb-2">AI Response:</h2>
            <p className="whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}

        {showMcqGenerator && (
          <MCQGenerator
            pdfContent={pdfText}
            onMCQsGenerated={handleMCQsGenerated}
          />
        )}

        {mcqs.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-xl font-bold mb-4">Practice Questions</h2>
            {mcqs.map((mcq, index) => (
              <div key={mcq.id} className="mb-6">
                <p className="font-semibold mb-2">
                  {index + 1}. {mcq.question}
                </p>
                <div className="space-y-2">
                  {mcq.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question-${mcq.id}`}
                        value={optionIndex}
                        checked={selectedAnswers[mcq.id] === optionIndex}
                        onChange={() => handleAnswerSelect(mcq.id, optionIndex)}
                        disabled={showResults}
                        className="form-radio"
                      />
                      <span className={
                        showResults
                          ? optionIndex === mcq.correctAnswer
                            ? 'text-green-600'
                            : selectedAnswers[mcq.id] === optionIndex
                              ? 'text-red-600'
                              : ''
                          : ''
                      }>
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {!showResults && Object.keys(selectedAnswers).length === mcqs.length && (
              <button
                onClick={() => setShowResults(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Submit Answers
              </button>
            )}

            {showResults && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <h3 className="text-lg font-bold mb-2">Results</h3>
                <div className="text-lg">
                  {`You got ${calculateScore().correct} out of ${calculateScore().total} correct (${calculateScore().percentage}%)`}
                </div>
              </div>
            )}
          </div>
        )}

        {pdfUrl && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
              <Viewer fileUrl={pdfUrl} plugins={[defaultLayoutPluginInstance]} />
            </Worker>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;