import { ResolversOf } from "@src/helpers/interfaces";
/**
 * @tsmodel
 * Create Model using interfaces
 */
export interface UserModel {
    id: ID;
    /** This is firstname */
    firstName?: string;
    lastName?: string;
    /** This field is required! */
    fullName: string;
    /** Custom type Email */
    email: Email;
    newsletter: boolean;
    /** Those are bookings */
    Bookings?: Booking[];
    message: string;
}
/** @tsmodel */
declare type Email = `/$Email regex^/`;
/** @tsmodel */
declare type ID = string;
/** @tsmodel */
export declare class UserResolvers implements ResolversOf<UserModel> {
    /** Overriding booking comment */
    Bookings(parent: any, args: any, context: any, infos: any): void;
    /** a message */
    message(parent: any, args: any, context: any, infos: any): string;
}
/**
 * @tsmodel
 * Bookings
 */
export interface Booking {
    id: ID;
    name: string;
}
export {};
