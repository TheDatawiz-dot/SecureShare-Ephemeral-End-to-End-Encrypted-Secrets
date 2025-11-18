# SecureShare-Ephemeral-End-to-End-Encrypted-Secrets
A full-stack web app for sharing secrets that self-destruct after one view. It uses end-to-end encryption, meaning the server never sees the plaintext data. The secret is encrypted in the browser via the Web Crypto API, and the decryption key is passed in the URL hash, making it a zero-knowledge service.
