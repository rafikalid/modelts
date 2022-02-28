# tt-Model
Make better model schemas for **GraphQL**, **REST** APIs or any other purpose using only your already well known typescript classes and interfaces.

Extract models from your already created typescript interfaces and classes.

Separate logic, security and validation.

Easy to use validations.

# Why to use tt-Model
- Fast and easy to use Model framework for Typescript, GraphQL, REST, JSON...
- Converts Typescript interfaces and classes into *GraphQL* and *REST* Schema.
- Adds support for Generics and inheritance into GraphQL.
- Write more complex graphQL easily.
- Makes schema simple to maintain.
- Write significantly less and lisible code (100x less code than GraphQL SDL)
- Support's "promises" without decreasing performance on all levels.

# tt-Model vs Graphql SDL

| 					| GraphQL SDL | tt-Model	|
|-------------------|-------------|-------------|
| Learning curve |  Totally new language | Typescript that you already use |
| Usable for programing |  no | yes, it's your typescript code |
| Inheritance |  no | yes |
| Generics |  no | yes |
| Namespaces |  no | yes |
| Macros |  no | yes |
| Omit fields |    no   |   yes |
| Ignore fields |    no   |   yes |
| Virtual fields |    no   |   yes |
| Add fields |    no   |   yes |
| Merge schemas |    no   |   yes |
| Input/output entities |    no   |   yes |
| Input validation |    no   |   yes |
| Asserts |    no   |   yes |
| Define custom scalers |    complex   |   easy |
| Convert schemas |    no   |   yes |
| Typed entities (Example: of type "User") |    no   |   yes |
| Comments |    hard codded strings  | /** jsDoc comments */ |
| Split into multiple files |    no   |   yes |
| Usable for other purposes |    no   |   yes |
| Do operations before sending to DataBase |    no   |   yes |
| Do operations before loading from DataBase |    no   |   yes |
| Generating graphQL |    At runtime   |  At compile time  |

> Generating GraphQL at compile time optimizes running time, used memory and CPU performance.\
> Eliminate the need for one time used libraries for compilation:
> - less memory and disk space for the app
> - Documentation is not generated for production mode
> - Eliminate security issues due to additional compile libraries and documentation. 


# Define custom scalers
Just export an object of type: `Scalar<yourType>`
```typescript
import type {ModelScaler} from 'tt-model';

/**
 * This comment will be added as documentation to the API
 * in development mode.
 * Nice, it's what your IDE and any body already understand ;)
 */
export const myScaler: Scalar<myScalersType> = {
	/** @optional parser from JSON */
	parse?: (value: string | boolean | number) => myType;

	/** @optional serializer to JSON */
    serialize?: (value: myType) => string | boolean | number | undefined | null;

	/** @optional converter from Database */
    fromDB?: (value: any) => myType;

	/** @optional converter to Database */
    toDB?: (value: myType) => any;
};
```
> Tip: You can do basic validation inside parse/serialize methods\
> Throw error if validation fails.

### Example:
```typescript
import {ModelScaler} from 'tt-model';
import {ObjectId} from 'mongodb';

/** My Optional documentation */
export const myScaler: Scalar<ObjectId> = {
	parse(value: string){
		if(typeof value!== 'string')
			throw new Error(`Illegal id: ${value}`);
		return ObjectId.fromHexString(value);
	}
	serialize(id: ObjectId){
		return id.toHexString();
	}
};
```

### Example 2:
```typescript
import {ModelScaler, Clone} from 'tt-model';

/** My custom type (just a clone of type string) */
export CellPhone= Clone<string>;

/** Define my serializer / parser of Cellphone */
export const myScaler: Scalar<CellPhone> = {
	parse(value: string){
		// TODO Add your validation logic
		return value as CellPhone;
	}
	serialize(value: Cellphone){
		// No need to define this serializer since it's already a string ;)
		return value;
	}
};
```

# Define Enumerations
Just export your already created enumeration
```typescript
/**
 * An Optional documentation used by tt-Model
 * and your IDE
 */
export enum MyEnumeration{
	/** Optional field documentation */
	MY_ENUMERATION_ITEM
}
```
### Example
```typescript
/**
 * User roles
 */
export enum UserRoles{
	/** Admin role */
	ADMIN,
	/** Manager role */
	MANAGER,
	/** Client role */
	CLIENT
}
```

