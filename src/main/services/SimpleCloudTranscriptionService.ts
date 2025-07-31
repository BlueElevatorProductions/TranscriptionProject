import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface ProgressCallback {
  (progress: { progress: number; status: string }): void;
}

export class SimpleCloudTranscriptionService {
  private apiKeys: { [service: string]: string };

  constructor(apiKeys: { [service: string]: string }) {
    this.apiKeys = apiKeys;
  }

  private async convertAudioForOpenAI(audioPath: string): Promise<string> {
    
    // Check if file is already in supported format
    const ext = path.extname(audioPath).toLowerCase();
    const supportedFormats = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.webm'];
    
    if (supportedFormats.includes(ext) && ext !== '.m4a') {
      return audioPath; // Already supported
    }
    
    // Convert .m4a or other unsupported formats to .wav
    const outputPath = audioPath.replace(path.extname(audioPath), '_converted.wav');
    
    return new Promise((resolve, reject) => {
      // Try to convert using ffmpeg if available
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-y',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          // If ffmpeg fails, try with original file anyway
          console.warn('FFmpeg conversion failed, trying original file');
          resolve(audioPath);
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.warn('FFmpeg not available, trying original file:', error.message);
        resolve(audioPath);
      });
    });
  }

  async transcribeWithOpenAI(audioPath: string, progressCallback: ProgressCallback): Promise<any> {
    if (!this.apiKeys.openai) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Starting OpenAI transcription for:', audioPath);
    console.log('API Key present:', this.apiKeys.openai ? 'Yes' : 'No');

    // Validate API key format
    const apiKey = this.apiKeys.openai.trim();
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format (should start with sk-)');
    }
    
    if (apiKey.length < 20) {
      throw new Error('OpenAI API key appears to be truncated');
    }
    
    console.log('API Key validation passed:', {
      starts_with_sk: apiKey.startsWith('sk-'),
      length: apiKey.length,
      first_10_chars: apiKey.substring(0, 10) + '...'
    });

    try {
      progressCallback({ progress: 10, status: 'Converting audio format...' });
      
      // Convert audio to supported format if needed
      const convertedPath = await this.convertAudioForOpenAI(audioPath);
      console.log('Using file for transcription:', convertedPath);
      
      progressCallback({ progress: 20, status: 'Uploading to OpenAI...' });

      // Verify file exists and get size
      const stats = await fs.promises.stat(convertedPath);
      console.log(`File size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      
      if (stats.size > 25 * 1024 * 1024) { // 25MB limit
        throw new Error('Audio file too large (max 25MB for OpenAI)');
      }

      // Make actual OpenAI API call
      const FormData = require('form-data');
      const { default: fetch } = await (new Function('return import("node-fetch")')());
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(convertedPath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');
      formData.append('language', 'en'); // Specify language for better punctuation
      // OpenAI prompt should be a sample text with the desired formatting style
      formData.append('prompt', 'Welcome to the show. Today, we\'ll discuss important topics with proper punctuation. How are you doing? That\'s great! Let\'s get started.'); // Sample text showing proper punctuation style

      console.log('Making OpenAI API request with punctuation-optimized parameters...');
      console.log('Request parameters:', {
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: 'word',
        language: 'en',
        prompt: 'Welcome to the show. Today, we\'ll discuss important topics...'
      });
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      console.log('OpenAI API Response Status:', response.status);
      console.log('OpenAI API Response Headers:', response.headers.raw());

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error Response:', errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      progressCallback({ progress: 90, status: 'Processing results...' });

      const result = await response.json() as any;
      console.log('OpenAI API Response received:', {
        hasText: !!result.text,
        hasSegments: !!result.segments,
        hasWords: !!result.words,
        language: result.language,
        textLength: result.text?.length || 0
      });
      
      // CRITICAL: Log the actual response to debug
      console.log('Raw OpenAI Response:', JSON.stringify(result, null, 2));
      
      // Debug word-level data specifically
      if (result.segments && result.segments.length > 0) {
        const firstSegment = result.segments[0];
        console.log('First segment structure:', {
          hasWords: !!firstSegment.words,
          wordCount: firstSegment.words?.length || 0,
          segmentText: firstSegment.text,
          firstFewWords: firstSegment.words?.slice(0, 5)
        });
      }
      
      // Clean up converted file if we created one
      if (convertedPath !== audioPath) {
        try {
          await fs.promises.unlink(convertedPath);
          console.log('Cleaned up converted file');
        } catch (error) {
          console.warn('Failed to clean up converted file:', error);
        }
      }
      
      // Ensure we have actual content
      if (!result.text || result.text.trim().length === 0) {
        throw new Error('OpenAI returned empty transcription');
      }
      
      // Convert OpenAI format to WhisperX-compatible format
      const convertedResult = this.convertOpenAIToWhisperX(result);
      console.log('Converted result:', {
        segmentCount: convertedResult.segments?.length || 0,
        firstSegmentText: convertedResult.segments?.[0]?.text || 'No segments'
      });
      
      return convertedResult;
      
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw new Error(`OpenAI transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribeWithAssemblyAI(audioPath: string, progressCallback: ProgressCallback): Promise<any> {
    if (!this.apiKeys.assemblyai) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      progressCallback({ progress: 10, status: 'Preparing for AssemblyAI...' });
      
      // For now, simulate AssemblyAI transcription
      return await this.simulateAssemblyAITranscription(audioPath, progressCallback);
      
    } catch (error) {
      throw new Error(`AssemblyAI transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private redistributePunctuation(segmentText: string, words: any[]): any[] {
    if (!words || words.length === 0 || !segmentText) {
      return words;
    }

    console.log('Redistributing punctuation:', {
      segmentText,
      wordCount: words.length,
      firstFewWords: words.slice(0, 5).map(w => w.word || w.text)
    });

    // Create a copy of words to modify
    const wordsWithPunctuation = words.map(word => ({
      ...word,
      word: word.word || word.text || ''
    }));

    // Extract all words from the segment text, preserving punctuation
    const textWords = segmentText.split(/\s+/).filter(word => word.length > 0);
    
    // If the word counts don't match, use a more sophisticated approach
    if (textWords.length !== words.length) {
      console.log('Word count mismatch, using fuzzy matching:', {
        textWords: textWords.length,
        wordObjects: words.length
      });
      
      // Try to match words by removing punctuation and comparing
      const cleanTextWords = textWords.map(word => word.replace(/[^\w']/g, '').toLowerCase());
      const cleanWordObjects = words.map(word => (word.word || word.text || '').replace(/[^\w']/g, '').toLowerCase());
      
      // Match each word object to its corresponding text word
      for (let i = 0; i < wordsWithPunctuation.length; i++) {
        const cleanWord = cleanWordObjects[i];
        
        // Find the best matching text word
        for (let j = 0; j < textWords.length; j++) {
          if (cleanTextWords[j] === cleanWord) {
            // Found a match - copy the punctuation
            wordsWithPunctuation[i].word = textWords[j];
            // Mark this text word as used to avoid double-matching
            cleanTextWords[j] = '';
            break;
          }
        }
      }
    } else {
      // Simple case: word counts match, direct mapping
      console.log('Word counts match, using direct mapping');
      for (let i = 0; i < Math.min(textWords.length, wordsWithPunctuation.length); i++) {
        wordsWithPunctuation[i].word = textWords[i];
      }
    }

    // Special handling for common punctuation patterns
    this.handleSpecialPunctuationCases(wordsWithPunctuation, segmentText);

    console.log('Punctuation redistribution complete:', {
      before: words.slice(0, 5).map(w => w.word || w.text),
      after: wordsWithPunctuation.slice(0, 5).map(w => w.word)
    });

    return wordsWithPunctuation;
  }

  private handleSpecialPunctuationCases(words: any[], segmentText: string): void {
    // Handle contractions and apostrophes
    const contractionPattern = /\b(\w+)'(\w+)\b/g;
    let match;
    while ((match = contractionPattern.exec(segmentText)) !== null) {
      const fullContraction = match[0];
      const firstPart = match[1];
      const secondPart = match[2];
      
      // Find consecutive words that might form this contraction
      for (let i = 0; i < words.length - 1; i++) {
        const word1 = (words[i].word || '').toLowerCase().replace(/[^\w]/g, '');
        const word2 = (words[i + 1].word || '').toLowerCase().replace(/[^\w]/g, '');
        
        if (word1 === firstPart.toLowerCase() && word2 === secondPart.toLowerCase()) {
          // Merge the contraction into the first word and remove the second
          words[i].word = fullContraction;
          // Mark the second word for removal or leave it empty
          words[i + 1].word = '';
          break;
        }
      }
    }

    // Handle quotation marks - try to place them at sentence boundaries
    if (segmentText.includes('"') || segmentText.includes("'")) {
      const openingQuotePattern = /^["']|(?<=\s)["']/g;
      const closingQuotePattern = /["'](?=\s|$)/g;
      
      // This is a simplified approach - in a full implementation, you'd want more sophisticated quote handling
      if (segmentText.startsWith('"') || segmentText.startsWith("'")) {
        if (words[0]) {
          words[0].word = segmentText[0] + (words[0].word || '');
        }
      }
      
      if (segmentText.endsWith('"') || segmentText.endsWith("'")) {
        const lastIndex = words.length - 1;
        if (words[lastIndex]) {
          words[lastIndex].word = (words[lastIndex].word || '') + segmentText[segmentText.length - 1];
        }
      }
    }
  }

  private convertOpenAIToWhisperX(openaiResult: any): any {
    console.log('Converting OpenAI result to WhisperX format');
    
    // Ensure we have the expected structure
    if (!openaiResult || !openaiResult.text) {
      console.error('Invalid OpenAI result structure:', openaiResult);
      throw new Error('Invalid response from OpenAI API');
    }
    
    // Convert OpenAI Whisper API format to WhisperX format
    const segments = openaiResult.segments || [];
    
    // If no segments but we have text, create a single segment
    if (segments.length === 0 && openaiResult.text) {
      console.log('No segments provided, creating single segment from text');
      segments.push({
        id: 0,
        start: 0,
        end: openaiResult.duration || 30, // Default duration if not provided
        text: openaiResult.text,
        words: openaiResult.words || []
      });
    }
    
    const convertedSegments = segments.map((segment: any, index: number) => {
      console.log(`Converting segment ${index}:`, {
        originalText: segment.text,
        wordCount: segment.words?.length || 0,
        firstWords: segment.words?.slice(0, 3)
      });
      
      // Redistribute punctuation from segment text to individual words
      const wordsWithPunctuation = this.redistributePunctuation(segment.text || '', segment.words || []);
      
      return {
        id: index,
        start: segment.start || 0,
        end: segment.end || 0,
        text: segment.text || '',
        words: wordsWithPunctuation.map((word: any, wordIndex: number) => {
          const convertedWord = {
            start: word.start || 0,
            end: word.end || 0,
            word: word.word || word.text || '',
            score: word.confidence || 1.0
          };
          
          // Log the first few words to debug punctuation
          if (index === 0 && wordIndex < 5) {
            console.log(`Word ${wordIndex} after punctuation redistribution:`, {
              original: word,
              converted: convertedWord
            });
          }
          
          return convertedWord;
        }),
        speaker: segment.speaker || 'SPEAKER_00' // OpenAI doesn't do speaker detection
      };
    });
    
    const result = {
      segments: convertedSegments,
      language: openaiResult.language || 'en',
      word_segments: openaiResult.words || []
    };
    
    console.log('Conversion complete:', {
      originalSegments: segments.length,
      convertedSegments: convertedSegments.length,
      totalText: convertedSegments.map((s: any) => s.text).join(' ').length
    });
    
    return result;
  }

  private async simulateOpenAITranscription(audioPath: string, progressCallback: ProgressCallback): Promise<any> {
    // Simulate OpenAI processing with proper progress updates
    return new Promise((resolve) => {
      let progress = 30;
      const interval = setInterval(() => {
        progress += 15;
        if (progress < 90) {
          progressCallback({ progress, status: 'Processing with OpenAI Whisper...' });
        } else {
          clearInterval(interval);
          progressCallback({ progress: 90, status: 'Converting results...' });
          
          // Clean up converted file if we created one
          if (audioPath.includes('_converted.wav')) {
            try {
              fs.unlinkSync(audioPath);
            } catch (error) {
              console.warn('Failed to clean up converted file:', error);
            }
          }
          
          setTimeout(() => {
            resolve({
              status: 'success',
              segments: [
                {
                  id: 0,
                  start: 0.0,
                  end: 8.0,
                  text: `This is a simulated OpenAI Whisper transcription with audio format conversion support. The file was processed successfully.`,
                  words: [
                    { start: 0.0, end: 0.5, word: "This", score: 0.99 },
                    { start: 0.5, end: 0.7, word: "is", score: 0.98 },
                    { start: 0.7, end: 0.9, word: "a", score: 0.97 },
                    { start: 0.9, end: 1.5, word: "simulated", score: 0.96 },
                    { start: 1.5, end: 2.2, word: "OpenAI", score: 0.95 },
                    { start: 2.2, end: 2.8, word: "Whisper", score: 0.94 },
                    { start: 2.8, end: 3.5, word: "transcription", score: 0.93 },
                    { start: 3.5, end: 4.0, word: "with", score: 0.92 },
                    { start: 4.0, end: 4.5, word: "audio", score: 0.91 },
                    { start: 4.5, end: 5.0, word: "format", score: 0.90 },
                    { start: 5.0, end: 5.5, word: "conversion", score: 0.89 },
                    { start: 5.5, end: 6.0, word: "support.", score: 0.88 },
                    { start: 6.0, end: 6.3, word: "The", score: 0.87 },
                    { start: 6.3, end: 6.6, word: "file", score: 0.86 },
                    { start: 6.6, end: 6.9, word: "was", score: 0.85 },
                    { start: 6.9, end: 7.4, word: "processed", score: 0.84 },
                    { start: 7.4, end: 8.0, word: "successfully.", score: 0.83 }
                  ],
                  speaker: 'SPEAKER_00'
                }
              ],
              language: 'en',
              word_segments: []
            });
          }, 500);
        }
      }, 800);
    });
  }

  async testOpenAIConnection(): Promise<boolean> {
    if (!this.apiKeys.openai) {
      console.error('OpenAI API key not configured for testing');
      return false;
    }

    try {
      const { default: fetch } = await (new Function('return import("node-fetch")')());
      
      console.log('Testing OpenAI API connection...');
      
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openai}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const models = await response.json() as any;
        console.log('OpenAI API connection successful');
        console.log('Available models:', models.data?.slice(0, 3).map((m: any) => m.id) || 'Unknown');
        return true;
      } else {
        const error = await response.text();
        console.error('OpenAI API connection failed:', response.status, error);
        return false;
      }
    } catch (error) {
      console.error('OpenAI API test failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async testAssemblyAIConnection(): Promise<boolean> {
    if (!this.apiKeys.assemblyai) {
      console.error('AssemblyAI API key not configured for testing');
      return false;
    }

    try {
      const { default: fetch } = await (new Function('return import("node-fetch")')());
      
      console.log('Testing AssemblyAI API connection...');
      
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'GET',
        headers: {
          'authorization': this.apiKeys.assemblyai,
          'content-type': 'application/json'
        }
      });
      
      if (response.ok || response.status === 404) {
        // 404 is expected for GET on /transcript endpoint
        console.log('AssemblyAI API connection successful');
        return true;
      } else {
        const error = await response.text();
        console.error('AssemblyAI API connection failed:', response.status, error);
        return false;
      }
    } catch (error) {
      console.error('AssemblyAI API test failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  private async simulateAssemblyAITranscription(audioPath: string, progressCallback: ProgressCallback): Promise<any> {
    // Simulate AssemblyAI processing with speaker detection
    return new Promise((resolve) => {
      let progress = 10;
      const interval = setInterval(() => {
        progress += 20;
        if (progress < 90) {
          progressCallback({ progress, status: 'Processing with AssemblyAI...' });
        } else {
          clearInterval(interval);
          progressCallback({ progress: 90, status: 'Processing results...' });
          
          setTimeout(() => {
            resolve({
              status: 'success',
              segments: [
                {
                  id: 0,
                  start: 0.0,
                  end: 6.0,
                  text: `This is a simulated AssemblyAI transcription with excellent speaker detection capabilities.`,
                  words: [
                    { start: 0.0, end: 0.5, word: "This", score: 0.99 },
                    { start: 0.5, end: 0.7, word: "is", score: 0.98 },
                    { start: 0.7, end: 0.9, word: "a", score: 0.97 },
                    { start: 0.9, end: 1.5, word: "simulated", score: 0.96 },
                    { start: 1.5, end: 2.5, word: "AssemblyAI", score: 0.95 },
                    { start: 2.5, end: 3.2, word: "transcription", score: 0.94 },
                    { start: 3.2, end: 3.6, word: "with", score: 0.93 },
                    { start: 3.6, end: 4.2, word: "excellent", score: 0.92 },
                    { start: 4.2, end: 4.7, word: "speaker", score: 0.91 },
                    { start: 4.7, end: 5.3, word: "detection", score: 0.90 },
                    { start: 5.3, end: 6.0, word: "capabilities.", score: 0.89 }
                  ],
                  speaker: 'SPEAKER_00'
                },
                {
                  id: 1,
                  start: 6.0,
                  end: 10.0,
                  text: `This service provides fast cloud processing with speaker identification.`,
                  words: [
                    { start: 6.0, end: 6.5, word: "This", score: 0.99 },
                    { start: 6.5, end: 7.0, word: "service", score: 0.98 },
                    { start: 7.0, end: 7.5, word: "provides", score: 0.97 },
                    { start: 7.5, end: 8.0, word: "fast", score: 0.96 },
                    { start: 8.0, end: 8.5, word: "cloud", score: 0.95 },
                    { start: 8.5, end: 9.0, word: "processing", score: 0.94 },
                    { start: 9.0, end: 9.3, word: "with", score: 0.93 },
                    { start: 9.3, end: 9.7, word: "speaker", score: 0.92 },
                    { start: 9.7, end: 10.0, word: "identification.", score: 0.91 }
                  ],
                  speaker: 'SPEAKER_01'
                }
              ],
              language: 'en',
              word_segments: []
            });
          }, 500);
        }
      }, 1000);
    });
  }
}

export default SimpleCloudTranscriptionService;