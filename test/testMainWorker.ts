import test = require("tape");
import crypto from "./mockCrypto";

declare const TextEncoder: any;
test("Methods exist", function (t) {
  t.equal(typeof crypto.getRandomValues, "function");
  t.equal(typeof crypto.subtle.encrypt, "function");
  t.end();
});

test("getRandomValues returns the original array", function (t) {
  const array = new Uint8Array(16);
  t.equal(crypto.getRandomValues(array), array);
  t.end();
});

function sleep() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 100);
  });
}

test("getRandomValues eventually updates the array", async function (t) {
  const array = new Uint8Array(16);
  t.equal(array[0], 0);
  const updatedArray = crypto.getRandomValues(array);
  await sleep();
  t.notEqual(array[0], 0);
  t.end();
});

test("getRandomValues can re updated", async function (t) {
  const updatedArray = crypto.getRandomValues(new Uint8Array(16));
  await sleep();
  const origFirst = updatedArray[0];

  crypto.getRandomValues(updatedArray);
  await sleep();
  t.notEqual(updatedArray[0], origFirst);
  t.end();
});


for (const hash of [
    "SHA-1",
    // "SHA-256" broken on webkit
  ]) {
  const RSA_OAEP = ({
    name: "RSA-OAEP",
    modulusLength: 2048, // can be 1024, 2048, or 4096
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: {name: hash}, // can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
  } as Algorithm);

  // below copied from https://github.com/diafygi/webcrypto-examples

  test(`RSA-OAEP ${hash} - generateKey`, async (t) => {
    const key = await crypto.subtle.generateKey(
      RSA_OAEP,
      true, //  whether the key is extractable (i.e. can be used in exportKey)
      ["encrypt", "decrypt"] //  can be any combination of "sign" and "verify"
    );
    t.true(key);
    t.true('publicKey' in key && key.publicKey);
    t.true('privateKey' in key && key.privateKey);
    t.end();
  });

  test(`RSA-OAEP ${hash} - exportKey`, async (t) => {
    const key = await crypto.subtle.generateKey(
      RSA_OAEP,
      true, //  whether the key is extractable (i.e. can be used in exportKey)
      ["encrypt", "decrypt"] //  can be any combination of "sign" and "verify"
    );
    if (!('publicKey' in key)) throw new Error("no public key");
    const keydata = await crypto.subtle.exportKey(
      "jwk", // can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
      key.publicKey // can be a publicKey or privateKey, as long as extractable was true
    );
    t.true(keydata);
    t.end();
  });

  test(`RSA-OAEP ${hash} - encrypt`, async (t) => {
      const key = await crypto.subtle.generateKey(
      RSA_OAEP,
      true, //  whether the key is extractable (i.e. can be used in exportKey)
      ["encrypt", "decrypt"] //  can be any combination of "sign" and "verify"
    );
    if (!('publicKey' in key)) throw new Error("no public key");
    const encrypted = await crypto.subtle.encrypt(
      RSA_OAEP,
      key.publicKey, // from generateKey or importKey above
      ((new Uint8Array(16)).buffer as any) // ArrayBuffer of data you want to sign
    );
    t.true(new Uint8Array(encrypted));
    t.end();
  });

  test(`RSA-OAEP ${hash} - decrypt`, async (t) => {
    const key = await crypto.subtle.generateKey(
      RSA_OAEP,
      true, //  whether the key is extractable (i.e. can be used in exportKey)
      ["encrypt", "decrypt"] //  can be any combination of "sign" and "verify"
    );
    if (!('publicKey' in key)) throw new Error("no public key");
    const encrypted = await crypto.subtle.encrypt(
      RSA_OAEP,
      key.publicKey, // from generateKey or importKey above
      ((new Uint8Array(16)).buffer as any) // ArrayBuffer of data you want to sign
    );
    const decrypted = await crypto.subtle.decrypt(
      RSA_OAEP,
      key.privateKey, // from generateKey or importKey above
      encrypted // ArrayBuffer of data you want to sign
    );
    t.true(new Uint8Array(decrypted));
    t.end();
  });
}

