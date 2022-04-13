import { ModelError, ModelErrorCode } from "./error";
import { ExtendsType, JSONType, Scalar } from "./scalars";



//* Scalars
/** Integer */
export type Int = ExtendsType<number>;
/** Unsigned Integer */
export type uInt = ExtendsType<number>;
/** Float */
export type Float = ExtendsType<number>;
/** Unsigned float */
export type uFloat = ExtendsType<number>;


/** Number */
export class numberScalar implements Scalar<number>{
	parse(value: JSONType) {
		if (typeof value === 'number') return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected number. Got ${typeof value}: ${value}`);
	}
}
/** Float */
export class floatScalar implements Scalar<Float>{
	parse(value: JSONType) {
		if (typeof value === 'number') return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected Float. Got ${typeof value}: ${value}`);
	}
}
/** Unsigned Float */
export class uFloatScalar implements Scalar<uFloat>{
	parse(value: JSONType) {
		if (typeof value === 'number' && value >= 0) return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected unsigned Float. Got ${typeof value}: ${value}`);
	}
}
/** Integer */
export class intScalar implements Scalar<Int>{
	parse(value: JSONType) {
		if (typeof value === 'number' && Number.isSafeInteger(value))
			return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected integer. Got ${typeof value}: ${value}`);
	}
}
/** Unsigned integer */
export class uIntScalar implements Scalar<uInt>{
	parse(value: JSONType) {
		if (
			typeof value === 'number' &&
			Number.isSafeInteger(value) &&
			value >= 0
		)
			return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected unsigned integer. Got ${typeof value}: ${value}`);
	}
}
/** String */
export class stringScalar implements Scalar<string>{
	parse(value: JSONType) {
		if (typeof value === 'string') return value;
		else return String(value);
	}
}


/** Boolean */
export class booleanScalar implements Scalar<boolean>{
	parse(value: JSONType) {
		if (typeof value === 'boolean') return value;
		else return !!value;
	}
}
/** Buffer */
export class bufferScalar implements Scalar<Buffer>{
	serialize(value: Buffer) { return value.toString('base64url'); }
	parse(value: JSONType) {
		if (typeof value === 'string')
			return Buffer.from(value, 'base64url');
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected Buffer as string. Got ${typeof value}: ${value}`);
	}
};

/** BigInt */
export class bingIntScalar implements Scalar<bigint> {
	serialize(value: bigint) { return value.toString(); }
	parse(value: JSONType) {
		if (typeof value === 'string' || typeof value === 'number')
			return BigInt(value);
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected date string or timestamp. Got ${typeof value}: ${value}`);
	}
}

/** Date */
export class dateScalar implements Scalar<Date> {
	serialize(value: Date) { return value.toISOString(); }
	parse(value: JSONType) {
		if (typeof value === 'string' || typeof value === 'number') {
			let d = new Date(value);
			if (typeof d.getTime() === 'number') return d;
		}
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected date string or timestamp. Got ${typeof value}: ${value}`);
	}
}

/** Default scalars */
export const defaultScalars = {
	number: numberScalar,
	Float: floatScalar,
	uFloat: uFloatScalar,
	Int: intScalar,
	uInt: uIntScalar,
	string: stringScalar,
	boolean: booleanScalar,
	Buffer: bufferScalar,
	bigint: bingIntScalar,
	Date: dateScalar
};