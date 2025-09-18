// JUCE audio engine backend with mock fallback.
// Build with -DUSE_JUCE=ON and set JUCE_DIR to compile real audio engine.

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <cstdlib>
#include <string>

#ifdef USE_JUCE
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>
#endif

struct State {
  std::string id;
  std::atomic<bool> playing{false};
  std::atomic<bool> running{true};
  std::atomic<double> editedSec{0.0};
  double durationSec{60.0};
};

static State g;
static std::mutex gMutex;

// --- Debug logging helpers (write to JUCE_DEBUG_DIR or /tmp) ---
static std::string juceDebugPath() {
  const char* dir = std::getenv("JUCE_DEBUG_DIR");
  std::string base = (dir && *dir) ? std::string(dir) : std::string("/tmp");
  // We do not attempt to create directories here to keep dependencies light.
  return base + "/juce_debug.log";
}
static void juceDLog(const std::string& line) {
  try {
    std::ofstream f(juceDebugPath(), std::ios::app);
    f << line << std::endl;
  } catch (...) {}
}

static void emit(const std::string& json) {
  std::cout << json << "\n";
  std::cout.flush();
}

static void emitLoaded() {
  emit(std::string("{") +
       "\"type\":\"loaded\",\"id\":\"" + g.id + "\",\"durationSec\":" + std::to_string(g.durationSec) +
       ",\"sampleRate\":48000,\"channels\":2}");
}

static void emitState() {
  emit(std::string("{") +
       "\"type\":\"state\",\"id\":\"" + g.id + "\",\"playing\":" + (g.playing ? "true" : "false") + "}");
}

static void emitPosition() {
  // originalSec mirrors editedSec in this mock
  const double es = g.editedSec.load();
  emit(std::string("{") +
       "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
       ",\"originalSec\":" + std::to_string(es) + "}");
}

static void timerThread() {
  using namespace std::chrono_literals;
  while (g.running) {
    if (g.playing) {
      g.editedSec.store(g.editedSec.load() + 0.033); // ~30 Hz
      if (g.editedSec >= g.durationSec) {
        g.playing = false;
        emit("{\"type\":\"ended\",\"id\":\"" + g.id + "\"}");
      } else {
        emitPosition();
      }
    }
    std::this_thread::sleep_for(33ms);
  }
}

static void handleLine(const std::string& line) {
  // Extremely simple command parsing to avoid JSON dependencies
  auto contains = [&](const char* s) { return line.find(s) != std::string::npos; };
  auto extract = [&](const char* key) -> std::string {
    // extract value for key in a very naive way: "key":"value" or numeric
    std::string k = std::string("\"") + key + "\":";
    size_t p = line.find(k);
    if (p == std::string::npos) return {};
    p += k.size();
    if (p >= line.size()) return {};
    if (line[p] == '"') {
      size_t end = line.find('"', p + 1);
      if (end == std::string::npos) return {};
      return line.substr(p + 1, end - (p + 1));
    } else {
      size_t end = line.find_first_of(",}\n", p);
      if (end == std::string::npos) end = line.size();
      return line.substr(p, end - p);
    }
  };

  if (contains("\"type\":\"load\"")) {
    std::lock_guard<std::mutex> lock(gMutex);
    g.id = extract("id");
    g.editedSec = 0.0;
    g.playing = false;
    emitLoaded();
    emitState();
    return;
  }
  if (contains("\"type\":\"play\"")) {
    g.playing = true;
    emitState();
    return;
  }
  if (contains("\"type\":\"pause\"")) {
    g.playing = false;
    emitState();
    return;
  }
  if (contains("\"type\":\"stop\"")) {
    g.playing = false;
    g.editedSec = 0.0;
    emitState();
    emitPosition();
    return;
  }
  if (contains("\"type\":\"seek\"")) {
    const std::string t = extract("timeSec");
    try { g.editedSec = std::stod(t); } catch (...) {}
    emitPosition();
    return;
  }
  if (contains("\"type\":\"queryState\"")) {
    emitState();
    emitPosition();
    return;
  }
    if (contains("\"type\":\"updateEdl\"")) {
      // Accept silently in mock handler
      return;
    }
  if (contains("\"type\":\"setRate\"") || contains("\"type\":\"setVolume\"")) {
    // Accept silently
    return;
  }
  emit("{\"type\":\"error\",\"message\":\"unknown command\"}");
}