test("example from https://blog.engelke.com/2014/06/22/symmetric-cryptography-in-the-browser-part-1/ should work", async (t) => {
  const aesKey = await crypto.subtle.generateKey(
      ({name: "AES-CBC", length: 128} as Algorithm), // Algorithm the key will be used with
      true,                           // Can extract key value to binary string
      ["encrypt", "decrypt"]          // Use for these operations
  );
  if (!('algorithm' in aesKey)) throw new Error("no algorithm");
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const plainTextString = "This is very sensitive stuff.";

  const plainTextBytes = new Uint8Array(plainTextString.length);
  for (let i = 0; i < plainTextString.length; i++) {
      plainTextBytes[i] = plainTextString.charCodeAt(i);
  }

  const cipherTextBytes = await crypto.subtle.encrypt(
      ({name: "AES-CBC", iv: iv} as Algorithm), // Random data for security
      aesKey,                    // The key to use
      plainTextBytes             // Data to encrypt
  );

  const decryptedBytes = new Uint8Array(
      await crypto.subtle.decrypt(
        ({name: "AES-CBC", iv: iv} as Algorithm), // Same IV as for encryption
        aesKey,                    // The key to use
        cipherTextBytes            // Data to decrypt
    )
  );

  let decryptedString = "";
  for (let i = 0; i < decryptedBytes.byteLength; i++) {
      decryptedString += String.fromCharCode(decryptedBytes[i]);
  }
  t.equal(decryptedString, "This is very sensitive stuff.");
  t.end();
});


// from https://blog.engelke.com/2014/06/22/symmetric-cryptography-in-the-browser-part-1/
test("symmetric encryption should work", async (t) => {
  const aesKey = await crypto.subtle.generateKey(
      ({name: "AES-CBC", length: 128} as Algorithm), // Algorithm the key will be used with
      true,                           // Can extract key value to binary string
      ["encrypt", "decrypt"]          // Use for these operations
  );
  if (!('algorithm' in aesKey)) throw new Error("no algorithm");
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const plainTextString = "This is very sensitive stuff.";

  const plainTextBytes = new Uint8Array(plainTextString.length);
  for (let i = 0; i < plainTextString.length; i++) {
      plainTextBytes[i] = plainTextString.charCodeAt(i);
  }

  const cipherTextBytes = await crypto.subtle.encrypt(
      ({name: "AES-CBC", iv: iv} as Algorithm), // Random data for security
      aesKey,                    // The key to use
      plainTextBytes             // Data to encrypt
  );

  const decryptedBytes = new Uint8Array(
      await crypto.subtle.decrypt(
        ({name: "AES-CBC", iv: iv} as Algorithm), // Same IV as for encryption
        aesKey,                    // The key to use
        cipherTextBytes            // Data to decrypt
    )
  );

  let decryptedString = "";
  for (let i = 0; i < decryptedBytes.byteLength; i++) {
      decryptedString += String.fromCharCode(decryptedBytes[i]);
  }
  t.equal(decryptedString, "This is very sensitive stuff.");
  t.end();
});


// from https://blog.engelke.com/2015/02/14/deriving-keys-from-passwords-with-webcrypto/
function arrayBufferToHexString(arrayBuffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(arrayBuffer);
  let hexString = "";
  let nextHexByte;

  for (let i=0; i<byteArray.byteLength; i++) {
      nextHexByte = byteArray[i].toString(16);
      if (nextHexByte.length < 2) {
          nextHexByte = "0" + nextHexByte;
      }
      hexString += nextHexByte;
  }
  return hexString;
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  var encoder = new TextEncoder("utf-8");
  return encoder.encode(str);
  // http://stackoverflow.com/a/11058858/907060
  // const buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  // const bufView = new Uint16Array(buf);
  // for (let i=0, strLen=str.length; i<strLen; i++) {
  //   bufView[i] = str.charCodeAt(i);
  // }
  // return buf;
}

test("deriving keys should work", async (t) => {
  const saltString = "Pick anything you want. This isn't secret.";
  const iterations = 1000;
  const hash = "SHA-256";
  const password = "My secret!"

  let baseKey: CryptoKey;
  try {
    baseKey = await crypto.subtle.importKey(
      "raw",
      stringToArrayBuffer(password),
      {"name": "PBKDF2"},
      false,
      ["deriveKey"]
    )
  } catch(e) {
    t.end();
    return;
  }

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      "name": "PBKDF2",
      "salt": stringToArrayBuffer(saltString),
      "iterations": iterations,
      "hash": hash
    },
    baseKey,
    {"name": "AES-CBC", "length": 128}, // Key we want
    true,                               // Extrable
    ["encrypt", "decrypt"]              // For new key
  );
  const keyBytes = await window.crypto.subtle.exportKey("raw", aesKey);
  const hexKey = arrayBufferToHexString(keyBytes);
  t.equal(hexKey, "ed4b134e89eff7e9366af4abd5c6fb38");
  t.end();
})
