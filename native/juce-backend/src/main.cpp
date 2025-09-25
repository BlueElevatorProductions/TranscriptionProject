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

static void emitLoaded(double sampleRate = 48000.0, int channels = 2) {
  emit(std::string("{") +
       "\"type\":\"loaded\",\"id\":\"" + g.id + "\",\"durationSec\":" + std::to_string(g.durationSec) +
       ",\"sampleRate\":" + std::to_string((int)sampleRate) + ",\"channels\":" + std::to_string(channels) + "}");
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

// Individual word or spacer within a clip
struct Segment {
  std::string type;        // "word" or "spacer"
  double start;            // Start time
  double end;              // End time
  double dur;              // Duration
  std::string text;        // Text content (for words, empty for spacers)
  double originalStart = -1; // Original timing (if provided)
  double originalEnd = -1;   // Original timing (if provided)

  bool hasOriginal() const { return originalStart >= 0 && originalEnd >= 0; }
};

// Clip container holding segments (words and spacers)
struct Clip {
  std::string id;
  double startSec;         // Clip start in EDL timeline
  double endSec;           // Clip end in EDL timeline
  double originalStartSec = -1; // Original audio position
  double originalEndSec = -1;   // Original audio position
  std::string speaker;
  std::string type;        // "speech", etc.
  std::vector<Segment> segments; // Words and spacers within this clip

  double duration() const { return endSec - startSec; }
  bool hasOriginal() const { return originalStartSec >= 0 && originalEndSec >= 0; }
  size_t segmentCount() const { return segments.size(); }
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

    // Safety check and logging for dynamic sample rate
    if (sampleRate <= 0.0) {
      juceDLog("[JUCE] WARNING: Invalid sample rate in prepareToPlay: " + std::to_string(sampleRate));
      this->sampleRate = 48000.0; // Fallback to reasonable default
    } else {
      this->sampleRate = sampleRate;
    }

    juceDLog("[JUCE] EdlAudioSource prepared with sample rate: " + std::to_string(this->sampleRate));
  }
  
  void releaseResources() override {
    if (reader) reader->releaseResources();
  }
  
  void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override {
    bufferToFill.clearActiveBufferRegion();

    if (!reader || segments.empty()) return;

    // Safety check for sample rate before calculations
    if (sampleRate <= 0.0) {
      juceDLog("[JUCE] ERROR: Invalid sample rate in getNextAudioBlock: " + std::to_string(sampleRate));
      return;
    }
    
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

        // Advance edited position using duration ratio to handle gap-filled segments
        double originalTimeAdvanced = (double)samplesToRead / sampleRate;

        // Calculate the ratio between edited and original durations for this segment
        double editedDuration = segment.end - segment.start;
        double originalDuration = segment.hasOriginal() ?
          (segment.originalEnd - segment.originalStart) : segment.dur;

        // Handle potential division by zero
        if (originalDuration > 0.0) {
          double durationRatio = editedDuration / originalDuration;
          editedPosition += originalTimeAdvanced * durationRatio;

          // Log ratio-based advancement for debugging
          juceDLog("[JUCE] Position advanced: original=" + std::to_string(originalTimeAdvanced) +
                   "s, ratio=" + std::to_string(durationRatio) +
                   ", edited=" + std::to_string(originalTimeAdvanced * durationRatio) + "s");
        } else {
          // Fallback to original method if duration is invalid
          editedPosition += originalTimeAdvanced;
          juceDLog("[JUCE] Position advanced (fallback): " + std::to_string(originalTimeAdvanced) + "s");
        }
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
    if (sampleRate <= 0.0) return 0;
    return (int64_t)(editedPosition * sampleRate);
  }
  
  int64_t getTotalLength() const override {
    if (segments.empty() || sampleRate <= 0.0) return 0;
    return (int64_t)(segments.back().end * sampleRate);
  }
  
  bool isLooping() const override { return false; }

private:
  juce::AudioFormatReaderSource* reader;
  std::vector<Segment> segments;
  bool contiguousMode = false;
  size_t currentSegmentIndex = 0;
  double editedPosition = 0.0;
  double sampleRate = 48000.0; // Default fallback, set dynamically in prepareToPlay
};

class Backend : public juce::HighResolutionTimer {
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
  std::vector<Clip> clips;
  std::vector<Segment> segments; // Flattened segments for playback (legacy compatibility)
  bool isContiguousTimeline = false;
  bool contiguousInitialized = false;
  // Forward declaration for use in earlier methods
  void endPlayback();
  void handleStandardTimelinePlayback();
  void handleContiguousTimelinePlayback();
  void emitPositionContiguous();

