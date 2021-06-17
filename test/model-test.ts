import { ResolversOf } from "@src/helpers/interfaces";

/**
 * @tsmodel
 * Create Model using interfaces
 */
export interface UserModel {
	id: ID,
	/** This is firstname */
	firstName?: string,
	lastName?: string,
	/** This field is required! */
	fullName: string,

	/** Custom type Email */
	email: Email,
	newsletter: boolean,

	/** Those are bookings */
	Bookings?: Booking[]

	message: string
}

/** @tsmodel */
type Email= `/$Email regex^/`;

/** @tsmodel */
type ID= string;

/** @tsmodel */
export class UserResolvers implements ResolversOf<UserModel>{
	/** Overriding booking comment */
	Bookings(parent: any, args: any, context: any, infos: any){
		// this is a resolver
	}

	/** a message */
	message(parent: any, args: any, context: any, infos: any): string{
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