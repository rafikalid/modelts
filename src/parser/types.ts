import { ModelBasicScalar } from "..";

/** default scalars: int */
export const DEFAULT_SCALARS = [
	'number',
	'Int',
	'uInt',
	'uFloat',
	'string',
	'boolean',
	'Buffer'
] as const;

/** Integers */
export type Int = number;
export type uInt = number;

/** Double precision floating point */
export type Float = number;

//* Custom scalars
export const numberScalar: ModelBasicScalar<number> = {
	description: 'Number',
	parse(value) {
		if (typeof value === 'number') {
			return value;
		} else {
			var v = Number(value);
			if (isNaN(v)) throw new Error(`Illegal unsigned int: ${value}`);
			return v;
		}
	},
};
/** Unsigned integer */
export const uIntScalar: ModelBasicScalar<uInt> = {
	description: 'Integer',
	parse(value) {
		if (
			typeof value === 'number' &&
			Number.isSafeInteger(value) &&
			value >= 0
		)
			return value;
		else throw new Error(`Illegal unsigned int: ${value}`);
	},
};

/** Unsigned integer */
export const intScalar: ModelBasicScalar<Int> = {
	description: 'Unsigned Integer',
	parse(value) {
		if (typeof value === 'number' && Number.isSafeInteger(value))
			return value;
		else throw new Error(`Illegal int: ${value}`);
	},
};

/** Unsigned Float */
export type uFloat = number;
export const uFloatScalar: ModelBasicScalar<uFloat> = {
	description: 'Float',
	parse(value) {
		if (typeof value === 'number' && value >= 0) return value;
		else throw new Error(`Illegal unsigned float: ${value}`);
	},
};

/** String */
export const stringScalar: ModelBasicScalar<string> = {
	description: 'String',
	parse(value) {
		if (typeof value === 'string') return value;
		else return String(value);
	},
};

/** Boolean */
export const booleanScalar: ModelBasicScalar<boolean> = {
	description: 'Boolean',
	parse(value) {
		if (typeof value === 'boolean') return value;
		else return !!value;
	},
};
/** Buffer */
export const bufferScalar: ModelBasicScalar<Buffer> = {
	description: 'Buffer ( Serialized and parsed as "base64url" )',
	serialize(value: Buffer) {
		return value.toString('base64url');
	},
	parse(value) {
		if (typeof value === 'string')
			return Buffer.from(value, 'base64url');
		else throw new Error(`Illegal unsigned float: ${value}`);
	},
};