  juce::AudioSource& transportOrResampler() {
    if (useResampler) return resampler; else return transportSource;
  }

  static void emitState() { ::emitState(); }
  static void emitLoaded(double sampleRate = 48000.0, int channels = 2) { ::emitLoaded(sampleRate, channels); }
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
      if (orig < os) return accEdited;
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
    const auto& last = segments.back();
    return last.hasOriginal() ? last.originalEnd : last.end;
  }

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

    juceDLog(std::string("[JUCE] load() called with path: ") + path);

    // Check if file exists first
    juce::File file{ juce::String(path) };
    if (!file.exists()) {
      juceDLog("[JUCE] load() failed: file does not exist");
      emit("{\"type\":\"error\",\"message\":\"Audio file not found\"}");
      return;
    }

    juceDLog("[JUCE] Attempting to create reader for file...");
    juce::AudioFormatReader* reader = formatManager.createReaderFor(file);
    if (reader == nullptr) {
      juceDLog("[JUCE] load() failed: could not create reader for file");
      juceDLog("[JUCE] File path: " + path);
      juceDLog("[JUCE] File size: " + std::to_string(file.getSize()));
      emit("{\"type\":\"error\",\"message\":\"Failed to open audio file\"}");
      return;
    }
    juceDLog("[JUCE] Reader created successfully");
    const double sr = reader->sampleRate;
    const double duration = (reader->lengthInSamples > 0 && sr > 0.0) ? (double) reader->lengthInSamples / sr : 0.0;
    juceDLog("[JUCE] Audio info: " + std::to_string(sr) + "Hz, " + std::to_string(duration) + "s");
    readerSource.reset(new juce::AudioFormatReaderSource(reader, true));
    transportSource.setSource(readerSource.get(), 0, nullptr, sr);
    juceDLog("[JUCE] Transport source configured successfully");
    g.durationSec = duration;
    // Default EDL: single full-file segment
    segments.clear();
    if (duration > 0.0) {
      Segment fullSegment;
      fullSegment.type = "speech";
      fullSegment.start = 0.0;
      fullSegment.end = duration;
      fullSegment.dur = duration;
      segments.push_back(fullSegment);
    }
    g.editedSec = 0.0;
    g.playing = false;
    emitLoaded(sr, reader->numChannels);
    emitState();
  }

  void play() {
    std::lock_guard<std::mutex> lock(mutex);
    juceDLog("[JUCE] play() called");

    if (!readerSource) {
      juceDLog("[JUCE] play() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.start();
    g.playing = true;
    emitState();
    if (!timerIsRunning) { startTimer(33); timerIsRunning = true; }
  }

  void pause() {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] pause() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.stop();
    g.playing = false;
    emitState();
  }

  void stop() {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] stop() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.stop();
    transportSource.setPosition(0.0);
    g.editedSec = 0.0;
    g.playing = false;
    emitState();
    emitPositionFromTransport();
  }

  void seek(double editedSec) {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] seek() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

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

  void updateEdl(std::vector<Clip> newClips) {
    std::lock_guard<std::mutex> lock(mutex);
    clips = std::move(newClips);

    // Count total segments across all clips
    size_t totalSegments = 0;
    for (const auto& clip : clips) {
      totalSegments += clip.segments.size();
    }

    // Enhanced debug logging - write to file to see what JUCE receives
    std::ofstream debugFile(juceDebugPath(), std::ios::app);
    debugFile << "[JUCE] updateEdl received " << clips.size() << " clips with "
              << totalSegments << " total segments at " << std::time(nullptr) << std::endl;
    // Log clip and segment details
    debugFile << "[JUCE] Clip details:" << std::endl;
    for (size_t c = 0; c < clips.size(); c++) {
      const auto& clip = clips[c];
      debugFile << "  [JUCE] Clip[" << c << "]: id=" << clip.id
                << ", " << clip.segments.size() << " segments ("
                << std::fixed << std::setprecision(2) << clip.duration() << "s)" << std::endl;

      // Log first few segments of each clip
      for (size_t s = 0; s < std::min(clip.segments.size(), size_t(5)); s++) {
        const auto& segment = clip.segments[s];
        debugFile << "    [JUCE] Segment[" << s << "]: "
                  << segment.type << " " << segment.start << "-" << segment.end << "s";
        if (segment.type == "word" && !segment.text.empty()) {
          debugFile << " \"" << segment.text << "\"";
        }
        debugFile << std::endl;
      }
      if (clip.segments.size() > 5) {
        debugFile << "    [JUCE] ... (" << (clip.segments.size() - 5) << " more segments)" << std::endl;
      }
    }
    debugFile.flush();

    // Detect contiguous timeline by checking if clips are perfectly aligned
    isContiguousTimeline = false;
    if (clips.size() > 1) {
      int consecutiveMatches = 0;
      for (size_t i = 1; i < clips.size() && i < 5; i++) {
        double gap = clips[i].startSec - clips[i-1].endSec;
        if (std::abs(gap) < 0.01) { // 10ms tolerance
          consecutiveMatches++;
        }
      }

      if (consecutiveMatches >= 2) {
        isContiguousTimeline = true;
        debugFile << "[JUCE] CONTIGUOUS TIMELINE DETECTED" << std::endl;
      } else {
        debugFile << "[JUCE] Standard timeline (gap matches: " << consecutiveMatches << ")" << std::endl;
      }
    }

    // Reset initialization for contiguous timeline
    if (isContiguousTimeline) {
      contiguousInitialized = false;
    }

    // Create flattened segments array for playback
    segments.clear();
    for (const auto& clip : clips) {
      for (const auto& seg : clip.segments) {
        // Convert clip-relative segment to absolute timeline segment
        Segment flatSeg;
        flatSeg.type = seg.type;
        flatSeg.start = clip.startSec + seg.start; // Convert to absolute time
        flatSeg.end = clip.startSec + seg.end;     // Convert to absolute time
        flatSeg.dur = seg.dur;
        flatSeg.text = seg.text;

        // Handle original timing if available
        if (seg.hasOriginal()) {
          flatSeg.originalStart = seg.originalStart;
          flatSeg.originalEnd = seg.originalEnd;
        } else if (clip.hasOriginal()) {
          // Calculate original times based on clip mapping
          double clipRelativePos = seg.start / clip.duration();
          double clipOriginalDur = clip.originalEndSec - clip.originalStartSec;
          flatSeg.originalStart = clip.originalStartSec + (clipRelativePos * clipOriginalDur);
          flatSeg.originalEnd = flatSeg.originalStart + seg.dur;
        } else {
          flatSeg.originalStart = flatSeg.start;
          flatSeg.originalEnd = flatSeg.end;
        }

        segments.push_back(flatSeg);
      }
    }

    debugFile << "[JUCE] Created " << segments.size() << " flattened segments for playback" << std::endl;

    // Safety check: Verify we have segments before enabling contiguous mode
    if (isContiguousTimeline && segments.empty()) {
      debugFile << "[JUCE] WARNING: Contiguous timeline detected but no segments received" << std::endl;
      debugFile << "[JUCE] Falling back to standard timeline mode" << std::endl;
      isContiguousTimeline = false;

      // Create a default full-file segment to prevent playback failure
      if (g.durationSec > 0) {
        Segment fullSegment;
        fullSegment.type = "speech";
        fullSegment.start = 0.0;
        fullSegment.end = g.durationSec;
        fullSegment.dur = g.durationSec;
        fullSegment.originalStart = 0.0;
        fullSegment.originalEnd = g.durationSec;
        segments.push_back(fullSegment);
        debugFile << "[JUCE] Created fallback full-file segment: 0.0-" << g.durationSec << "s" << std::endl;
      }
    }

    debugFile.flush();
  }

  void hiResTimerCallback() override {
    std::lock_guard<std::mutex> lock(mutex);
    if (!g.playing) return;
    
    // With edited/original mapping fixed, both modes operate correctly.
    // Prefer contiguous handler if detected, else standard.
    if (isContiguousTimeline) handleContiguousTimelinePlayback();
    else handleStandardTimelinePlayback();
  }
  
};

