// JUCE audio engine backend with mock fallback.
// Build with -DUSE_JUCE=ON and set JUCE_DIR to compile real audio engine.

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstring>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

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
struct Segment { double start; double end; double dur; };

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
    // Debug logging for segment count verification (dev-only)
    if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
      if (strcmp(debug, "true") == 0) {
        std::cerr << "[JUCE] updateEdl received " << segments.size() << " segments" << std::endl;
      }
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
    double pos = transportSource.getCurrentPosition(); // original domain
    
    if (!segments.empty()) {
      // Robustly advance across any number of boundaries with loop protection
      int loopCount = 0;
      const int maxLoops = 10; // Prevent infinite loops
      
      while (loopCount < maxLoops) {
        loopCount++;
        int segIdx = segmentFor(pos);
        
        if (segIdx < 0) {
          // Position is not in any segment
          if (pos < segments.front().start) {
            // Before first segment - jump to first segment start
            double newPos = segments.front().start;
            transportSource.setPosition(newPos);
            pos = newPos;
            if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
              if (strcmp(debug, "true") == 0) {
                std::cerr << "[JUCE] Jumped to first segment at t=" << pos << std::endl;
              }
            }
            continue;
          } else {
            // After last segment - find which segment to jump to or end
            bool foundNext = false;
            for (size_t i = 0; i < segments.size(); ++i) {
              if (pos < segments[i].start) {
                // Found a segment that starts after our position
                double newPos = segments[i].start;
                transportSource.setPosition(newPos);
                pos = newPos;
                foundNext = true;
                if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
                  if (strcmp(debug, "true") == 0) {
                    std::cerr << "[JUCE] Jumped to segment " << i << " at t=" << pos << std::endl;
                  }
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
        if (pos >= s.end - 1e-6) {
          // At or past end of current segment
          if (segIdx + 1 < (int)segments.size()) {
            // Jump to next segment
            double newPos = segments[segIdx + 1].start;
            transportSource.setPosition(newPos);
            pos = newPos;
            if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
              if (strcmp(debug, "true") == 0) {
                std::cerr << "[JUCE] Jumped to next segment at t=" << pos << std::endl;
              }
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
      if (orig >= s.start && orig < s.end) return (int)i;
    }
    return -1;
  }
  double originalToEdited(double orig) const {
    if (segments.empty()) return orig;
    double acc = 0.0;
    for (const auto& s : segments) {
      if (orig < s.start) return acc;
      if (orig < s.end) return acc + (orig - s.start);
      acc += s.dur;
    }
    return acc;
  }
  double editedToOriginal(double ed) const {
    if (segments.empty()) return ed;
    double acc = 0.0;
    for (const auto& s : segments) {
      if (ed <= acc + s.dur) return s.start + (ed - acc);
      acc += s.dur;
    }
    return segments.empty() ? ed : segments.back().end;
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
      // Parse clips and build segments in 'order'
      std::vector<std::tuple<double,double,int>> items;
      size_t pscan = 0;
      while (true) {
        size_t ps = line.find("\"startSec\"", pscan);
        if (ps == std::string::npos) break;
        size_t cs = line.find(':', ps);
        size_t pe = line.find_first_of(",}\n", cs + 1);
        double start = 0.0; try { start = std::stod(line.substr(cs + 1, (pe == std::string::npos ? line.size() : pe) - (cs + 1))); } catch (...) {}
        size_t peKey = line.find("\"endSec\"", pe == std::string::npos ? cs : pe);
        if (peKey == std::string::npos) break;
        size_t ce = line.find(':', peKey);
        size_t pe2 = line.find_first_of(",}\n", ce + 1);
        double end = start; try { end = std::stod(line.substr(ce + 1, (pe2 == std::string::npos ? line.size() : pe2) - (ce + 1))); } catch (...) {}
        size_t poKey = line.find("\"order\"", pe2 == std::string::npos ? ce : pe2);
        if (poKey == std::string::npos) break;
        size_t co = line.find(':', poKey);
        size_t pe3 = line.find_first_of(",}\n", co + 1);
        int order = 0; try { order = std::stoi(line.substr(co + 1, (pe3 == std::string::npos ? line.size() : pe3) - (co + 1))); } catch (...) {}
        items.emplace_back(start, end, order);
        pscan = pe3 == std::string::npos ? line.size() : pe3;
      }
      std::sort(items.begin(), items.end(), [](const auto& a, const auto& b){ return std::get<2>(a) < std::get<2>(b); });
      std::vector<Segment> segs;
      for (auto& it : items) {
        double s = std::min(std::get<0>(it), std::get<1>(it));
        double e = std::max(std::get<0>(it), std::get<1>(it));
        if (e > s) segs.push_back({s, e, e - s});
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