#ifdef USE_JUCE
// --- JUCE Implementation ---
struct Segment { 
  double start; double end; double dur; 
  // For contiguous timeline, store original audio positions
  double originalStart = -1; double originalEnd = -1; 
  bool hasOriginal() const { return originalStart >= 0 && originalEnd >= 0; }
};

// Custom AudioSource that handles Edit Decision List (EDL) playback
class EdlAudioSource : public juce::PositionableAudioSource {
public:
  EdlAudioSource(juce::AudioFormatReaderSource* readerSource) : reader(readerSource) {}
  
  void updateSegments(const std::vector<Segment>& newSegments, bool isContiguous) {
    segments = newSegments;
    contiguousMode = isContiguous;
    currentSegmentIndex = 0;
    editedPosition = 0.0;
  }
  
  void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override {
    if (reader) reader->prepareToPlay(samplesPerBlockExpected, sampleRate);
    this->sampleRate = sampleRate;
  }
  
  void releaseResources() override {
    if (reader) reader->releaseResources();
  }
  
  void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override {
    bufferToFill.clearActiveBufferRegion();
    
    if (!reader || segments.empty()) return;
    
    int samplesNeeded = bufferToFill.numSamples;
    int samplesWritten = 0;
    
    while (samplesNeeded > 0 && currentSegmentIndex < segments.size()) {
      const auto& segment = segments[currentSegmentIndex];
      
      // Calculate positions in samples
      int64_t segmentStartSample, segmentEndSample;
      double segmentDuration;
      
      if (contiguousMode && segment.hasOriginal()) {
        // For reordered clips, use original audio positions
        segmentStartSample = (int64_t)(segment.originalStart * sampleRate);
        segmentEndSample = (int64_t)(segment.originalEnd * sampleRate);
        segmentDuration = segment.originalEnd - segment.originalStart;
      } else {
        // For normal clips, use regular positions  
        segmentStartSample = (int64_t)(segment.start * sampleRate);
        segmentEndSample = (int64_t)(segment.end * sampleRate);
        segmentDuration = segment.dur;
      }
      
      // Calculate relative position within this segment (in edited timeline)
      double relativeEditedPos = editedPosition - segment.start;
      if (relativeEditedPos < 0) relativeEditedPos = 0;
      
      // Map to original audio position
      double relativeProgress = relativeEditedPos / (segment.end - segment.start);
      int64_t currentOriginalSample = segmentStartSample + (int64_t)(relativeProgress * (segmentEndSample - segmentStartSample));
      
      // How many samples left in this segment?
      int64_t samplesLeftInSegment = segmentEndSample - currentOriginalSample;
      int samplesToRead = std::min(samplesNeeded, (int)samplesLeftInSegment);
      
      if (samplesToRead > 0) {
        // Read from original position
        reader->setNextReadPosition(currentOriginalSample);
        
        juce::AudioSourceChannelInfo segmentInfo;
        segmentInfo.buffer = bufferToFill.buffer;
        segmentInfo.startSample = bufferToFill.startSample + samplesWritten;
        segmentInfo.numSamples = samplesToRead;
        
        reader->getNextAudioBlock(segmentInfo);
        
        samplesWritten += samplesToRead;
        samplesNeeded -= samplesToRead;
        
        // Advance edited position
        editedPosition += (double)samplesToRead / sampleRate;
      }
      
      // Check if we've reached the end of current segment
      if (editedPosition >= segment.end - 0.001) { // Small tolerance
        currentSegmentIndex++;
        if (currentSegmentIndex < segments.size()) {
          editedPosition = segments[currentSegmentIndex].start;
        }
      }
      
      if (samplesToRead <= 0) break; // Avoid infinite loop
    }
  }
  
  void setNextReadPosition(int64_t newPosition) override {
    // Convert sample position to edited timeline position
    editedPosition = (double)newPosition / sampleRate;
    
    // Find which segment contains this edited position
    currentSegmentIndex = 0;
    for (size_t i = 0; i < segments.size(); i++) {
      if (editedPosition >= segments[i].start && editedPosition < segments[i].end) {
        currentSegmentIndex = i;
        break;
      } else if (editedPosition < segments[i].start) {
        currentSegmentIndex = i;
        editedPosition = segments[i].start;
        break;
      }
    }
  }
  
  int64_t getNextReadPosition() const override {
    return (int64_t)(editedPosition * sampleRate);
  }
  