> Tip: Read the typescript documentation for more useful features about enumerations.

# Define Entities

> Entities with the same name even in separate files are merged into a ***single entity***.

## Define Plain Entities using interfaces:
Interfaces enables you to define *Plain objects entities*. Those entities do not need to be instantiated using classes.
### Example
```typescript
/**
 * My optional documentation used by tt-Model and your IDE
 */
export interface User {
	/** field documentation */
	id: ID
	/** Optional user's name, "?" means optional */
	name?: string
	age: number
	/** Using custom type */
	cellPhone: CellPhone
	/** using list  */
	emails: Email[]
	/** An other entity "Job" as a type */
	jobs: Job
	/** Nested types (not recommended anyway) */
	nestedDoc: {
		field1: type1,
		field2: type2
	}
}
```

> Visit typescript documentation for more *interface* features.

## Define Typed entity using class:
Useful if you need additional methods for the entity

(MUST HAVE DEFAULT CONSTRUCTOR OR NO CONSTRUCTOR AT ALL)
```typescript
/**
 * My optional documentation used by tt-Model and your IDE
 */
export class User {
	/** field documentation */
	id: ID
	/** Optional user's name, "?" means optional */
	name?: string
	age: number
	/** Your method to use in code (Ignore by the API) */
	myMethod( /* Args */ ){
		// Your logic
	}
}
```

## Force order fields
By default, tt-model keeps the same order as define in the code. To order 
fields by name, add `@ordered` in the jsDoc comment as follow
```typescript
/**
 * @ordered
 */
export interface MyEntity{
	// Fields
}
```

# Ignore a field or class or interface
Use jsDoc annotation `@ignore`
```typescript
export interface MyEntity{
	/**
	 * This field will be ignored by the API
	 * @ignore
	 */
	ignoredField: fieldType
	// Other fields ...
}
```

# Do not send a field to the Database
Use jsDoc annotation `@virtual`
```typescript
export interface MyEntity{
	/**
	 * This field with not be persisted into Database
	 * @virtual
	 */
	virtualField: fieldType
	// Other fields ...
}
```

# Set an INPUT / OUTPUT only field
Use jsDoc annotations `@output` and `@input`
```typescript
export interface MyEntity{
	/**
	 * @input
	 */
	myInputOnlyField: fieldType
	/**
	 * @output
	 */
	myOutputOnlyField: fieldType

	// Other fields ...
}
```

## Field alias
Some times you need to rename a field outside your code (as input, output or both). For example to change MongoDB's main document id field `_id` to `id`. To do this use `@alias` in the jsDoc comment as follow:
```typescript
export interface MyEntity{
	/**
	 * In the INPUT and OUTPUT API, this field will be
	 * renamed to "id"
	 * @alias id
	 */
	_id: ObjectId
}
```

## Set a field as optional
Use the typescript syntax for this
```typescript
export interface MyEntity{
	// use "?" to make a field optional
	optionalField?: string
}
```

## Set all fields as optional or required
use typescript `Partial` generic to generate a new entity with all fields optional.

The same use `Required` to generate a new entity with all fields required.

```typescript
export interface MyEntity{
	field1: type1
	field2?: type2
}

//* Entity with all fields optional
export type MyEntityAllOptional= Partial<MyEntity>;

//* Entity with all fields required
export type MyEntityAllRequired= Required<MyEntity>;
```

## Remove fields from entity
use typescript `Omit` to generate a new entity excluding removed fields
```typescript
export interface MyEntity{
	field1: type1
	field2: type2
	field3: type3
	field4: type4
}

//* Entity with one field removed
export type MyEntity2= Omit<MyEntity, 'field2'>;

//* Entity with multiple fields removed
export type MyEntity3= Omit<MyEntity, 'field2' | 'field3'>;
```


## Remove fields of an other entity from entity
use typescript `Omit` and `keyof` to generate a new entity excluding removed fields.
```typescript
//* base entity
export interface MyEntity{
	field1: type1
	field2: type2
	field3: type3
	field4: type4
}

//* entity to remove fields
export interface ExcludeEntity{
	field2: type2
	field3: type3
	otherField: otherType
}

//* Entity with all fields from "ExcludeEntity" removed
export type MyTargetEntity= Omit<MyEntity, keyof ExcludeEntity>;
```

