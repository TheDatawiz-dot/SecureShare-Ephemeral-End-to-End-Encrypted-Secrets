// --- Helper functions for ArrayBuffer <-> Base64 conversion ---
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a plaintext string using a randomly generated AES-GCM key.
 * @param {string} plaintext - The text to encrypt.
 * @returns {Promise<{encryptedData: string, keyB64: string}>} - The encrypted data and the key, both as Base64 strings.
 */
export async function encryptSecret(plaintext) {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // Can be exported
    ['encrypt', 'decrypt']
  );

  const encodedText = new TextEncoder().encode(plaintext);

  // The IV is a random nonce. It doesn't need to be secret.
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedText
  );

  // Combine IV and encrypted data for easier storage/retrieval
  const encryptedDataWithIv = new Uint8Array([...iv, ...new Uint8Array(encryptedBuffer)]);

  // Export the key to share it in the URL
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  
  return {
    encryptedData: arrayBufferToBase64(encryptedDataWithIv.buffer),
    keyB64: arrayBufferToBase64(exportedKey)
  };
}


/**
 * Decrypts AES-GCM encrypted ciphertext using a key.
 * @param {string} encryptedDataB64 - The Base64 encoded IV + ciphertext.
 * @param {string} keyB64 - The Base64 encoded decryption key.
 * @returns {Promise<string>} - The decrypted plaintext.
 */
export async function decryptSecret(encryptedDataB64, keyB64) {
  const key = await window.crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(keyB64),
    { name: 'AES-GCM' },
    true,
    ['decrypt']
  );
  
  const encryptedDataWithIv = base64ToArrayBuffer(encryptedDataB64);

  // Extract the IV (first 12 bytes)
  const iv = encryptedDataWithIv.slice(0, 12);
  const encryptedData = encryptedDataWithIv.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );

  return new TextDecoder().decode(decryptedBuffer);
}```

#### `frontend/src/App.js`

This component manages the UI logic for both the sender and the receiver.

```javascript
import React, { useState, useEffect } from 'react';
import { encryptSecret, decryptSecret } from './crypto';
import './App.css';

function App() {
  const [secret, setSecret] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [viewedSecret, setViewedSecret] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // This effect runs once on component mount to check if we are viewing a secret
  useEffect(() => {
    const processUrl = async () => {
      const path = window.location.pathname;
      const key = window.location.hash.substring(1); // Get key from URL hash

      if (path.startsWith('/secret/')) {
        const secretId = path.split('/')[2];
        if (secretId && key) {
          setIsLoading(true);
          try {
            const response = await fetch(`http://127.0.0.1:5000/api/secret/${secretId}`);
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Failed to retrieve secret.');
            }
            const data = await response.json();
            const decrypted = await decryptSecret(data.encrypted_data, key);
            setViewedSecret(decrypted);
          } catch (err) {
            setError(err.message);
          } finally {
            setIsLoading(false);
          }
        }
      }
    };
    processUrl();
  }, []);

  const handleCreateSecret = async () => {
    if (!secret.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      const { encryptedData, keyB64 } = await encryptSecret(secret);
      
      const response = await fetch('http://127.0.0.1:5000/api/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_data: encryptedData })
      });

      if (!response.ok) {
        throw new Error('Failed to store secret on the server.');
      }
      
      const data = await response.json();
      const link = `${window.location.origin}/secret/${data.secret_id}#${keyB64}`;
      setGeneratedLink(link);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render different views based on state
  if (viewedSecret || error || window.location.pathname !== '/') {
     return (
        <div className="container">
          <header><h1>SecureShare</h1></header>
          <div className="result-view">
            {isLoading && <p>Loading and decrypting secret...</p>}
            {error && <div className="error-box"><p>Error:</p> {error}</div>}
            {viewedSecret && (
              <div className="secret-box">
                <p>This secret has been revealed and permanently deleted.</p>
                <textarea readOnly value={viewedSecret} rows="5"></textarea>
              </div>
            )}
          </div>
        </div>
     );
  }

  return (
    <div className="container">
      <header>
        <h1>SecureShare</h1>
        <p>Share a secret that self-destructs after one view.</p>
      </header>

      {generatedLink ? (
        <div className="result-view">
          <h3>Your one-time secret link:</h3>
          <p>This link will only work once. Copy it and share it.</p>
          <div className="link-box">
            <input type="text" readOnly value={generatedLink} />
            <button onClick={() => navigator.clipboard.writeText(generatedLink)}>Copy</button>
          </div>
          <button className="create-new-btn" onClick={() => { setGeneratedLink(''); setSecret(''); }}>
            Create another secret
          </button>
        </div>
      ) : (
        <div className="create-view">
          <textarea
            rows="5"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter your secret here..."
          ></textarea>
          <button onClick={handleCreateSecret} disabled={isLoading}>
            {isLoading ? 'Encrypting...' : 'Create One-Time Link'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;```

#### `frontend/src/App.css`
A clean stylesheet to make the UI usable.

```css
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f0f2f5;
    color: #1c1e21;
    display: flex;
    justify-content: center;
    padding-top: 50px;
}

.container {
    width: 100%;
    max-width: 550px;
    text-align: center;
    background-color: #ffffff;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

header h1 {
    font-size: 2rem;
    color: #0d1117;
}

header p {
    color: #6c757d;
    margin-bottom: 2rem;
}

textarea {
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #ced4da;
    font-size: 1rem;
    margin-bottom: 1rem;
    box-sizing: border-box; /* Important for padding */
}

button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 12px 20px;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
}

button:hover {
    background-color: #0056b3;
}

.link-box {
    display: flex;
    margin: 1rem 0;
}

.link-box input {
    flex-grow: 1;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 8px 0 0 8px;
    font-family: 'Courier New', monospace;
    color: #495057;
}

.link-box button {
    border-radius: 0 8px 8px 0;
}

.create-new-btn {
    margin-top: 1rem;
    background-color: #6c757d;
}

.create-new-btn:hover {
    background-color: #5a6268;
}

.secret-box {
    text-align: left;
    background-color: #fffbe6;
    border: 1px solid #ffe58f;
    border-radius: 8px;
    padding: 20px;
}

.error-box {
    text-align: left;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
    border-radius: 8px;
    padding: 20px;
}