// ---- Out-of-class definitions for complex methods ----
void Backend::endPlayback() {
  transportSource.stop();
  g.playing = false;
  emit("{\"type\":\"ended\",\"id\":\"" + g.id + "\"}");
}

void Backend::handleStandardTimelinePlayback() {
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
    }
  } else if (pos >= g.durationSec) {
    endPlayback();
    return;
  }

  g.editedSec = originalToEdited(pos);
  emitPositionFromTransport();
}

void Backend::handleContiguousTimelinePlayback() {
  double pos = transportSource.getCurrentPosition(); // original audio time

  if (!contiguousInitialized && segments.size() > 0 && segments[0].hasOriginal()) {
    // Initialize to the current edited position's corresponding original time,
    // to respect any user seek that happened just before playback.
    const double targetOrig = editedToOriginal(g.editedSec.load());
    transportSource.setPosition(targetOrig);
    contiguousInitialized = true;

    std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
    debugFile << "[JUCE] CONTIGUOUS: Initialized at edited=" << g.editedSec.load() << " -> orig=" << targetOrig << std::endl;
    debugFile.flush();

    emitPositionFromTransport();
    return; // Avoid using stale 'pos' from before setPosition
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

void Backend::emitPositionContiguous() {
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

      // Helper functions for parsing JSON values
      auto extractNumber = [&](const std::string& s, const char* key) -> double {
        size_t p = s.find(key);
        if (p == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
        size_t c = s.find(':', p);
        if (c == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
        size_t e = s.find_first_of(",}\n", c + 1);
        std::string token = s.substr(c + 1, (e == std::string::npos ? s.size() : e) - (c + 1));
        try { return std::stod(token); } catch (...) { return std::numeric_limits<double>::quiet_NaN(); }
      };

      auto extractString = [&](const std::string& s, const char* key) -> std::string {
        size_t p = s.find(key);
        if (p == std::string::npos) return {};
        size_t c = s.find(':', p);
        if (c == std::string::npos) return {};
        size_t qs = s.find('"', c);
        if (qs == std::string::npos) return {};
        size_t qe = s.find('"', qs + 1);
        if (qe == std::string::npos) return {};
        return s.substr(qs + 1, qe - (qs + 1));
      };

      // Parse clips with segments
      std::vector<Clip> clips;
      for (const auto& clipJson : itemStrings) {
        Clip clip;
        clip.id = extractString(clipJson, "\"id\"");
        clip.startSec = extractNumber(clipJson, "\"startSec\"");
        clip.endSec = extractNumber(clipJson, "\"endSec\"");
        clip.originalStartSec = extractNumber(clipJson, "\"originalStartSec\"");
        clip.originalEndSec = extractNumber(clipJson, "\"originalEndSec\"");
        clip.speaker = extractString(clipJson, "\"speaker\"");
        clip.type = extractString(clipJson, "\"type\"");

        // Skip invalid clips
        if (!(clip.startSec == clip.startSec) || !(clip.endSec == clip.endSec)) continue;

        // Parse segments array within this clip
        size_t segStart = clipJson.find("\"segments\"");
        if (segStart != std::string::npos) {
          size_t segArrayStart = clipJson.find('[', segStart);
          if (segArrayStart != std::string::npos) {
            int depth = 1;
            size_t i = segArrayStart + 1;
            while (i < clipJson.size() && depth > 0) {
              if (clipJson[i] == '[') depth++;
              else if (clipJson[i] == ']') depth--;
              i++;
            }

            if (depth == 0) {
              std::string segArrayContent = clipJson.substr(segArrayStart + 1, i - segArrayStart - 2);

              // Parse individual segment objects
              size_t segPos = 0;
              while (segPos < segArrayContent.size()) {
                while (segPos < segArrayContent.size() &&
                       (segArrayContent[segPos] == ' ' || segArrayContent[segPos] == ',' ||
                        segArrayContent[segPos] == '\n' || segArrayContent[segPos] == '\r' ||
                        segArrayContent[segPos] == '\t')) segPos++;
                if (segPos >= segArrayContent.size()) break;
                if (segArrayContent[segPos] != '{') { segPos++; continue; }

                int segDepth = 1;
                size_t segObjStart = segPos;
                segPos++;
                while (segPos < segArrayContent.size() && segDepth > 0) {
                  if (segArrayContent[segPos] == '{') segDepth++;
                  else if (segArrayContent[segPos] == '}') segDepth--;
                  segPos++;
                }

                std::string segJson = segArrayContent.substr(segObjStart, segPos - segObjStart);

                // Parse segment
                Segment segment;
                segment.type = extractString(segJson, "\"type\"");
                segment.start = extractNumber(segJson, "\"startSec\"");
                segment.end = extractNumber(segJson, "\"endSec\"");
                segment.dur = segment.end - segment.start;
                segment.text = extractString(segJson, "\"text\"");
                segment.originalStart = extractNumber(segJson, "\"originalStartSec\"");
                segment.originalEnd = extractNumber(segJson, "\"originalEndSec\"");

                // Add valid segments
                if (segment.start == segment.start && segment.end == segment.end &&
                    segment.end > segment.start) {
                  clip.segments.push_back(segment);
                }
              }
            }
          }
        }

        // Add clip if it has valid duration
        if (clip.endSec > clip.startSec) {
          clips.push_back(clip);
        }
      }

      // Pass clips to backend
      backend.updateEdl(std::move(clips));
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
