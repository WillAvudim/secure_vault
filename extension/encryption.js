/*
  Implements browser-independent encryption and decryption.

  Additionally, compresses-decompresses the content before encryption to
  increase the entropy of the encrypted content.
*/

// Increases the cost of encryption and decryption.
const NUM_ITERATIONS = 1000;

// See https://github.com/digitalbazaar/forge
function EncryptImpl(content, password) {
    const salt = forge.random.getBytesSync(16);
    const key = forge.pkcs5.pbkdf2(password, salt, NUM_ITERATIONS, 32);
    const iv = forge.random.getBytesSync(32);

    const cipher = forge.cipher.createCipher('AES-CBC', key);
    cipher.start({iv: iv});

    input_buffer = forge.util.createBuffer(content, 'binary');
    cipher.update(input_buffer);
    cipher.finish();

    return JSON.stringify({
        "iv": forge.util.bytesToHex(iv),
        "salt": forge.util.bytesToHex(salt),
        "encrypted_content": cipher.output.toHex()
    });
}

// See https://github.com/digitalbazaar/forge
function DecryptImpl(string_with_encrypted_content, password) {
    const encrypted_content = JSON.parse(string_with_encrypted_content);
    const salt = forge.util.hexToBytes(encrypted_content.salt);
    const iv = forge.util.hexToBytes(encrypted_content.iv);

    const key = forge.pkcs5.pbkdf2(password, salt, NUM_ITERATIONS, 32);

    var decipher = forge.cipher.createDecipher('AES-CBC', key);
    decipher.start({iv: iv});

    input_buffer = forge.util.createBuffer(forge.util.hexToBytes(encrypted_content.encrypted_content), 'binary');
    decipher.update(input_buffer);
    decipher.finish();
    return decipher.output.getBytes();
}

// Takes the entered HTML fragment, compresses and encrypts it and returns as a string.
function Encrypt(content, password) {
  if (typeof(content) !== "string" || content.length < 1) {
    throw "content must be a non-empty string.";
  }
  if (typeof(password) !== "string" || password.length < 1) {
    throw "password must be a non-empty string.";
  }

  // http://pieroxy.net/blog/pages/lz-string/index.html
  const compressed_content = forge.util.encodeUtf8(LZString.compressToUTF16(content));

  const encrypted_content = EncryptImpl(compressed_content, password);
  return encrypted_content;
}

// Given the encrypted content, decrypts, uncompresses and displays it as an HTML fragment.
function Decrypt(encrypted_content, password) {
  if (typeof(encrypted_content) !== "string" || encrypted_content.length < 1) {
    throw "encrypted_content must be a non-empty string.";
  }
  if (typeof(password) !== "string" || password.length < 1) {
    throw "password must be a non-empty string.";
  }

  const unencrypted_content = DecryptImpl(encrypted_content, password);
  return uncompressed_content = LZString.decompressFromUTF16(
      forge.util.decodeUtf8(unencrypted_content));
}