## Add fields
Better to use inheritance, but this is an other solution for this:
```typescript
//* base entity
export interface MyEntity{
	field1: type1
	field2: type2
	field3: type3
	field4: type4
}

//* Add fields using "&"
export type targetEntity= MyEntity & {additionalField: fieldType};

//* Or merging two entities
export interface MySecondEntity{
	//...fields
}
export type MergedEntities= MyEntity & MySecondEntity;
```

## Merge fields from multiple entities
It's better to organize your code in an inheritance format. But if you need merge anyway, use "&" to do that as follow:
```typescript
//* base entity
export interface MyEntity1{
	// Fields
}
export interface MyEntity2{
	// Fields
}
export interface MyEntity3{
	// Fields
}

//* Merging entities
export type TwoMergedEntities= MyEntity1 & MyEntity2;
export type MoreMergedEntities= MyEntity1 & MyEntity2 & MyEntity3;
```

## Your own typescript generating logic
Typescript enables you to generate entities using your own logic. tt-Model just supports anything typescript supports.

### Example
```typescript
/** My custom generator that convert all fields type into string */
export type ConvertAllFieldsToString<T> = {
	[k in keyof T]: string
};

/** My entity */
export interface MyEntity{
	field1: number;
	field2: boolean;
	field3: 'hello' | 'world'
}

//* Use my generator to generate an entity with all fields from "MyEntity" set to 'string'
export type MyStringEntity= ConvertAllFieldsToString<MyEntity>;
```


## Inheritance
Just use inheritance as typescript enables you to do
```typescript
export interface MyBaseInterface{
	// Fields
}

export interface MyInheritedEntity extends MyBaseInterface{
	// Additional fields
}
```

## Generics
Generic are useful to reuse your code

Example
```typescript
/** My Generic pagination */
export interface MyGenericPageRequest<T>{
	filter: T;
	skip: number;
	limit: number;
}

/** My filter 1 */
export interface FilterUsers{
	name?: string;
	age?: string
}

/** My filter 1 */
export interface FilterBooks{
	title?: string
	author?: ID
}

/**
 * My User pagination
 * (use it directly in your code or export it as a type)
 */
MyGenericPageRequest<FilterUsers>

/**
 * My Book pagination
 * (use it directly in your code or export it as a type)
 */
MyGenericPageRequest<FilterBooks>
```

> Visit typescript documentation for more Generics features.

## Union
For tt-Model, you need to define a logic on how to select appropriate type in case of field with union type
```typescript
/** Type 1 */
export interface Client {
	// Client fields
}

/** Type 2 */
export interface Staff{
	// Staff fields
}

// Union supports infinity of types

/** My union type */
export type Agent= Client | Staff;

/**
 * To make "Agent" union usable for the API
 * Define a logic to choose between "Client" and "Staff"
 * 
 * @Warning
 * When used as a Graphql generator,
 * unions are only supported for output data
 * (Graphql limitation)
 */
import {UNION} from 'tt-model';
export const agentUnion: UNION<Agent> = {
	resolveType(value:Agent, ctx: any, info: any){
		// Return the aproppriate index of the type in the UNION definition
		return value.type === 'staff' ? 1 : 0 
	}
};
```
## Converters
Sometimes, you need to define separate complex schemas and validations for INPUT, OUTPUT and INSIDE code schema. To make this easy, you can use converters that convert data.

> Maybe you just need `@input`, `@output`, `@ignore` and `@virtual` jsDoc annotations or resolvers to achieve 98% of cases. this is reserve for more complex cases.
```typescript
/** My internal entity */
export interface MyInternalEntity { /* Fields */}
/** How entity appears in API output */
export interface MyOutputEntity{ /* Fields and resolvers logic */}
/** How entity appears as API input */
export interface MyInputEntity{ /* Fields and validation logic */}

/**
 * Define your converter
 * Could be defined only for INPUT, OUTPUT or both
 */
import { Converter } from 'tt-model';
export anyNameAsConverterName: Converter<MyInternalEntity> = {
	/**
	 * Optional: Define how entity is converted from INPUT
	 * MUST define the Input entity schema
	 * validation defined in the "Input entity" will be executed
	 * No need for more validation in the "input" converter
	 */
	input(parent: any, value: MyInputEntity, ctx: Context, info: any){
		// Return your converted data
	}

	/**
	 * Optional: Define how entity is converted before OUTPUT
	 * MUST define the Output entity schema
	 * Resolvers in the "output entity" schema will be executed
	 */
	output(parent: any, value: MyInternalEntity, ctx: Context, info: any): MyOutputEntity{
		// Return your converted data
	}
};
```

