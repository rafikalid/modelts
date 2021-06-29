import { Int, JsonTypes, Model, ModelScalar, resolver, UNION } from "@src/index.js";
import { ResolversOf } from "@src/index.js";
import { jsDocDirective } from "@src/schema/validation";

/**
 * @tsmodel
 * Create Model using interfaces
 */
export interface UserModel {
	id: ID,
	/** This is firstname */
	firstName?: string,
	lastName?: string,
	/**
	 * This field is required!
	 * Oh yeah, required :D
	 */
	fullName: string,

	/** Custom type Email */
	email: Email,
	newsletter: boolean,

	/** Those are bookings */
	Bookings?: Booking[]

	message: string,

	history:
		{
			ar1: string
		}[]
}

/** @tsmodel */
export type Email= `/$Email regex^/`;

/** @tsmodel */
export type ID= string;

/** @tsmodel */
export class UserResolvers implements ResolversOf<UserModel>{
	/** Overriding booking comment */
	@resolver
	Bookings(parent: any, args: string[], context: any, infos: any):void{
		// this is a resolver
	}

	/** a message */
	@resolver
	message(parent: any, args: Booking, context: any, infos: any): string{
		return 'hello'
	}
}

/**
 * @tsmodel
 * Bookings
 */
export interface Booking{
	id: ID,
	name: string
}

/** User interface */
export interface User{
	id:		ID,
	/**
	 * User's name
	 * @max 300, User's name mast be less than 100, got $value
	 */
	name:	string,
	/**
	 * User's age
	 * @between 15 & 66, Expected value between 15 and 66
	 * @has EDIT_STAFF, Missing permission Edit staff
	 */
	age:	Int
}

/**
 * @tsmodel
 * Enum
 */
export enum roles{
	/** A basic employee role */
	basicEmployee,
	/** Normal employee role */
	employee=5825,
	/** Store manager */
	manager='managerValue',
	/** Store owner */
	owner='ownerValue'
}

/** Model */
export const model= new Model();

/** type example */
export type ObjectId= ``;

/** Object id scalar */
export const ObjectIdScalar: ModelScalar<ObjectId>= {
	name: 'ObjectId',
	parse(value: JsonTypes){
		return value as ObjectId;
	},
	serialize(value){
		return String(value);
	}
};

/** Union */
export const UnionExample: UNION<User|Booking>= {
	name: 'UnionExample',
	resolveType(value, info: any){
		return 0;
	}
}

/** Create jsDoc directive */
const hasDirective: jsDocDirective= {
	name:	'has',
	resolve(txt: string, fieldType: string){
		// parse text after directive
		var parsed= txt.match(/^([A-Z_])(?:,(.+))?/);
		// wrap resolver
		return function wrapper(resolver: Function){
			return async function(parent: any, arg: any, ctx: any, info: any){
				// Do prefix checks
				var r= await resolver(parent, arg, ctx, info);
				// Do post checks
				return r;
			}
		}
	}
};