  int64_t getTotalLength() const override {
    if (segments.empty()) return 0;
    return (int64_t)(segments.back().end * sampleRate);
  }
  
  bool isLooping() const override { return false; }

private:
  juce::AudioFormatReaderSource* reader;
  std::vector<Segment> segments;
  bool contiguousMode = false;
  size_t currentSegmentIndex = 0;
  double editedPosition = 0.0;
  double sampleRate = 44100.0;
};

class Backend : public juce::HighResolutionTimer {
public:
  Backend() {
    formatManager.registerBasicFormats();
    deviceManager.initialise(0, 2, nullptr, true);
    player.setSource(&transportOrResampler());
    deviceManager.addAudioCallback(&player);
  }
  ~Backend() override {
    stopTimer();
    player.setSource(nullptr);
    deviceManager.removeAudioCallback(&player);
    transportSource.setSource(nullptr);
  }

  void load(const std::string& id, const std::string& path) {
    std::lock_guard<std::mutex> lock(mutex);
    g.id = id;
    juce::File file{ juce::String(path) };
    juce::AudioFormatReader* reader = formatManager.createReaderFor(file);
    if (reader == nullptr) {
      emit("{\"type\":\"error\",\"message\":\"Failed to open audio file\"}");
      return;
    }
    const double sr = reader->sampleRate;
    const double duration = (reader->lengthInSamples > 0 && sr > 0.0) ? (double) reader->lengthInSamples / sr : 0.0;
    readerSource.reset(new juce::AudioFormatReaderSource(reader, true));
    transportSource.setSource(readerSource.get(), 0, nullptr, sr);
    g.durationSec = duration;
    // Default EDL: single full-file segment
    segments.clear();
    if (duration > 0.0) segments.push_back({0.0, duration, duration});
    g.editedSec = 0.0;
    g.playing = false;
    emitLoaded();
    emitState();
  }

  void play() {
    std::lock_guard<std::mutex> lock(mutex);
    juceDLog("[JUCE] play() called");
    transportSource.start();
    g.playing = true;
    emitState();
    if (!timerIsRunning) { startTimer(33); timerIsRunning = true; }
  }

  void pause() {
    std::lock_guard<std::mutex> lock(mutex);
    transportSource.stop();
    g.playing = false;
    emitState();
  }

  void stop() {
    std::lock_guard<std::mutex> lock(mutex);
    transportSource.stop();
    transportSource.setPosition(0.0);
    g.editedSec = 0.0;
    g.playing = false;
    emitState();
    emitPositionFromTransport();
  }

  void seek(double editedSec) {
    std::lock_guard<std::mutex> lock(mutex);
    const double orig = editedToOriginal(editedSec);
    juceDLog(std::string("[JUCE] seek edited=") + std::to_string(editedSec) + " -> original=" + std::to_string(orig));
    transportSource.setPosition(orig);
    g.editedSec = editedSec;
    emitPositionFromTransport();
  }

  void setRate(double rate) {
    std::lock_guard<std::mutex> lock(mutex);
    playbackRate = rate;
    resampler.setResamplingRatio(rate);
  }

  void setVolume(double gain) {
    std::lock_guard<std::mutex> lock(mutex);
    transportSource.setGain((float) gain);
  }

  void queryState() {
    std::lock_guard<std::mutex> lock(mutex);
    emitState();
    emitPositionFromTransport();
  }