### Example:
In this example, we store positions in GeoJSON format, but for input, we use more easy scheme:
```typescript
/** My GeoJSON types */
export enum GeoTypes{
	FEATURE= 'Feature',
	POINT= 'Point'
}
/** My Cursor in GeoJSON format */
export interface MapCursor{
	type: GeoTypes.FEATURE,
	geometry: GeoPosition,
	properties: MyGeoProperties
}
/** My Geo position as point */
export interface GeoPosition{
	type: GeoTypes.POINT;
	coordinates: number[];
}
/** My Custom properties */
export interface MyGeoProperties{
	// My custom fields
	myOtherProperty: string
}

/**
 * Used schema to receive cursor from the client
 * Asserts and validations will be executed before convert.
 */
export interface MapCursorInput{
	/**
	 * @assert min: -180, max: 180
	 */
	longitude: number
	/**
	 * @assert min: -90, max: 90
	 */
	latitude: number
	/**
	 * Any defined validator will be executed
	 * before convert
	 */
	myOtherProperty: string
}

/**
 * Define our converter logic
 */
import {Converter} from 'tt-model';
export const anyNameAsConvertersName: Converter<MapCursor> = {
	/** Convert input data */
	input(parent: any, input: GeoLocationInputFormat): MapCursor {
		if( input == null ) return undefined;
		return {
			type: GeoTypes.FEATURE,
			geometry: {
				type: GeoTypes.POINT,
				coordinates: [input.longitude, input.latitude]	
			},
			properties: {
				myOtherProperty: input.myOtherProperty
			}
		}
	}
};

```

# Output Entity Resolvers
Resolvers enable you to define how a field is resolved.
It enables you to change or resolve a field using your own logic.

> Resolver's output type will override original field type.

## Define Resolvers using classes
Classes are used to define typed entities. To use theme as resolvers instead, use `@resolvers` jsDoc annotation.

> The limitation of this approach is that you need to define interfaces and classes of the same name in separated files.

> This approach is recommended only to define graphql **Query**, **Mutation** and **Subscription**

Example
```typescript

/**
 * This class will be used as resolver instead of entity
 * because of the "resolvers" annotation
 * @resolvers
 * @output
 */
export class Query {
	/**
	 * Add your resolver documentation as jsDoc comment
	 * You must define the returned type
	 */
	myField(parent: any, args: any, ctx: Context, info: GraphQLInfos) : RequiredReturnedType{
		// Your logic
	}

	/**
	 * This is an example of Users resolver
	 * here the input entity is defined as "UserFilter"
	 * 
	 * You can use typescript annotations to do more
	 * like common validation or anything else
	 */
	@customTypescriptAnnotation(/* Args */)
	users(parent: any, filter: UserFilter): User{
		return DB.findUsers(filter);
	}
}

/** User's interface entity */
export interface User {
	/** User's id */
	id: ID
	// User's fields
	name: string
	role: ID
	/**
	 * This field is virtual and output only
	 * a resolver is defined bellow
	 * @virtual
	 * @output
	 */
	orders: Order[]
}

/**
 * Define User's field resolvers
 * This class needs to be defined in separate file.
 * @resolvers
 */
export class User{
	/**
	 * Resolve role using user.id
	 */
	role(parent: User): Role {
		return DB.resolveRole(parent.role);
	}

	/** resolve */
	orders(parent: user, args: any): Order[]{
		return DB.resolveOrdersByUid(parent.id);
	}
}
```

## Define Resolvers using helper
This is the recommended approach to define entity resolvers.

> For consistency reason, you must explicitly define return type of resolvers

```typescript
/** Your entity using "interface" or "class" */
export interface MyEntity{
	// Fields
	role: ID
}

/**
 * Define entity resolvers
 * use any name you wish as the class name
 */
export class MyEntityResolvers implements ResolversOf<MyEntity>{
	/** Resolve role */
	role(parent: MyEntity, args: any): Role{
		return DB.resolveRoleById(parent.role);
	}

	/**
	 * Use typescript annotations for common validation
	 * (like to check if has an access right)
	 */
	@annotationExample
	otherField(parent): ReturnedType{
		//* You can access any other method
		//* from this class using "this" keyword
		return this.resolver2(parent);
	}

	/**
	 * Use "ignore" jsDoc annotation to ignore a method
	 * @ignore
	 */
	ignoreMethod(/* Any arguments */){}

	/**
	 * Use "private" keyword to ignore methods
	 */
	private method(/* Any arguments */){}
}
```

