import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# In a real app, you would be more restrictive with CORS
CORS(app)

# IMPORTANT: This is an in-memory store.
# It will be reset if the server restarts.
# This is fine for a portfolio project, but a real app would use Redis.
secrets_store = {}

@app.route('/api/secret', methods=['POST'])
def store_secret():
    """
    Stores an encrypted blob of data and returns a unique ID.
    The server has no knowledge of the contents.
    """
    data = request.get_json()
    if not data or 'encrypted_data' not in data:
        return jsonify({"error": "encrypted_data is required"}), 400

    secret_id = str(uuid.uuid4())
    secrets_store[secret_id] = {'encrypted_data': data['encrypted_data']}

    return jsonify({"secret_id": secret_id}), 201


@app.route('/api/secret/<secret_id>', methods=['GET'])
def retrieve_secret(secret_id):
    """
    Retrieves the encrypted data for a given ID and immediately deletes it.
    This ensures the secret can only be viewed once.
    """
    secret = secrets_store.pop(secret_id, None)

    if secret:
        return jsonify(secret)
    else:
        return jsonify({"error": "Secret not found. It may have been viewed already."}), 404

if __name__ == '__main__':
    app.run(port=5000, debug=True)