  void updateEdl(std::vector<Segment> newSegs) {
    std::lock_guard<std::mutex> lock(mutex);
    segments = std::move(newSegs);
    for (auto& s : segments) s.dur = std::max(0.0, s.end - s.start);
    
    // Enhanced debug logging - write to file to see what JUCE receives
    std::ofstream debugFile(juceDebugPath(), std::ios::app);
    debugFile << "[JUCE] updateEdl received " << segments.size() << " segments at " 
              << std::time(nullptr) << std::endl;
    
    // Detect contiguous timeline by checking if segments are too perfectly aligned
    // A contiguous timeline will have segments that start exactly where the previous ends
    isContiguousTimeline = false;
    
    if (segments.size() > 1) {
      int consecutiveMatches = 0;
      for (size_t i = 1; i < segments.size() && i < 10; i++) {
        // Check if this segment starts exactly where the previous ends (within small tolerance)
        double gap = segments[i].start - segments[i-1].end;
        if (std::abs(gap) < 0.01) { // 10ms tolerance
          consecutiveMatches++;
        }
      }
      
      // If most segments are perfectly aligned, this is likely a contiguous timeline
      if (consecutiveMatches >= 3) {
        isContiguousTimeline = true;
        debugFile << "[JUCE] CONTIGUOUS TIMELINE DETECTED - Enabling special playback mode" << std::endl;
        
        // For contiguous timeline, we need to reverse-engineer the original segment times
        // The segments now contain contiguous times, but we need original audio positions
        // This requires more sophisticated mapping - for now, we'll use a simpler approach
      } else {
        debugFile << "[JUCE] Standard timeline detected (consecutive matches: " << consecutiveMatches << ")" << std::endl;
      }
    }
    
    // Log first 10 segments with their timestamps and original positions
    debugFile << "[JUCE] First 10 segments:" << std::endl;
    for (size_t i = 0; i < std::min(segments.size(), size_t(10)); i++) {
      debugFile << "  [JUCE] Segment[" << i << "]: " 
                << std::fixed << std::setprecision(2) 
                << segments[i].start << "-" << segments[i].end << "s";
      if (segments[i].hasOriginal()) {
        debugFile << " (orig: " << segments[i].originalStart << "-" << segments[i].originalEnd << "s)";
      } else {
        debugFile << " (no original)";
      }
      debugFile << std::endl;
    }
    debugFile.flush();
    // For contiguous timeline, we'll handle it in the timer callback
    // Reset the initialization flag for contiguous timeline
    if (isContiguousTimeline) {
      contiguousInitialized = false;
    }
    
    // Snap current position to start of first segment if outside any
    if (!segments.empty()) {
      const double pos = transportSource.getCurrentPosition();
      bool inside = false;
      for (const auto& s : segments) { if (pos >= s.start && pos < s.end) { inside = true; break; } }
      if (!inside) {
        transportSource.setPosition(segments.front().start);
        g.editedSec = 0.0;
        emitPositionFromTransport();
      }
    }
  }

  void hiResTimerCallback() override {
    std::lock_guard<std::mutex> lock(mutex);
    if (!g.playing) return;
    
    // With edited/original mapping fixed, both modes operate correctly.
    // Prefer contiguous handler if detected, else standard.
    if (isContiguousTimeline) handleContiguousTimelinePlayback();
    else handleStandardTimelinePlayback();
  }
  
