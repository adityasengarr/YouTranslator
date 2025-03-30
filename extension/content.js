// content.js
console.log("YouTube Translator Extension loaded.");

// --------------------------
// Configuration
// --------------------------
const BACKEND_URL = 'http://localhost:3000/api'; // Change this to your deployed backend URL
const DEFAULT_TARGET_LANGUAGE = 'es-ES'; // Default target language (Spanish)
const MIN_PAUSE_INTERVAL = 25; // Minimum seconds between pauses
const MAX_PAUSE_INTERVAL = 35; // Maximum seconds between pauses
const IS_TESTING = false; // Set to true for faster pauses during testing

// --------------------------
// Helper Functions
// --------------------------

// Get the YouTube video ID from the URL
function getVideoIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Calculate similarity between two strings (for frontend comparison)
function similarity(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  
  const levenshtein = (a, b) => {
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
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 100 : ((maxLen - distance) / maxLen) * 100;
}

// Use the Web Speech API to speak text
function speakText(text, lang = DEFAULT_TARGET_LANGUAGE) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  console.log("Speaking text:", text);
  window.speechSynthesis.speak(utterance);
}

// Create and display an overlay with the translated text and control buttons
function createOverlay(originalText, translatedText, targetLang, onResume) {
  const overlay = document.createElement('div');
  overlay.id = 'translator-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
  overlay.style.color = '#fff';
  overlay.style.zIndex = '10000';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  
  const content = document.createElement('div');
  content.style.backgroundColor = '#333';
  content.style.padding = '20px';
  content.style.borderRadius = '8px';
  content.style.textAlign = 'center';
  content.style.maxWidth = '80%';

  // Display the original and translated text
  const originalElem = document.createElement('p');
  originalElem.innerText = "Original: " + originalText;
  originalElem.style.fontSize = '16px';
  originalElem.style.marginBottom = '10px';
  content.appendChild(originalElem);
  
  const textElem = document.createElement('p');
  textElem.innerText = "Translated: " + translatedText;
  textElem.style.fontSize = '18px';
  textElem.style.fontWeight = 'bold';
  textElem.style.marginBottom = '20px';
  content.appendChild(textElem);

  // "Speak Again" button to replay the translation via speech synthesis
  const speakAgainBtn = document.createElement('button');
  speakAgainBtn.innerText = 'Speak Again';
  speakAgainBtn.style.marginRight = '10px';
  speakAgainBtn.style.padding = '8px 16px';
  speakAgainBtn.style.backgroundColor = '#4CAF50';
  speakAgainBtn.style.border = 'none';
  speakAgainBtn.style.borderRadius = '4px';
  speakAgainBtn.style.color = 'white';
  speakAgainBtn.style.cursor = 'pointer';
  speakAgainBtn.onclick = () => speakText(translatedText, targetLang);
  content.appendChild(speakAgainBtn);

  // "Record Your Answer" button to use speech recognition
  const recordBtn = document.createElement('button');
  recordBtn.innerText = 'Record Your Answer';
  recordBtn.style.padding = '8px 16px';
  recordBtn.style.backgroundColor = '#2196F3';
  recordBtn.style.border = 'none';
  recordBtn.style.borderRadius = '4px';
  recordBtn.style.color = 'white';
  recordBtn.style.cursor = 'pointer';
  content.appendChild(recordBtn);

  // Element to display similarity results
  const similarityResult = document.createElement('p');
  similarityResult.id = 'similarity-result';
  similarityResult.style.marginTop = '20px';
  similarityResult.style.minHeight = '60px';
  content.appendChild(similarityResult);

  // "Resume Video" button to remove the overlay and resume playback
  const resumeBtn = document.createElement('button');
  resumeBtn.innerText = 'Resume Video';
  resumeBtn.style.marginTop = '20px';
  resumeBtn.style.padding = '8px 16px';
  resumeBtn.style.backgroundColor = '#f44336';
  resumeBtn.style.border = 'none';
  resumeBtn.style.borderRadius = '4px';
  resumeBtn.style.color = 'white';
  resumeBtn.style.cursor = 'pointer';
  resumeBtn.onclick = () => {
    document.body.removeChild(overlay);
    const video = document.querySelector('video');
    if (video) {
      video.play();
      console.log("Video resumed.");
      
      // Call the onResume callback to schedule the next pause
      if (typeof onResume === 'function') {
        onResume();
      }
    }
  };
  content.appendChild(resumeBtn);

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // --------------------------
  // Speech Recognition Setup
  // --------------------------
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Set language to match the target language (for testing the user's pronunciation)
    recognition.lang = targetLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recordBtn.onclick = () => {
      recordBtn.disabled = true;
      recordBtn.innerText = 'Listening...';
      similarityResult.innerText = 'Listening...';
      recognition.start();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      // Calculate similarity locally for immediate feedback
      const sim = similarity(translatedText, transcript);
      
      // Format the similarity result with color coding
      let color = '#ff4d4d'; // Red for poor match
      if (sim >= 80) {
        color = '#4CAF50'; // Green for good match
      } else if (sim >= 60) {
        color = '#FFC107'; // Yellow for medium match
      }
      
      similarityResult.innerHTML = `
        <div>You said: "${transcript}"</div>
        <div style="margin-top: 10px; font-weight: bold; color: ${color}">
          Similarity: ${sim.toFixed(1)}%
        </div>
      `;
      
      recordBtn.disabled = false;
      recordBtn.innerText = 'Record Your Answer';
    };

    recognition.onerror = (event) => {
      similarityResult.innerText = `Error: ${event.error}`;
      recordBtn.disabled = false;
      recordBtn.innerText = 'Record Your Answer';
    };
  } else {
    recordBtn.disabled = true;
    recordBtn.innerText = 'Speech Recognition Not Supported';
  }
}