### Method 2 to define resolvers
You can use `ResolverConfig`. but prefer using previous method ( enables you to use annotations and call member methods)
```typescript
export const anyVarName: ResolverConfig<MyEntity> = {
	outputFields: {
		// Define your resolvers here
		// Maybe you'd better to use previous approach using classes for more flexibility
		field(parent: any, args: any, ctx: Context, info: GQLInfo): ReturnedValue {
			// Logic
		}
	}
};
```

### Define a resolver on the whole entity
Some times you need this

```typescript
/** My entity */
export interface MyEntity {
	field: fieldType
	// Other fields
}

/** Validation pipeline */
import type { ResolverConfig } from 'tt-model';
export const anyVarName: ResolverConfig<MyEntity> = {
	/**
	 * Execute a resolver before all entity field's resolvers
	 * it should be used as a pipeline only
	 */
	beforeOutput(parent: any, value: MyEntity, ctx:any, info: any){
		// NB: You can't change the schema here, use "Converter"
		// instead if you need schema transformation
		return value;
	}

	/**
	 * Execute a resolver after all entity field's resolvers are executed
	 * it should be used as a pipeline only
	 */
	afterOutput(parent: any, value: MyEntity, ctx:any, info: any){
		// NB: You can't change the schema here, use "Converter"
		// instead if you need schema transformation
		return value;
	}
};
```

# Entity Validation and Pipeline

> tt-model enables you to validate and convert your data before being processed by resolvers.
> This enables you to write validation only once for any type of data. This eliminates a huge amount of errors and security vulnerabilities.

> Validation is performed from deeper values to up values. In your data tree, child node is validated before it's parent node.
> You can use '::beforeInput' to execute operations on node before it's sub-nodes

## Asserts
Asserts are a lightweight, lisible and performant way to validate input fields (data from client). Use jsDoc annotation `@assert` as follow.

> Optimal code will be generated at compile time, so it's better and faster than any possible third library.
```typescript
export interface MyEntity{
	/**
	 * age must be 18 <= age <= 120
	 * @assert min: 18, max: 120
	 */
	age: number;
	/**
	 * password's length must be 8 <= password.length <= 100
	 * @assert min: 8, max: 100
	 */
	password: string
	/**
	 * Array's length must be greater than 17: arr.length > 17
	 * @assert gt: 17
	 */
	arr: number[]
	/**
	 * Check equals
	 * @assert eq: "khalid"
	 */
	name: string
	/**
	 * Check using regex
	 * <!> This only an example regex, not safe to check emails
	 * @assert regex: /^[a-z0-9.]+@\w+\.\w{2,5}$/
	 */
	email: string
	/**
	 * Static math expression are allowed
	 * and will be evaluated at compile time
	 * @assert lte: 5 * 2**20
	 */
	bytes: number
}
```
possible options are:
```
min: Minimum value or length
max: Maximum value or length
gte: Greater than or equals
gt: Greater than value or length
lte: Less than or equals value or length
lt: Less than value or length
eq: Equals value
ne: Not equals value
length: Has length equals to
regex: Apply regular expression
```

## Validation using custom functions

### Validate/Pipeline entity fields
Just like resolvers, define a class that implement the entity using `ValidatorsOf<YourEntity>`

> Received type as second argument will override field's INPUT type

```typescript
/** My entity */
export interface MyEntity {
	field: fieldType
	// Other fields
}

/** Define validator for fields */
export class anyClassName implements ValidatorsOf<MyEntity> {
	/**
	 * Define field validator just like resolvers
	 */
	field(parent: MyEntity, args: InputFieldType, ctx: Context, info: GQLInfo): fieldType{
		// Do your validation and transformations logic
		if(hasError)
			throw new CustomError('Error message');
		// Return appropriate data
		return value;
	}
	
	/**
	 * You can use any JS/Typescript annotation for more control
	 * "args" type here will override field's type for INPUT
	 */
	@aCustomAnnotation()
	anOtherField(parent: MyEntity, args: InputFieldType, ctx: Context, info: GQLInfo): fieldType{
		// Do your validation and return appropriate data
	}
}
```

