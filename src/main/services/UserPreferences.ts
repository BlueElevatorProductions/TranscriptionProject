import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

export interface ImportPreferences {
  defaultTranscriptionMethod: 'local' | 'cloud';
  defaultLocalModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  defaultCloudProvider: 'openai' | 'assemblyai' | 'revai';
  defaultAudioFormat: 'flac' | 'original' | 'always-convert';
  defaultSampleRate: 44100 | 48000 | 96000 | 192000;
  defaultBitDepth: 16 | 24 | 32;
  normalizeOnImport: boolean;
}

export const DEFAULT_PREFERENCES: ImportPreferences = {
  defaultTranscriptionMethod: 'cloud',
  defaultLocalModel: 'base',
  defaultCloudProvider: 'openai',
  defaultAudioFormat: 'flac',
  defaultSampleRate: 48000,
  defaultBitDepth: 24,
  normalizeOnImport: false
};

export class UserPreferencesService {
  private preferencesPath: string;
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
    this.preferencesPath = path.join(app.getPath('userData'), 'import-preferences.enc');
  }

  /**
   * Load user preferences from disk
   */
  async loadPreferences(): Promise<ImportPreferences> {
    try {
      console.log('Loading user preferences from:', this.preferencesPath);
      
      if (!fs.existsSync(this.preferencesPath)) {
        console.log('No preferences file found, using defaults');
        return { ...DEFAULT_PREFERENCES };
      }

      const encryptedData = await fs.promises.readFile(this.preferencesPath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const preferences = JSON.parse(decryptedData);

      // Merge with defaults to ensure all properties exist
      const mergedPreferences = {
        ...DEFAULT_PREFERENCES,
        ...preferences
      };

      console.log('Loaded user preferences:', mergedPreferences);
      return mergedPreferences;

    } catch (error) {
      console.error('Error loading preferences:', error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /**
   * Save user preferences to disk
   */
  async savePreferences(preferences: ImportPreferences): Promise<void> {
    try {
      console.log('Saving user preferences:', preferences);
      
      const jsonData = JSON.stringify(preferences, null, 2);
      const encryptedData = this.encrypt(jsonData);
      
      await fs.promises.writeFile(this.preferencesPath, encryptedData, 'utf8');
      console.log('Preferences saved successfully');

    } catch (error) {
      console.error('Error saving preferences:', error);
      throw new Error(`Failed to save preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(): Promise<ImportPreferences> {
    const defaults = { ...DEFAULT_PREFERENCES };
    await this.savePreferences(defaults);
    return defaults;
  }

  /**
   * Update specific preference fields
   */
  async updatePreferences(updates: Partial<ImportPreferences>): Promise<ImportPreferences> {
    const currentPreferences = await this.loadPreferences();
    const updatedPreferences = {
      ...currentPreferences,
      ...updates
    };
    
    await this.savePreferences(updatedPreferences);
    return updatedPreferences;
  }

  /**
   * Get transcription service name based on preferences
   */
  getTranscriptionService(preferences: ImportPreferences): string {
    if (preferences.defaultTranscriptionMethod === 'local') {
      return preferences.defaultLocalModel;
    } else {
      switch (preferences.defaultCloudProvider) {
        case 'openai': return 'cloud-openai';
        case 'assemblyai': return 'cloud-assemblyai';
        case 'revai': return 'cloud-revai';
        default: return 'cloud-openai';
      }
    }
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  private encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt preferences');
    }
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  private decrypt(encryptedData: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedData.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32);
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt preferences');
    }
  }
}

export default UserPreferencesService;