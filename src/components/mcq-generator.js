import { Groq } from 'groq-sdk';

const RESPONSE_JSON = {
  "1": {
    "no": 1,
    "mcq": "What is the capital of France?",
    "options": {
      "A": "London",
      "B": "Paris",
      "C": "Berlin",
      "D": "Madrid"
    },
    "correct": "B"
  }
};

const generateMCQs = async ({ text, number, subject, tone }) => {
  if (!text || !number || !subject || !tone) {
    throw new Error('Missing required parameters');
  }

  const apiKey = "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";
  
  // Initialize Groq client correctly
  const client = new Groq({ apiKey: "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" , dangerouslyAllowBrowser: true })

  const systemPrompt = `You are an expert MCQ maker. Create multiple choice questions based on the provided text.
    Format your response as a JSON object matching this structure exactly:
    ${JSON.stringify(RESPONSE_JSON, null, 2)}`;

  const userPrompt = `
    Create ${number} multiple-choice questions for ${subject} students in a ${tone} tone based on this text:
    "${text}"

    Ensure each question:
    1. Has exactly 4 options (A, B, C, D)
    2. Has one correct answer marked
    3. Is relevant to the text content
    4. Follows the exact JSON format shown

    Return ONLY the JSON object with no additional text.`;

  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
    });

    const quizContent = completion.choices[0]?.message?.content?.trim();
    
    if (!quizContent) {
      throw new Error('No content received from API');
    }

    // Parse and validate the JSON response
    let quiz;
    try {
      // Remove any markdown code block syntax if present
      const cleanJSON = quizContent.replace(/```json\n?|```/g, '').trim();
      quiz = JSON.parse(cleanJSON);
    } catch (parseError) {
      throw new Error(`Failed to parse API response: ${parseError.message}`);
    }

    // Validate the structure of each question
    Object.entries(quiz).forEach(([key, question]) => {
      if (!question.mcq || !question.options || !question.correct) {
        throw new Error(`Invalid question format for question ${key}`);
      }
      
      // Validate options
      if (!['A', 'B', 'C', 'D'].every(option => question.options[option])) {
        throw new Error(`Missing options for question ${key}`);
      }
      
      // Validate correct answer
      if (!['A', 'B', 'C', 'D'].includes(question.correct)) {
        throw new Error(`Invalid correct answer for question ${key}`);
      }
    });

    return quiz;

  } catch (error) {
    // Handle different types of errors
    if (error.response) {
      // API error response
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown API error'}`);
    } else if (error.request) {
      // Network error
      throw new Error('Network error: Failed to reach the API');
    } else {
      // Other errors (including validation errors we threw)
      throw new Error(`MCQ Generation Error: ${error.message}`);
    }
  }
};

export default generateMCQs;