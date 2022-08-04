import {Serializer, toObjects, fromObjects} from "./asyncSerialize";
import {subtle} from "./compat";

declare const WebViewBridge: any;

export async function parse(text: string): Promise<any> {
  // need decodeURIComponent so binary strings are transfered properly
  const deocodedText = decodeURIComponent(text);
  const objects = JSON.parse(deocodedText);
  return await fromObjects(serializers(true), objects);
}
export async function stringify(value: any, waitForArrayBufferView = true): Promise<string> {
  const serialized = await toObjects(serializers(waitForArrayBufferView), value);
  // need encodeURIComponent so binary strings are transfered properly
  const message = JSON.stringify(serialized);
  return encodeURIComponent(message);
}


function serializers(waitForArrayBufferView: boolean) {
  return [
    ArrayBufferSerializer,
    ArrayBufferViewSerializer(waitForArrayBufferView),
    CryptoKeySerializer
  ];
}


const ArrayBufferSerializer: Serializer<ArrayBuffer, string> = {
  id: "ArrayBuffer",
  isType: (o: any) => o instanceof ArrayBuffer,

  // from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
  // modified to use Int8Array so that we can hold odd number of bytes
  toObject: async (ab: ArrayBuffer) => {
    const a = new Int8Array(ab)
    let i = 0;
    let str = '';
    while (i < a.length) {
      str += String.fromCharCode.apply(null, a.subarray(i, Math.min((i += 0x8000), a.length)));
    }
    return str;
  },
  fromObject: async (data: string) => {
    const buf = new ArrayBuffer(data.length);
    const bufView = new Int8Array(buf);
    for (let i = 0, strLen = data.length; i < strLen; i++) {
      bufView[i] = data.charCodeAt(i);
    }
    return buf;
  }
};

interface ArrayBufferViewSerialized {
  name: 'Int8Array' | 'Uint8Array' | 'Uint8ClampedArray' | 'Int16Array' | 'Uint16Array' | 'Int32Array' | 'Uint32Array' | 'Float32Array' | 'Float64Array' | 'DataView';
  buffer: ArrayBuffer;
}

export interface ArrayBufferViewWithPromise extends ArrayBufferView {
  _promise?: Promise<ArrayBufferView>;
}
function isArrayBufferViewWithPromise(obj: any): obj is ArrayBufferViewWithPromise {
    return obj.hasOwnProperty("_promise");
}

// Normally we could just do `abv.constructor.name`, but in
// JavaScriptCore, this wont work for some weird reason.
// list from https://developer.mozilla.org/en-US/docs/Web/API/ArrayBufferView
function arrayBufferViewName(abv: ArrayBufferView): ArrayBufferViewSerialized['name'] {
  if (abv instanceof Int8Array) {
    return "Int8Array";
  }
  if (abv instanceof Uint8Array) {
    return "Uint8Array";
  }
  if (abv instanceof Uint8ClampedArray) {
    return "Uint8ClampedArray";
  }
  if (abv instanceof Int16Array) {
    return "Int16Array";
  }
  if (abv instanceof Uint16Array) {
    return "Uint16Array";
  }
  if (abv instanceof Int32Array) {
    return "Int32Array";
  }
  if (abv instanceof Uint32Array) {
    return "Uint32Array";
  }
  if (abv instanceof Float32Array) {
    return "Float32Array";
  }
  if (abv instanceof Float64Array) {
    return "Float64Array";
  }
  if (abv instanceof DataView) {
    return "DataView";
  }
}

function ArrayBufferViewSerializer(waitForPromise: boolean): Serializer<ArrayBufferView, ArrayBufferViewSerialized> {
  return {
    id: "ArrayBufferView",
    isType: ArrayBuffer.isView,
    toObject: async (abv: ArrayBufferView) => {
      if (waitForPromise) {
        // wait for promise to resolve if the abv was returned from getRandomValues
        if (isArrayBufferViewWithPromise(abv)) {
          await abv._promise;
        }
      }
      return {
        name: arrayBufferViewName(abv),
        buffer: abv.buffer
      };
    },
    fromObject: async (abvs: ArrayBufferViewSerialized) => {
      switch (abvs.name) {
        case "Int8Array":
          return new Int8Array(abvs.buffer);
        case "Uint8Array":
          return new Uint8Array(abvs.buffer);
        case "Uint8ClampedArray":
          return new Uint8ClampedArray(abvs.buffer);
        case "Int16Array":
          return new Int16Array(abvs.buffer);
        case "Uint16Array":
          return new Uint16Array(abvs.buffer);
        case "Int32Array":
          return new Int32Array(abvs.buffer);
        case "Uint32Array":
          return new Uint32Array(abvs.buffer);
        case "Float32Array":
          return new Float32Array(abvs.buffer);
        case "Float64Array":
          return new Float64Array(abvs.buffer);
        case "DataView":
          return new DataView(abvs.buffer);
      }
    }
  };
}

interface CryptoKeyWithData extends CryptoKey {
  _import: {
    format: 'jwk'
    keyData: JsonWebKey
  } | {
    format: Exclude<KeyFormat, "jwk">,
    keyData: BufferSource,
  };
}

function hasData(ck: CryptoKeyWithData | CryptoKey): ck is CryptoKeyWithData {
  return (ck as CryptoKeyWithData)._import !== undefined;
}

interface CryptoKeySerialized extends CryptoKeyWithData {
  serialized: boolean;
}

const CryptoKeySerializer: Serializer<CryptoKeyWithData | CryptoKey, CryptoKeySerialized> = {
  id: "CryptoKey",
  isType: (o: any) => {
    const localStr = o.toLocaleString();
    // can't use CryptoKey or constructor on WebView iOS
    const isCryptoKey = localStr === "[object CryptoKey]" || localStr === "[object Key]";
    const isCryptoKeyWithData = o._import && !o.serialized;
    return isCryptoKey || isCryptoKeyWithData;
  },
  toObject: async (ck) => {
    // if we already have the import serialized, just return that
    if (hasData(ck)) {
      return {
        serialized: true,
        _import: ck._import,
        type: ck.type,
        extractable: ck.extractable,
        algorithm: ck.algorithm,
        usages: ck.usages
      };
    }
    const jwk = await subtle().exportKey("jwk", ck);
    return {
      _import: {
        format: "jwk",
        keyData: jwk
      },
      serialized: true,
      algorithm: ck.algorithm,
      extractable: ck.extractable,
      usages: ck.usages,
      type: ck.type
    };
  },
  fromObject: async (cks: CryptoKeySerialized) => {
    // if we don't have access to to a real crypto implementation, just return
    // the serialized crypto key
    if ((crypto as any).fake) {
      const newCks = {...cks} as CryptoKeySerialized;
      delete newCks.serialized;
      return newCks;
    }
    if (cks._import.format === "jwk") {
      return await subtle().importKey(cks._import.format, cks._import.keyData, cks.algorithm, cks.extractable, cks.usages);
    } else {
      return await subtle().importKey(cks._import.format, cks._import.keyData, cks.algorithm, cks.extractable, cks.usages);
    }
  }
};
