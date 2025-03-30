// server.js - Express backend for YouTube Translator Chrome Extension
const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Get transcript for a YouTube video
 * @route GET /api/transcript/:videoId
 */
app.get('/api/transcript/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`Fetching transcript for video: ${videoId}`);
    
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No transcript found for this video' 
      });
    }
    
    res.json({
      success: true,
      transcript
    });
  } catch (error) {
    console.error('Transcript fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transcript',
      error: error.message
    });
  }
});

/**
 * Get a random segment from a video's transcript
 * @route GET /api/random-segment/:videoId
 * @query {string} targetLang - Target language code (e.g., 'es', 'fr')
 */
app.get('/api/random-segment/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { targetLang = 'es' } = req.query; // Default to Spanish if not specified
    
    // Get transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transcript found for this video'
      });
    }
    
    // Select a random segment
    const randomIndex = Math.floor(Math.random() * transcript.length);
    const segment = transcript[randomIndex];
    
    // Translate the segment
    const translatedText = await translateText(segment.text, targetLang);
    
    res.json({
      success: true,
      originalSegment: segment,
      translatedText,
      targetLang
    });
  } catch (error) {
    console.error('Random segment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get random segment',
      error: error.message
    });
  }
});

/**
 * Translate text to target language using Google Translate API
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, targetLang) {
  try {
    // Use Google Translate's unofficial API (for educational purposes)
    // In production, you should use an official translation API with proper authentication
    const response = await axios.get(
      'https://translate.googleapis.com/translate_a/single',
      {
        params: {
          client: 'gtx',
          sl: 'auto', // Source language auto-detect
          tl: targetLang,
          dt: 't',
          q: text
        }
      }
    );
    
    // Extract the translated text from the nested response
    return response.data[0][0][0];
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Translation failed');
  }
}

/**
 * Check similarity between original and spoken text
 * @route POST /api/check-similarity
 * @body {string} original - Original text
 * @body {string} spoken - Spoken text
 */
app.post('/api/check-similarity', (req, res) => {
  try {
    const { original, spoken } = req.body;
    
    if (!original || !spoken) {
      return res.status(400).json({
        success: false,
        message: 'Both original and spoken text are required'
      });
    }
    
    const similarityScore = calculateSimilarity(original, spoken);
    
    res.json({
      success: true,
      similarity: similarityScore,
      original,
      spoken
    });
  } catch (error) {
    console.error('Similarity check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate similarity',
      error: error.message
    });
  }
});

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Similarity percentage
 */
function calculateSimilarity(a, b) {
  // Convert to lowercase for better comparison
  a = a.toLowerCase();
  b = b.toLowerCase();
  
  // Calculate Levenshtein distance
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) === a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // substitution
          matrix[i][j-1] + 1,   // insertion
          matrix[i-1][j] + 1    // deletion
        );
      }
    }
  }
  
  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 100 : ((maxLen - distance) / maxLen) * 100;
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});