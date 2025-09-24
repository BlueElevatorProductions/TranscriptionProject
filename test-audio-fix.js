#!/usr/bin/env node

// Test script to verify audio path resolution and WAV conversion fixes
const fs = require('fs');
const path = require('path');

// Import the AudioConverter class
const { AudioConverter } = require('./build/main/main/services/AudioConverter.js');

async function testWAVConversion() {
  console.log('🧪 Testing WAV conversion with enhanced path resolution...');

  // Test audio file that exists
  const sourceAudio = '/Users/chrismcleod/Development/ClaudeAccess/Working Audio/Future of Search v2.mp3';
  const testDir = '/Users/chrismcleod/Development/ClaudeAccess/Test Audio Fix';
  const targetWavPath = path.join(testDir, 'Future of Search v2.wav');

  // Create test project directory structure
  const audioDir = path.join(testDir, 'Audio Files');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  if (!fs.existsSync(sourceAudio)) {
    console.error('❌ Source audio file not found:', sourceAudio);
    process.exit(1);
  }

  console.log('✅ Source audio file exists:', sourceAudio);

  try {
    const converter = new AudioConverter();
    console.log('🔄 Starting WAV conversion...');

    const result = await converter.resampleAudio(
      sourceAudio,
      48000, // 48kHz
      16,    // 16-bit
      'wav',
      {
        outputPath: path.join(audioDir, 'Future of Search v2.wav'),
        onProgress: (percent) => {
          if (percent % 20 === 0 || percent === 100) {
            console.log(`📈 Conversion progress: ${percent}%`);
          }
        }
      }
    );

    console.log('✅ WAV conversion completed!');
    console.log('📊 Result:', {
      outputPath: result.outputPath,
      originalSize: result.originalSize,
      convertedSize: result.convertedSize,
      compressionRatio: result.compressionRatio,
      duration: result.duration,
      wasConverted: result.wasConverted
    });

    // Verify the output file
    if (fs.existsSync(result.outputPath)) {
      const stats = fs.statSync(result.outputPath);
      console.log('✅ WAV file created successfully:', result.outputPath);
      console.log('📁 File size:', (stats.size / (1024 * 1024)).toFixed(2), 'MB');
    } else {
      console.error('❌ WAV file was not created at expected path:', result.outputPath);
    }

  } catch (error) {
    console.error('❌ WAV conversion failed:', error);
    process.exit(1);
  }
}

testWAVConversion().catch(console.error);