// --------------------------
// Main Logic
// --------------------------
function initTranslator() {
  const video = document.querySelector('video');
  if (!video) {
    console.log("No video element found, retrying in 1 second...");
    setTimeout(initTranslator, 1000);
    return;
  }
  
  console.log("Video element found, initializing translator...");
  
  // Get the video ID from URL
  const videoId = getVideoIdFromUrl();
  if (!videoId) {
    console.log("No video ID found in URL. Cannot proceed.");
    return;
  }
  
  console.log(`Found video ID: ${videoId}`);
  
  // Variable to track if we're currently paused for translation
  let isPaused = false;
  
  // Function to schedule the next pause
  function scheduleNextPause() {
    if (isPaused) return; // Don't schedule if we're already paused
    
    // Determine the delay range based on whether we're testing or not
    let minDelay, maxDelay;
    if (IS_TESTING) {
      minDelay = 5; // 5 seconds minimum for testing
      maxDelay = 15; // 15 seconds maximum for testing
    } else {
      minDelay = MIN_PAUSE_INTERVAL;
      maxDelay = MAX_PAUSE_INTERVAL;
    }
    
    // Calculate a random delay within the range
    const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
    const randomDelay = delaySeconds * 1000;
    
    console.log(`Will pause video in ${delaySeconds} seconds`);

    // Set a timeout to pause the video after the random delay
    setTimeout(() => {
      // Check if the video is still playing
      if (video.paused || isPaused) return;
      
      // Remember current timestamp and pause the video
      const currentTime = video.currentTime;
      video.pause();
      isPaused = true;
      
      console.log(`Video paused at ${currentTime.toFixed(2)}s`);
      
      // Fetch a random transcript segment from our backend
      fetch(`${BACKEND_URL}/random-segment/${videoId}?targetLang=${DEFAULT_TARGET_LANGUAGE.substring(0, 2)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const originalText = data.originalSegment.text;
            const translatedText = data.translatedText;
            
            console.log("Original text:", originalText);
            console.log("Translated text:", translatedText);
            
            // Speak the translated text
            speakText(translatedText, DEFAULT_TARGET_LANGUAGE);
            
            // Create and show the overlay with a callback for when the video resumes
            createOverlay(originalText, translatedText, DEFAULT_TARGET_LANGUAGE, () => {
              isPaused = false;
              scheduleNextPause(); // Schedule the next pause when the video resumes
            });
          } else {
            console.error("Error fetching transcript segment:", data.message);
            
            // Fallback to a dummy translation if there's an error
            const dummyOriginal = "This is a fallback transcript segment.";
            const dummyTranslated = "Este es un segmento de transcripción de respaldo.";
            
            speakText(dummyTranslated, DEFAULT_TARGET_LANGUAGE);
            createOverlay(dummyOriginal, dummyTranslated, DEFAULT_TARGET_LANGUAGE, () => {
              isPaused = false;
              scheduleNextPause(); // Schedule the next pause when the video resumes
            });
          }
        })
        .catch(error => {
          console.error("Fetch error:", error);
          
          // Fallback to a dummy translation
          const dummyOriginal = "This is a fallback transcript segment.";
          const dummyTranslated = "Este es un segmento de transcripción de respaldo.";
          
          speakText(dummyTranslated, DEFAULT_TARGET_LANGUAGE);
          createOverlay(dummyOriginal, dummyTranslated, DEFAULT_TARGET_LANGUAGE, () => {
            isPaused = false;
            scheduleNextPause(); // Schedule the next pause when the video resumes
          });
        });
    }, randomDelay);
  }
  
  // Start the first pause cycle
  scheduleNextPause();
  
  // Add event listener for when the video ends
  video.addEventListener('ended', () => {
    isPaused = true; // Prevent further pauses
    console.log("Video has ended, stopping translator.");
  });
  
  // Add event listener for when the video is manually paused
  video.addEventListener('pause', () => {
    // Only set isPaused if it wasn't our extension that paused it
    if (!isPaused) {
      isPaused = true;
      console.log("Video was manually paused, pausing translator.");
    }
  });
  
  // Add event listener for when the video is manually played
  video.addEventListener('play', () => {
    // If it was manually paused before, restart the scheduler
    if (isPaused) {
      isPaused = false;
      console.log("Video was manually resumed, restarting translator.");
      scheduleNextPause();
    }
  });
}

// Start the translator after the page has loaded
window.addEventListener('load', () => {
  console.log("Page loaded, waiting for video to be ready...");
  setTimeout(initTranslator, 3000); // Give extra time for YouTube's player to initialize
});