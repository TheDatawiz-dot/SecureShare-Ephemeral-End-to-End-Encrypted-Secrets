# SecureShare: Ephemeral End-to-End Encrypted Secrets

SecureShare is a full-stack web application for sharing secrets that self-destruct after a single view. This project demonstrates a strong focus on security, utilizing **client-side end-to-end encryption** to ensure the server is a zero-knowledge host.

## Core Security Features

*   **End-to-End Encryption:** Secrets are encrypted in the user's browser using the standard **Web Crypto API (AES-GCM)** before being transmitted.
*   **Zero-Knowledge Server:** The backend only ever stores an encrypted blob of data. It has no way of reading the original secret.
*   **Ephemeral By Design:** The encrypted secret is permanently deleted from the server immediately after it is requested once.
*   **Secure Key Exchange:** The decryption key is never sent to the server. It is passed from sender to receiver in the **URL hash (`#`)**, a part of the URL that browsers do not include in network requests.

## How It Works

1.  **Encryption:** When a user creates a secret, the React frontend generates a random encryption key, encrypts the secret, and sends only the encrypted ciphertext to the backend.
2.  **Storage:** The Python/Flask server stores the ciphertext against a unique ID and returns the ID. The server never sees the decryption key.
3.  **Link Generation:** The frontend constructs a one-time link containing the secret's ID in the path and the secret's decryption key in the URL hash (`.../secret/<id>#<key>`).
4.  **Decryption:** When the recipient opens the link, the browser requests the encrypted data from the server using the ID. The server delivers the data and immediately deletes it. The React app then reads the decryption key from the URL hash, decrypts the data client-side, and displays the plaintext secret.

## Technology Stack

*   **Frontend:** React, Web Crypto API
*   **Backend:** Python, Flask
*   **Principles:** End-to-End Encryption (E2EE), REST API Design

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
# Server runs on http://127.0.0.1:5000