  void handleStandardTimelinePlayback() {
    double pos = transportSource.getCurrentPosition(); // original domain
    {
      std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
      oss << "[JUCE][STD] pos=" << pos;
      if (!segments.empty()) {
        const auto& s0 = segments[0];
        const double os0 = s0.hasOriginal() ? s0.originalStart : s0.start;
        const double oe0 = s0.hasOriginal() ? s0.originalEnd   : s0.end;
        oss << " firstOrig=" << os0 << "-" << oe0;
      }
      juceDLog(oss.str());
    }
    
    if (!segments.empty()) {
      // Robustly advance across any number of boundaries with loop protection
      int loopCount = 0;
      const int maxLoops = 10; // Prevent infinite loops
      
      while (loopCount < maxLoops) {
        loopCount++;
        int segIdx = segmentFor(pos);
        
        if (segIdx < 0) {
          // Position is not in any segment
          {
            const double firstOs = segments.front().hasOriginal() ? segments.front().originalStart : segments.front().start;
            const double firstOe = segments.front().hasOriginal() ? segments.front().originalEnd   : segments.front().end;
            if (pos < firstOs) {
            // Before first segment - jump to first segment start
            double newPos = firstOs;
            transportSource.setPosition(newPos);
            pos = newPos;
            {
              std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
              oss << "[JUCE][STD] Jump to first os=" << pos;
              juceDLog(oss.str());
            }
            continue;
          } else {
            // After last segment - find which segment to jump to or end
            bool foundNext = false;
            for (size_t i = 0; i < segments.size(); ++i) {
              const double os = segments[i].hasOriginal() ? segments[i].originalStart : segments[i].start;
              if (pos < os) {
                // Found a segment that starts after our position
                double newPos = os;
                transportSource.setPosition(newPos);
                pos = newPos;
                foundNext = true;
                {
                  std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
                  oss << "[JUCE][STD] Jump to next idx=" << i << " os=" << pos;
                  juceDLog(oss.str());
                }
                break;
              }
            }
            if (!foundNext) {
              // No more segments ahead - end playback
              endPlayback();
              return;
            }
            continue;
          }
        }
        
        // Position is within a segment
        const auto& s = segments[segIdx];
        {
          const double se = s.hasOriginal() ? s.originalEnd : s.end;
          if (pos >= se - 1e-6) {
          // At or past end of current segment
          if (segIdx + 1 < (int)segments.size()) {
            // Jump to next segment
            const auto& sn = segments[segIdx + 1];
            double newPos = sn.hasOriginal() ? sn.originalStart : sn.start;
            transportSource.setPosition(newPos);
            pos = newPos;
              {
                std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
                oss << "[JUCE][STD] Boundary advance to idx=" << (segIdx+1) << " os=" << pos;
                juceDLog(oss.str());
              }
            continue;
          } else {
            // No more segments - end playback
            endPlayback();
            return;
          }
        }
        
        // Position is valid within current segment - exit loop
        break;
      }
      
      if (loopCount >= maxLoops) {
        if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
          if (strcmp(debug, "true") == 0) {
            std::cerr << "[JUCE] Loop limit reached in boundary handling" << std::endl;
          }
        }
        // Fallback: end playback to prevent infinite loop
        endPlayback();
        return;
      }
    } else if (pos >= g.durationSec) {
      endPlayback();
      return;
    }
    
    g.editedSec = originalToEdited(pos);
    emitPositionFromTransport();
  }
  
  void handleContiguousTimelinePlayback() {
    double pos = transportSource.getCurrentPosition(); // original audio time
    
    if (!contiguousInitialized && segments.size() > 0 && segments[0].hasOriginal()) {
      // On first call, jump to the first reordered segment's original position
      transportSource.setPosition(segments[0].originalStart);
      g.editedSec.store(segments[0].start);
      contiguousInitialized = true;
      
      std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
      debugFile << "[JUCE] CONTIGUOUS: Initialized to first segment orig=" << segments[0].originalStart << std::endl;
      debugFile.flush();
      
      emitPositionFromTransport();
      return;
    }
    
    // Find which segment we're currently playing (by original position)
    int segIdx = -1;
    for (size_t i = 0; i < segments.size(); i++) {
      if (segments[i].hasOriginal() && 
          pos >= segments[i].originalStart && 
          pos < segments[i].originalEnd) {
        segIdx = i;
        break;
      }
    }
    
    if (segIdx >= 0) {
      // We're in a valid segment - calculate contiguous time position
      const auto& seg = segments[segIdx];
      double relativePos = (pos - seg.originalStart) / (seg.originalEnd - seg.originalStart);
      double contiguousTime = seg.start + relativePos * (seg.end - seg.start);
      g.editedSec.store(contiguousTime);
      
      // Check if we're near the end of current segment
      if (pos >= seg.originalEnd - 0.05) { // 50ms tolerance
        if (segIdx + 1 < (int)segments.size() && segments[segIdx + 1].hasOriginal()) {
          // Jump to next reordered segment's original position
          double nextOriginalStart = segments[segIdx + 1].originalStart;
          transportSource.setPosition(nextOriginalStart);
          
          std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
          debugFile << "[JUCE] CONTIGUOUS: Advanced to segment " << (segIdx + 1) 
                    << " orig=" << nextOriginalStart << std::endl;
          debugFile.flush();
        } else {
          // No more segments - end playback
          endPlayback();
          return;
        }
      }
    } else {
      // Not in any segment - find next segment or end
      bool foundNext = false;
      for (size_t i = 0; i < segments.size(); i++) {
        if (segments[i].hasOriginal() && pos < segments[i].originalStart) {
          transportSource.setPosition(segments[i].originalStart);
          g.editedSec.store(segments[i].start);
          foundNext = true;
          
          std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
          debugFile << "[JUCE] CONTIGUOUS: Jumped to segment " << i 
                    << " orig=" << segments[i].originalStart << std::endl;
          debugFile.flush();
          break;
        }
      }
      
      if (!foundNext) {
        endPlayback();
        return;
      }
    }
    
    emitPositionFromTransport();
  }
  
  void emitPositionContiguous() {
    // For contiguous timeline, editedSec is correct, but we need to calculate originalSec
    const double es = g.editedSec.load();
    double os = es; // Default fallback
    
    // Find which contiguous segment we're in
    for (size_t i = 0; i < segments.size(); i++) {
      if (es >= segments[i].start && es < segments[i].end) {
        // We're in segment i - but segments[i] contains contiguous times
        // We need to reverse-engineer what original time this corresponds to
        // For now, we'll use a placeholder approach
        os = es; // This needs proper mapping - will be improved next
        break;
      }
    }
    
    emit(std::string("{") +
         "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
         ",\"originalSec\":" + std::to_string(os) + "}");
  }

private:
  juce::AudioDeviceManager deviceManager;
  juce::AudioSourcePlayer player;
  juce::AudioFormatManager formatManager;
  juce::AudioTransportSource transportSource;
  juce::ResamplingAudioSource resampler{ &transportSource, false, 2 };
  bool useResampler { true };
  bool timerIsRunning { false };
  double playbackRate { 1.0 };
  std::unique_ptr<juce::AudioFormatReaderSource> readerSource;
  std::mutex mutex;
  std::vector<Segment> segments;
  bool isContiguousTimeline = false;
  bool contiguousInitialized = false;

  juce::AudioSource& transportOrResampler() {
    if (useResampler) return resampler; else return transportSource;
  }

  static void emitState() {
    ::emitState();
  }

  static void emitLoaded() {
    ::emitLoaded();
  }

  void emitPositionFromTransport() {
    const double es = g.editedSec.load();
    const double os = editedToOriginal(es);
    emit(std::string("{") +
         "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
         ",\"originalSec\":" + std::to_string(os) + "}");
  }

  // EDL mapping helpers
  int segmentFor(double orig) const {
    for (size_t i = 0; i < segments.size(); ++i) {
      const auto& s = segments[i];
      const double os = s.hasOriginal() ? s.originalStart : s.start;
      const double oe = s.hasOriginal() ? s.originalEnd   : s.end;
      if (orig >= os && orig < oe) return (int)i;
    }
    return -1;
  }
  double originalToEdited(double orig) const {
    if (segments.empty()) return orig;
    double accEdited = 0.0;
    for (const auto& s : segments) {
      const double os = s.hasOriginal() ? s.originalStart : s.start;
      const double oe = s.hasOriginal() ? s.originalEnd   : s.end;
      const double odur = std::max(1e-9, oe - os);
      const double edur = std::max(1e-9, s.dur);
      if (orig < os) return accEdited; // before this segment in original domain
      if (orig < oe) {
        const double r = (orig - os) / odur;
        return accEdited + r * edur;
      }
      accEdited += edur;
    }
    return accEdited;
  }
  double editedToOriginal(double ed) const {
    if (segments.empty()) return ed;
    double accEdited = 0.0;
    for (const auto& s : segments) {
      const double os = s.hasOriginal() ? s.originalStart : s.start;
      const double oe = s.hasOriginal() ? s.originalEnd   : s.end;
      const double odur = std::max(1e-9, oe - os);
      const double edur = std::max(1e-9, s.dur);
      if (ed <= accEdited + edur) {
        const double r = (ed - accEdited) / edur;
        return os + r * odur;
      }
      accEdited += edur;
    }
    // Past end → clamp to end of last segment
    const auto& last = segments.back();
    return last.hasOriginal() ? last.originalEnd : last.end;
  }

  void endPlayback() {
    transportSource.stop();
    g.playing = false;
    emit("{\"type\":\"ended\",\"id\":\"" + g.id + "\"}");
  }
};
#endif // USE_JUCE

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

#ifdef USE_JUCE
  Backend backend;
#else
  std::thread t(timerThread);
#endif

  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.empty()) continue;
