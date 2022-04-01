/**
 * @resolvers
 */
export class Query {
	//* All fields
	readUsers(p: unknown, args: User): User[] { throw 'hello'; }
}

/**
 * @resolvers
 */
export interface Mutation { }

/**
 * @resolvers
 */
export interface Inscription { }

/**
 * Root schema
 * @entity
 */
export interface Schema {
	query: Query,
	mutation: Mutation,
	inscription: Inscription
}

//* Generate schema
const schema = gqlSchema<Schema, AnnotationResolver>();

/**
 * Example of entity user
 * @entity
 */
export interface User extends Resolvers<UserResolvers>, Validators<UserValidators>, Converter<typeof userConverter> {
	name: string,
	/**
	 * @has Role.Backend.List
	 */
	address: string,
	age: number
}

/**
 * Example of implementation
 * @output
 */
export class UserResolvers implements resolversOf<User>{
	name(p: unknown, args: unknown): string {
		return 'cc';
	}
}

@has(Role.Backend.SUDO)
export class UserValidators implements validatorsOf<User>{
	name(p: unknown, args: unknown): string {
		return 'cc';
	}
}


export const userConverter = {
	input() { },
	output() { }
}

//* Scalars
export type uInt = typeof Scalar<Number /** basic type, will inherit non overrided methods if found */>({
	parse() { },
	toJson() { },
	fromDB() { },
	toDB() { },
	mock() { },

	assert(data: any) {
		//* Assert annotation parser
	}
	default(data: string) {
		//* default annotation parser
	}
});



//* Compiler options
compile({
	mock: true // Do include mocks
})

const c: Partial<T>

type Resolvers<T> = object;
type Validators<T> = object;
type Converter<T> = object;

type resolversOf<T> = {
	[k in keyof T]?: (...arg: any[]) => T[k]
}
type validatorsOf<T> = {
	[k in keyof T]?: (...arg: any[]) => T[k]
}



/**
 * @assert gt: 5
 * @assert gt: 845*888
 * @assert gt: 215s
 * @assert lt: 77
 * @default true
 */
const t: string


function expect<T>(annotation: Function): T {
	throw 'compile this please'
}

function has(a: number): () => number {
	return function () { return a }
}


/** Default jsDoc annotation resolver */
export class DefaultAnnotationResolvers {
	assert() { }
	default() { }
}

export class AnnotationResolver extends DefaultAnnotationResolvers {
	has(txt: string) {
		return txt;
	}

}



//* Client
const q = gql<Query["readUsers"]>();
const q2 = gql<Query["readUsers"]>({
	address: 'ok' // Pick required fields
});

const resp = request<Query["readUsers"]>(q);


const resp2 = request<Query["readUsers"]>({
	name: 'My name',
	address: 'my address'
});



//* Create query
function gql<T>(
	select?: T extends (...args: any) => any ? Partial<Parameters<T>[1]> : never
): T extends (...args: any) => any ? ReturnType<T> : T {
	throw 'hello';
}

//* Do request
function request<T>(
	variables?: T extends (...args: any) => any ? Partial<Parameters<T>[1]> : never
): T extends (...args: any) => any ? ReturnType<T> : T {
	throw 'hello';
}


// ==================== Gridfw ==================

@controler("/path/to/:var1/*")
export class MainControler extends Controller {
	get(): HTML | JSON { /* */ }

	post(body: User) HTML | User[] { /* */ }

others(
	path: URI, // Resolve uri
	method: HTTPMethod, // Resolve http method
	ip: IP,// Resolve IP
	cookies: Cookies, // Resolve cookies
	param1: PathParam < "var1" >,
	paramRest: PathParam < "*" >,
) {
	/** Implements other methods */
}
}

//TODO resolver arg: if not null: create empty object for it and than check inside.
//TODO for resolvers, check all arguments and set theme depending on type

// TODO rename MaybeAsync to MaybePromise