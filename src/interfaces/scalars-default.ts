import { ModelError, ModelErrorCode } from "./error";
import { ExtendsType, ScalarOptions } from "./scalars";

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
export const numberScalar: ScalarOptions<number> = {
	parse(value) {
		if (typeof value === 'number') return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected number. Got ${typeof value}: ${value}`);
	}
};
/** Float */
export const floatScalar: ScalarOptions<Float> = {
	parse(value) {
		if (typeof value === 'number') return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected Float. Got ${typeof value}: ${value}`);
	}
};
/** Unsigned Float */
export const uFloatScalar: ScalarOptions<uFloat> = {
	parse(value) {
		if (typeof value === 'number' && value >= 0) return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected unsigned Float. Got ${typeof value}: ${value}`);
	}
};
/** Integer */
export const intScalar: ScalarOptions<Int> = {
	parse(value) {
		if (typeof value === 'number' && Number.isSafeInteger(value))
			return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected integer. Got ${typeof value}: ${value}`);
	},
};
/** Unsigned integer */
export const uIntScalar: ScalarOptions<uInt> = {
	parse(value) {
		if (
			typeof value === 'number' &&
			Number.isSafeInteger(value) &&
			value >= 0
		)
			return value;
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected unsigned integer. Got ${typeof value}: ${value}`);
	},
};
/** String */
export const stringScalar: ScalarOptions<string> = {
	parse(value) {
		if (typeof value === 'string') return value;
		else return String(value);
	},
};

/** Boolean */
export const booleanScalar: ScalarOptions<boolean> = {
	parse(value) {
		if (typeof value === 'boolean') return value;
		else return !!value;
	},
};
/** Buffer */
export const bufferScalar: ScalarOptions<Buffer> = {
	serialize(value: Buffer) { return value.toString('base64url'); },
	parse(value) {
		if (typeof value === 'string')
			return Buffer.from(value, 'base64url');
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected Buffer as string. Got ${typeof value}: ${value}`);
	},
};

/** BigInt */
export const bingIntScalar: ScalarOptions<bigint> = {
	serialize(value) { return value.toString(); },
	parse(value) {
		if (typeof value === 'string' || typeof value === 'number')
			return BigInt(value);
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected date string or timestamp. Got ${typeof value}: ${value}`);
	}
}

/** Date */
export const dateScalar: ScalarOptions<Date> = {
	serialize(value) { return value.toISOString(); },
	parse(value) {
		if (typeof value === 'string' || typeof value === 'number') {
			let d = new Date(value);
			if (typeof d.getTime() === 'number') return d;
		}
		throw new ModelError(ModelErrorCode.WRONG_VALUE, `Expected date string or timestamp. Got ${typeof value}: ${value}`);
	}
}