#ifdef USE_JUCE
    // Minimal command router for JUCE backend
    auto contains = [&](const char* s) { return line.find(s) != std::string::npos; };
    auto extract = [&](const char* key) -> std::string {
      std::string k = std::string("\"") + key + "\":";
      size_t p = line.find(k);
      if (p == std::string::npos) return {};
      p += k.size();
      if (p >= line.size()) return {};
      if (line[p] == '"') { size_t end = line.find('"', p + 1); if (end == std::string::npos) return {}; return line.substr(p + 1, end - (p + 1)); }
      size_t end = line.find_first_of(",}\n", p); if (end == std::string::npos) end = line.size(); return line.substr(p, end - p);
    };

    if (contains("\"type\":\"load\"")) {
      g.id = extract("id");
      backend.load(g.id, extract("path"));
      continue;
    }
    if (contains("\"type\":\"updateEdl\"")) {
      // Parse clips array robustly by extracting each object substring first
      auto findClipsArray = [&](size_t& aStart, size_t& aEnd) -> bool {
        size_t key = line.find("\"clips\"");
        if (key == std::string::npos) return false;
        size_t colon = line.find(':', key);
        if (colon == std::string::npos) return false;
        size_t lb = line.find('[', colon);
        if (lb == std::string::npos) return false;
        int depth = 1; size_t i = lb + 1;
        while (i < line.size() && depth > 0) {
          if (line[i] == '[') depth++;
          else if (line[i] == ']') depth--;
          i++;
        }
        if (depth != 0) return false;
        aStart = lb + 1; aEnd = i - 1; return true;
      };

      size_t aStart = 0, aEnd = 0;
      std::vector<std::string> itemStrings;
      if (findClipsArray(aStart, aEnd)) {
        // Extract top-level JSON objects inside the clips array
        size_t i = aStart;
        while (i < aEnd) {
          while (i < aEnd && (line[i] == ' ' || line[i] == ',' || line[i] == '\n' || line[i] == '\r' || line[i] == '\t')) i++;
          if (i >= aEnd) break;
          if (line[i] != '{') { i++; continue; }
          int depth = 1; size_t objStart = i; i++;
          while (i < aEnd && depth > 0) {
            if (line[i] == '{') depth++;
            else if (line[i] == '}') depth--;
            i++;
          }
          size_t objEnd = i; // position after closing brace
          itemStrings.push_back(line.substr(objStart, objEnd - objStart));
        }
      }

      auto extractNumber = [&](const std::string& s, const char* key) -> double {
        size_t p = s.find(key);
        if (p == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
        size_t c = s.find(':', p);
        if (c == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
        size_t e = s.find_first_of(",}\n", c + 1);
        std::string token = s.substr(c + 1, (e == std::string::npos ? s.size() : e) - (c + 1));
        try { return std::stod(token); } catch (...) { return std::numeric_limits<double>::quiet_NaN(); }
      };

      std::vector<std::tuple<double,double,int,double,double>> items; // start,end,order,origStart,origEnd
      for (const auto& obj : itemStrings) {
        double start = extractNumber(obj, "\"startSec\"");
        double end   = extractNumber(obj, "\"endSec\"");
        double ord   = extractNumber(obj, "\"order\"");
        double oS    = extractNumber(obj, "\"originalStartSec\"");
        double oE    = extractNumber(obj, "\"originalEndSec\"");
        if (!(start == start) || !(end == end) || !(ord == ord)) continue; // NaN guard
        // Normalize ordering and bounds
        if (end < start) std::swap(end, start);
        int order = (int) ord;
        items.emplace_back(start, end, order, oS, oE);
      }
      std::sort(items.begin(), items.end(), [](const auto& a, const auto& b){ return std::get<2>(a) < std::get<2>(b); });
      std::vector<Segment> segs;
      for (auto& it : items) {
        double s = std::min(std::get<0>(it), std::get<1>(it));
        double e = std::max(std::get<0>(it), std::get<1>(it));
        double origS = std::get<3>(it);
        double origE = std::get<4>(it);
        if (e > s) {
          Segment seg = {s, e, e - s, origS, origE};
          segs.push_back(seg);
        }
      }
      backend.updateEdl(std::move(segs));
      continue;
    }
    if (contains("\"type\":\"play\"")) { backend.play(); continue; }
    if (contains("\"type\":\"pause\"")) { backend.pause(); continue; }
    if (contains("\"type\":\"stop\"")) { backend.stop(); continue; }
    if (contains("\"type\":\"seek\"")) { try { backend.seek(std::stod(extract("timeSec"))); } catch (...) {} continue; }
    if (contains("\"type\":\"setRate\"")) { try { backend.setRate(std::stod(extract("rate"))); } catch (...) {} continue; }
    if (contains("\"type\":\"setVolume\"")) { try { backend.setVolume(std::stod(extract("value"))); } catch (...) {} continue; }
    if (contains("\"type\":\"queryState\"")) { backend.queryState(); continue; }
    // updateEdl ignored for now (full-file playback)
    // unrecognized
    emit("{\"type\":\"error\",\"message\":\"unknown command\"}");
#else
    handleLine(line);
#endif
  }

#ifndef USE_JUCE
  g.running = false;
  t.join();
#endif
  return 0;
}