### Method 2 to define field pipeLine / validator
You can use `ResolverConfig`. but prefer using previous method ( enables you to use annotations and call member methods)
```typescript
export const anyVarName: ResolverConfig<MyEntity> = {
	inputFields: {
		// Define your validators/pipelines here
		// Maybe you'd better to use previous approach using classes for more flexibility
		field(parent: any, args: InputType, ctx: Context, info: GQLInfo): ReturnedValue {
			// Logic
			return args; // return appropriate data
		}
	}
};
```

### Validate the whole entity
You can do operations BEFORE and AFTER a validation process is executed on any entity as follow (NB: Child nodes are validated before their parent nodes)
```typescript
/** My entity */
export interface MyEntity {
	field: fieldType
	// Other fields
}

/** Validation pipeline */
import type { ResolverConfig } from 'tt-model';
export const anyVarName: ResolverConfig<MyEntity> = {
	/**
	 * Process RAW entity
	 * before any field validation / pipeline
	 */
	beforeInput(parent: any, value: MyEntity, ctx:any, info: any){
		// Do your logic before "MyEntity" fields and sub-entities are validated
		// NB: You can't change the schema here, use "Converter"
		// instead if you need schema transformation
		return value;
	}

	/**
	 * Process validated / transformed data
	 * (After all fields and sub-entities validation/modification)
	 */
	afterInput(parent: any, value: MyEntity, ctx:any, info: any){
		// Do more transformation / validation on the entity
		// NB: You can't change the schema here, use "Converter"
		// instead if you need schema transformation
		return value;
	}
};
```

## Add root Helpers
You could need to do some operations before or after executing data processing
maybe loading user's information from DB
```typescript
import { RootConfig } from 'tt-model';
export const anyVarName: RootConfig = {
	/**
	 * Do operations before any data process, just after JSON parsing
	 * @optional
	 */
	before(parent: any, args: any, ctx: any, info: any){
		// Your logic
		// Maybe load user's access rights for input args
		return args;
	}
	/**
	 * Do operations just before any data process, just after JSON parsing
	 * @optional
	 */
	after(parent: any, args: any, ctx: any, info: any){
		// Your logic
		// Maybe load user's access rights for input args
		return args;
	}
};
```

# Macro Decorators / Annotation
Macro decorator or annotation helps you to redefine classes and methods. Generally to add extra code without scarifying performance.

You may need knowledge of `typescript compiler api` to use this.

## Using the Decorator / Annotation
Use macro annotation just like you do with JS or Typescript Decorator

```typescript
@MyMacroAnnotationOnClass(...args)
export classMyClass{

	@MyMarcoAnnotationOnAttribute(...args)
	myAttribute: any

	@MyMacroAnnotationOnMethod(...args)
	myMethod(){ /* ... */}
}
```

## Define the Macro Decorator / Annotation

```typescript
import { AnnotationMacro, MacroAnnotationNode, MacroUtils } from 'tt-model';

export const yourMacroName= AnnotationMacro(function(
	node: MacroAnnotationNode,
	utils: MacroUtils,
	...OtherSpecificArgs
){
	// Your Macro logic
	return node;
});
```

`MacroAnnotationNode` is a typescript compiler node. You can use typescript compiler api to do advanced transformations if needed.
```typescript
type MacroAnnotationNode= ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration;
```

`MacroUtils` contains easy to use helpers to transform the code. For advanced and full control use typescript compiler api.

