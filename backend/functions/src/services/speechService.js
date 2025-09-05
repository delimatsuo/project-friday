const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const { PassThrough } = require('stream');

class SpeechService {
  constructor() {
    this.sttClient = new speech.SpeechClient();
    this.ttsClient = new textToSpeech.TextToSpeechClient();
    this.recognizeStream = null;
    this.isRecognizing = false;
  }

  /**
   * Initialize Speech-to-Text streaming recognition
   * @param {Object} config - Configuration for STT
   * @returns {Stream} Recognition stream
   */
  initializeSpeechToText(config = {}) {
    const request = {
      config: {
        encoding: config.encoding || 'MULAW',
        sampleRateHertz: config.sampleRateHertz || 8000,
        languageCode: config.languageCode || 'en-US',
        model: 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        metadata: {
          interactionType: 'PHONE_CALL',
          industryNaicsCodeOfAudio: 517311, // Telecommunications
          microphoneDistance: 'NEARFIELD',
          originalMediaType: 'AUDIO',
          recordingDeviceType: 'PHONE_LINE',
        },
      },
      interimResults: true,
      singleUtterance: false,
    };

    this.recognizeStream = this.sttClient
      .streamingRecognize(request)
      .on('error', (error) => {
        console.error('Speech-to-Text error:', error);
        this.isRecognizing = false;
      })
      .on('data', (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;
          
          this.onTranscript({
            transcript,
            isFinal,
            confidence: data.results[0].alternatives[0].confidence || 0,
          });
        }
      });

    this.isRecognizing = true;
    return this.recognizeStream;
  }

  /**
   * Process audio chunk for Speech-to-Text
   * @param {Buffer} audioChunk - Audio data to process
   */
  processAudioChunk(audioChunk) {
    if (this.isRecognizing && this.recognizeStream) {
      this.recognizeStream.write(audioChunk);
    }
  }

  /**
   * Stop Speech-to-Text streaming
   */
  stopSpeechToText() {
    if (this.recognizeStream) {
      this.isRecognizing = false;
      this.recognizeStream.end();
      this.recognizeStream = null;
    }
  }

  /**
   * Convert text to speech using Google TTS
   * @param {string} text - Text to convert
   * @param {Object} options - TTS options
   * @returns {Promise<Buffer>} Audio data in specified format
   */
  async textToSpeech(text, options = {}) {
    const request = {
      input: { text },
      voice: {
        languageCode: options.languageCode || 'en-US',
        ssmlGender: options.gender || 'FEMALE',
        name: options.voiceName || 'en-US-Neural2-F',
      },
      audioConfig: {
        audioEncoding: options.audioEncoding || 'MULAW',
        sampleRateHertz: options.sampleRateHertz || 8000,
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0.0,
        volumeGainDb: options.volumeGainDb || 0.0,
      },
    };

    try {
      const [response] = await this.ttsClient.synthesizeSpeech(request);
      return response.audioContent;
    } catch (error) {
      console.error('Text-to-Speech error:', error);
      throw error;
    }
  }

  /**
   * Callback for transcript events - override this method
   * @param {Object} transcriptData - Transcript information
   */
  onTranscript(transcriptData) {
    // Override this method in implementation
    console.log('Transcript:', transcriptData);
  }

  /**
   * Convert base64 audio to buffer
   * @param {string} base64Audio - Base64 encoded audio
   * @returns {Buffer} Audio buffer
   */
  base64ToBuffer(base64Audio) {
    return Buffer.from(base64Audio, 'base64');
  }

  /**
   * Convert buffer to base64
   * @param {Buffer} buffer - Audio buffer
   * @returns {string} Base64 encoded audio
   */
  bufferToBase64(buffer) {
    return buffer.toString('base64');
  }
}

module.exports = SpeechService;