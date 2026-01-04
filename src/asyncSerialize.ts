export interface Serializer<T, S> {
  id: string;
  isType: (o: unknown) => o is T;
  toObject?: (t: T) => Promise<S>;
  fromObject?: (o: S) => Promise<T>;
}

interface Serialized {
  __serializer_id: string;
  value: any;
}

function isSerialized(object: unknown): object is Serialized {
  return (
    object !== null &&
    typeof object === "object" &&
    Object.prototype.hasOwnProperty.call(object, "__serializer_id")
  );
}

function findSerializerByType(
  serializers: ReadonlyArray<Serializer<any, any>>,
  value: unknown
): Serializer<any, any> | undefined {
  return serializers.find((serializer) => serializer.isType(value));
}

function findSerializerById(
  serializers: ReadonlyArray<Serializer<any, any>>,
  id: string
): Serializer<any, any> | undefined {
  return serializers.find((serializer) => serializer.id === id);
}

export async function toObjects(
  serializers: ReadonlyArray<Serializer<any, any>>,
  o: any
): Promise<any> {
  if (o === null || typeof o !== "object") {
    return o;
  }

  const serializer = findSerializerByType(serializers, o);
  if (serializer) {
    const value = serializer.toObject ? await serializer.toObject(o) : o;
    return {
      __serializer_id: serializer.id,
      value: await toObjects(serializers, value)
    } as Serialized;
  }

  const newO = Array.isArray(o) ? [] : {};
  for (const atr of Object.keys(o)) {
    newO[atr] = await toObjects(serializers, o[atr]);
  }
  return newO;
}

export async function fromObjects(
  serializers: ReadonlyArray<Serializer<any, any>>,
  o: any
): Promise<any> {
  if (o === null || typeof o !== "object") {
    return o;
  }

  if (isSerialized(o)) {
    const value = await fromObjects(serializers, o.value);
    const serializer = findSerializerById(serializers, o.__serializer_id);
    if (serializer.fromObject) {
      return serializer.fromObject(value);
    }
    return value;
  }

  const newO = Array.isArray(o) ? [] : {};
  for (const atr of Object.keys(o)) {
    newO[atr] = await fromObjects(serializers, o[atr]);
  }
  return newO;
}