```typescript
class MacroUtils{
	/** Target node to be transformed: class or property */
	node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration;

	/** Typescript Compiler Program */
	program: ts.Program;

	/** Typescript Compiler API */
	ts: typeof ts;

	/** Node printer */
	printer: ts.Printer;

	/** Decorator arguments: as wrote in the code */
	args: string[]

	/**
	 * Decorator arguments as interpreted by the compiler
	 * most of time: undefined
	 */
	argv: any[]

	/** Check if a node is a method */
	isMethod(node: ts.Node): node is ts.MethodDeclaration

	/** Check a node is a property */
	isProperty(node: ts.Node): node is ts.PropertyDeclaration

	/** Check a node is a class declaration */
	isClass(node: ts.Node): node is ts.ClassLikeDeclaration

	/** Check a node has "static" keyword modifier */
	isStatic(node: ts.Node): boolean

	/** Get class or property name */
	getName(node: ts.Node): string

	/** Create unique name in the code */
	uniqueName(hint: string): ts.Identifier

	/** Update method body */
	updateMethodBody(
		node: ts.MethodDeclaration, // Method to update
		/** Function that will update the method code */
		callBack: (args: any, body: ts.Statement[]) => ts.Statement[],
		/** Same as previous, but faster for code prepend */
		prepend?: (args: any, body: ts.Statement[]) => ts.Statement[]
	) : ts.MethodDeclaration

	/** Create "if" statement */
	if(
		condition: string | ts.Expression,
		thenStatement: string | ts.Statement,
		elseStatement?: string | ts.Statement
	): ts.IfStatement

	/** Create Object access expression */
	objAccess(expr: string | ts.Expression, ...args: string[]): ts.Expression

	/** Create binary expression */
	binaryExpression(
		leftExpr: string | ts.Expression,
		operator: '=' | '==' | '===' | '!=' | '!==' | '&' | '|',
		rightExpr: string | ts.Expression | boolean | number
	): ts.BinaryExpression

	/** Create variable */
	createVar(varname: ts.Identifier, value: ts.Expression | string) : ts.VariableStatement
}
```

## Example
In this example, we will create a macro `hasPermission` that adds permission check code to target methods. 
The macro will be used as follow:

```typescript
export class MyClass{

	@hasPermission(User.Permissions.ANY_PERMISSION))
	doWhatEver(...args: any[]){
		// Logic
	}
}
```

We will define the macro as follow:
```typescript
import { AnnotationMacro, MacroAnnotationNode, MacroUtils } from 'tt-model';

export const hasPermission = AnnotationMacro(
	function(
		node: MacroAnnotationNode,
		utils: MacroUtils,
		// Any extra argument will be considered as the macro argument
		permissions: YourPermissionType
	){
		// Add your logic here, modify the node and return it
		// Assert node is of the correct type (method or class or attribute)
		// Throw error if any
		node = utils.updateMethodBody(node, undefined, function ([parent, args, ctx], body) {
			// Push check instruction to the method body
			body.push(
				utils.if(
					utils.binaryExpression(
						utils.objAccess(ctx, 'session', 'isAuthenticated'),
						'===', false
					),
					'throw new Error("Unauthorized Access.")'
				)
			);
			// Add any other required instructions using "utils" or "typescript compiler api"
			// return the body
			return body;
		});
		// Return resulting node
		return node;
	}
);
```

# Compile schema

## Use as GraphQL schema:
Just use a **Glob selector** to load schema from all target files.

```typescript
// Add those lines in the file "anyName.ts" where you need the schema:
import {Model} from 'tt-model';

/*
Use a GLOB selector to select all files that contains schema definitions
(entities, resolvers, ...)
"Glob selector" must be added as "STATIC string" to "Model.scanGraphQL" method
Remember this will be replaced at compile time with generated schema!
*/
const schema = Model.scanGraphQL('../model/**/*.ts, ./schema/**/*.ts');

//* Or use multiple STATIC strings
const schema = Model.scanGraphQL('../model/**/*.ts', './schema/**/*.ts');

//* Then just generate your graphQL server with pre-compiled schema
const server = new ApolloServer({
	schema: schema,
	// Other fields
});
```

> Static strings means "hard codded strings" and not strings from variables or any dynamic sources.\
> This is because the line will be replaced at compile time with generated schema.

## Use for REST or any other purpose ( like file validations? )

> Will be available in next release.

## Compile the code
You can compile code to either TypeScript or JavaScript.
use [tt-model-compiler](https://www.npmjs.com/package/tt-model-compiler) at https://www.npmjs.com/package/tt-model-compiler

# Contribute

# Authors
- Khalid RAFIK <khalid.rfk@gmail.com>
	- Software Architect
	- Senior FullStack and BigDATA Engineer
- Wijdane EL HORRE <wijdane.elhorre19@gmail.com>
	- Senior Backend and BigDATA Engineer
- Abdelhakim RAFIK <ra.abdelhakim@gmail.com>
	- Fullstack and Security Engineer

# License
MIT License
