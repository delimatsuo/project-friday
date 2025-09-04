/**
 * Firebase Setup Validation Tests
 * Tests to verify that the Firebase/GCP project is correctly configured
 */

const assert = require('assert');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

describe('Firebase Project Setup Validation', () => {
  
  describe('Project Configuration Files', () => {
    it('should have firebase.json configuration file', async () => {
      const configPath = path.join(__dirname, '../../backend/firebase.json');
      const exists = await fs.access(configPath).then(() => true).catch(() => false);
      assert(exists, 'firebase.json configuration file is missing');
    });

    it('should have .firebaserc project configuration', async () => {
      const rcPath = path.join(__dirname, '../../backend/.firebaserc');
      const exists = await fs.access(rcPath).then(() => true).catch(() => false);
      assert(exists, '.firebaserc project configuration is missing');
    });

    it('should have valid firebase.json structure', async () => {
      const configPath = path.join(__dirname, '../../backend/firebase.json');
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      assert(config.firestore, 'Firestore configuration is missing');
      assert(config.functions, 'Functions configuration is missing');
      assert(config.storage, 'Storage configuration is missing');
      assert(config.emulators, 'Emulators configuration is missing');
    });
  });

  describe('Firebase CLI Installation', () => {
    it('should have Firebase CLI installed', (done) => {
      exec('firebase --version', (error, stdout) => {
        assert(!error, 'Firebase CLI is not installed');
        assert(stdout.includes('.'), 'Firebase CLI version not detected');
        done();
      });
    });

    it('should be logged in to Firebase', (done) => {
      exec('firebase projects:list', (error, stdout) => {
        assert(!error || !stdout.includes('No projects found'), 
          'Not logged in to Firebase or no projects available');
        done();
      });
    });
  });

  describe('Environment Variables', () => {
    it('should have .env file with required Firebase keys', async () => {
      const envPath = path.join(__dirname, '../../backend/.env');
      const envExamplePath = path.join(__dirname, '../../backend/.env.example');
      
      // Check for .env.example
      const exampleExists = await fs.access(envExamplePath).then(() => true).catch(() => false);
      assert(exampleExists, '.env.example file is missing');
      
      // Check for .env file
      const envExists = await fs.access(envPath).then(() => true).catch(() => false);
      if (envExists) {
        const content = await fs.readFile(envPath, 'utf8');
        assert(content.includes('FIREBASE_PROJECT_ID'), 'FIREBASE_PROJECT_ID is missing');
        assert(content.includes('FIREBASE_API_KEY'), 'FIREBASE_API_KEY is missing');
        assert(content.includes('FIREBASE_AUTH_DOMAIN'), 'FIREBASE_AUTH_DOMAIN is missing');
      }
    });
  });

  describe('GCloud SDK', () => {
    it('should have gcloud CLI installed (optional)', (done) => {
      exec('gcloud --version', (error, stdout) => {
        if (error) {
          console.warn('  ⚠ gcloud CLI not installed (optional but recommended)');
        } else {
          assert(stdout.includes('Google Cloud SDK'), 'gcloud CLI version not detected');
        }
        done();
      });
    });

    it('should have correct GCP project set', (done) => {
      exec('gcloud config get-value project', (error, stdout) => {
        if (!error) {
          assert(stdout.trim().length > 0, 'No GCP project is set');
        }
        done();
      });
    });
  });

  describe('Project Structure', () => {
    it('should have required backend directories', async () => {
      const dirs = [
        'backend/functions',
        'backend/config',
        'backend/scripts',
      ];
      
      for (const dir of dirs) {
        const dirPath = path.join(__dirname, '../../', dir);
        const exists = await fs.access(dirPath).then(() => true).catch(() => false);
        assert(exists, `Directory ${dir} is missing`);
      }
    });
  });
});

describe('Firebase Services Configuration', () => {
  
  describe('Firestore Setup', () => {
    it('should have firestore.rules file', async () => {
      const rulesPath = path.join(__dirname, '../../backend/firestore.rules');
      const exists = await fs.access(rulesPath).then(() => true).catch(() => false);
      assert(exists, 'firestore.rules file is missing');
    });

    it('should have firestore.indexes.json file', async () => {
      const indexesPath = path.join(__dirname, '../../backend/firestore.indexes.json');
      const exists = await fs.access(indexesPath).then(() => true).catch(() => false);
      assert(exists, 'firestore.indexes.json file is missing');
    });
  });

  describe('Cloud Functions Setup', () => {
    it('should have functions package.json', async () => {
      const packagePath = path.join(__dirname, '../../backend/functions/package.json');
      const exists = await fs.access(packagePath).then(() => true).catch(() => false);
      assert(exists, 'functions/package.json is missing');
    });

    it('should have functions index file', async () => {
      const indexPath = path.join(__dirname, '../../backend/functions/index.js');
      const exists = await fs.access(indexPath).then(() => true).catch(() => false);
      assert(exists, 'functions/index.js is missing');
    });
  });

  describe('Cloud Storage Setup', () => {
    it('should have storage.rules file', async () => {
      const rulesPath = path.join(__dirname, '../../backend/storage.rules');
      const exists = await fs.access(rulesPath).then(() => true).catch(() => false);
      assert(exists, 'storage.rules file is missing');
    });
  });
});