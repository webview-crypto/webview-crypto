import { Serializer, toObjects, fromObjects } from "./asyncSerialize";
import { subtle } from "./compat";

declare const WebViewBridge: any;

export async function parse(text: string): Promise<any> {
  // need decodeURIComponent so binary strings are transfered properly
  const decodedText = decodeURIComponent(text);
  const objects = JSON.parse(decodedText);
  return await fromObjects(serializers(true), objects);
}
export async function stringify(
  value: any,
  waitForArrayBufferView = true
): Promise<string> {
  const serialized = await toObjects(
    serializers(waitForArrayBufferView),
    value
  );
  // need encodeURIComponent so binary strings are transfered properly
  const message = JSON.stringify(serialized);
  return encodeURIComponent(message);
}

function serializers(waitForArrayBufferView: boolean) {
  return [
    ArrayBufferSerializer,
    ArrayBufferViewSerializer(waitForArrayBufferView),
    CryptoKeySerializer,
  ];
}

const MAX_BUFFER_LENGTH = 64 * 1024;

const ArrayBufferSerializer: Serializer<ArrayBuffer, string> = {
  id: "ArrayBuffer",
  isType: (o: unknown): o is ArrayBuffer => o instanceof ArrayBuffer,

  // from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
  // modified to use Int8Array so that we can hold odd number of bytes
  toObject: async (ab: ArrayBuffer) => {
    const bytes = new Int8Array(ab);
    if (bytes.length <= MAX_BUFFER_LENGTH) {
      return String.fromCharCode.apply(null, bytes);
    }
    let str = "";
    // Fixes Maximum call stack size exceeded error which triggers when passing large buffers.
    for (let i = 0; i < bytes.length; i += MAX_BUFFER_LENGTH) {
      str += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + MAX_BUFFER_LENGTH)
      );
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
  },
};

interface ArrayBufferViewSerialized {
  name:
    | "Int8Array"
    | "Uint8Array"
    | "Uint8ClampedArray"
    | "Int16Array"
    | "Uint16Array"
    | "Int32Array"
    | "Uint32Array"
    | "Float32Array"
    | "Float64Array"
    | "DataView";
  buffer: ArrayBuffer;
}

const typedArrayEntries: Array<
  [ArrayBufferViewSerialized["name"], new (buffer: ArrayBuffer) => ArrayBufferView]
> = [
  ["Int8Array", Int8Array],
  ["Uint8Array", Uint8Array],
  ["Uint8ClampedArray", Uint8ClampedArray],
  ["Int16Array", Int16Array],
  ["Uint16Array", Uint16Array],
  ["Int32Array", Int32Array],
  ["Uint32Array", Uint32Array],
  ["Float32Array", Float32Array],
  ["Float64Array", Float64Array],
  ["DataView", DataView],
];

const arrayBufferViewNameMap = new Map<
  new (buffer: ArrayBuffer) => ArrayBufferView,
  ArrayBufferViewSerialized["name"]
>(
  typedArrayEntries.map(([name, ctor]) => [ctor, name])
);

const arrayBufferViewConstructors = typedArrayEntries.reduce(
  (acc, [name, ctor]) => {
    acc[name] = ctor;
    return acc;
  },
  {} as Record<ArrayBufferViewSerialized["name"], new (buffer: ArrayBuffer) => ArrayBufferView>
);

export interface ArrayBufferViewWithPromise extends ArrayBufferView {
  _promise?: Promise<ArrayBufferView>;
}
function isArrayBufferViewWithPromise(
  obj: any
): obj is ArrayBufferViewWithPromise {
  return (
    typeof obj === "object" &&
    obj !== null &&
    Object.prototype.hasOwnProperty.call(obj, "_promise")
  );
}

// Normally we could just do `abv.constructor.name`, but in
// JavaScriptCore, this wont work for some weird reason.
// list from https://developer.mozilla.org/en-US/docs/Web/API/ArrayBufferView
function arrayBufferViewName(
  abv: ArrayBufferView
): ArrayBufferViewSerialized["name"] {
  interface ArrayBufferViewConstructor {
    new (buffer: ArrayBuffer, byteOffset?: number, length?: number): ArrayBufferView;
  }

  const constructor = abv.constructor as ArrayBufferViewConstructor;
  const name = arrayBufferViewNameMap.get(constructor);
  if (!name) {
    throw new Error(`Unknown ArrayBufferView: ${abv.constructor?.name}`);
  }
  return name;
}

function ArrayBufferViewSerializer(
  waitForPromise: boolean
): Serializer<ArrayBufferView, ArrayBufferViewSerialized> {
  return {
    id: "ArrayBufferView",
    isType: (o: unknown): o is ArrayBufferView => ArrayBuffer.isView(o as any),
    toObject: async (abv: ArrayBufferView) => {
      if (waitForPromise) {
        // wait for promise to resolve if the abv was returned from getRandomValues
        if (isArrayBufferViewWithPromise(abv)) {
          await abv._promise;
        }
      }
      return {
        name: arrayBufferViewName(abv),
        buffer: abv.buffer,
      };
    },
    fromObject: async (abvs: ArrayBufferViewSerialized) => {
      const Constructor = arrayBufferViewConstructors[abvs.name];
      if (!Constructor) {
        throw new Error(`Unsupported ArrayBufferView type: ${abvs.name}`);
      }
      return new Constructor(abvs.buffer);
    },
  };
}

interface CryptoKeyWithData extends CryptoKey {
  _import:
    | {
        format: "jwk";
        keyData: JsonWebKey;
      }
    | {
        format: Exclude<KeyFormat, "jwk">;
        keyData: BufferSource;
      };
}

function hasData(ck: CryptoKeyWithData | CryptoKey): ck is CryptoKeyWithData {
  return (ck as CryptoKeyWithData)._import !== undefined;
}

interface CryptoKeySerialized extends CryptoKeyWithData {
  serialized: boolean;
}

const CryptoKeySerializer: Serializer<
  CryptoKeyWithData | CryptoKey,
  CryptoKeySerialized
> = {
  id: "CryptoKey",
  isType: (o: unknown): o is CryptoKeyWithData | CryptoKey => {
    if (o === null || typeof o !== "object") {
      return false;
    }

    const localStr = (o as any).toLocaleString?.();
    if (typeof localStr !== "string") {
      return false;
    }
    // can't use CryptoKey or constructor on WebView iOS
    const isCryptoKey =
      localStr === "[object CryptoKey]" || localStr === "[object Key]";
    const isCryptoKeyWithData = (o as any)._import && !(o as any).serialized;
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
        usages: ck.usages,
      };
    }
    const jwk = await subtle().exportKey("jwk", ck);
    return {
      _import: {
        format: "jwk",
        keyData: jwk,
      },
      serialized: true,
      algorithm: ck.algorithm,
      extractable: ck.extractable,
      usages: ck.usages,
      type: ck.type,
    };
  },
  fromObject: async (cks: CryptoKeySerialized) => {
    // if we don't have access to to a real crypto implementation, just return
    // the serialized crypto key
    if ((crypto as any).fake) {
      const newCks = { ...cks } as CryptoKeySerialized;
      delete newCks.serialized;
      return newCks;
    }
    if (cks._import.format === "jwk") {
      return await subtle().importKey(
        cks._import.format,
        cks._import.keyData,
        cks.algorithm,
        cks.extractable,
        cks.usages
      );
    } else {
      return await subtle().importKey(
        cks._import.format,
        cks._import.keyData,
        cks.algorithm,
        cks.extractable,
        cks.usages
      );
    }
  },
};
