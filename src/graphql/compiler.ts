import { FormatReponse } from "@src/formater/formater";
import { formatedInputField, FormatedInputNode, FormatedInputObject, formatedOutputField, FormatedOutputNode, FormatedOutputObject } from "@src/formater/formater-model";
import { FieldType, InputField, List, MethodDescriptor, ModelKind, Node, OutputField, Reference, Union } from "@src/parser/model";
import { GraphQLArgumentConfig, GraphQLEnumTypeConfig, GraphQLEnumValueConfig, GraphQLFieldConfig, GraphQLInputFieldConfig, GraphQLInputObjectType, GraphQLInputObjectTypeConfig, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLScalarTypeConfig, GraphQLUnionTypeConfig } from "graphql";
import ts from "typescript";

/** Compile Model into Graphql */
export function toGraphQL(root: FormatReponse, f: ts.NodeFactory, pretty: boolean): GqlCompilerResp{
	/** Validation schema declarations by the API */
	const validationDeclarations: ts.VariableDeclaration[]= [];
	/** Graphql types declaration */
	const graphqlDeclarations: ts.VariableDeclaration[]= [];
	//* Graphql imports
	const GraphQLScalarType=		f.createUniqueName('GraphQLScalarType');
	const GraphQLSchema=			f.createUniqueName('GraphQLSchema');
	const GraphQLEnumType=			f.createUniqueName('GraphQLEnumType');
	const GraphQLObjectType=		f.createUniqueName('GraphQLObjectType');
	const GraphQLInputObjectType=	f.createUniqueName('GraphQLInputObjectType');
	const GraphQLList=				f.createUniqueName('GraphQLList');
	const GraphQLNonNull=			f.createUniqueName('GraphQLNonNull');
	const GraphQLUnionType=			f.createUniqueName('GraphQLUnionType');
	const GraphQLFieldResolver=		f.createUniqueName('GraphQLFieldResolver');
	//* GQL Imports
	const gqlImports: (string|ts.Identifier)[]= [
		'GraphQLScalarType'		, GraphQLScalarType,
		'GraphQLSchema'			, GraphQLSchema,
		'GraphQLEnumType'		, GraphQLEnumType,
		'GraphQLObjectType'		, GraphQLObjectType,
		'GraphQLInputObjectType', GraphQLInputObjectType,
		'GraphQLList'			, GraphQLList,
		'GraphQLNonNull'		, GraphQLNonNull,
		'GraphQLUnionType'		, GraphQLUnionType,
		'GraphQLFieldResolver'	, GraphQLFieldResolver
	];
	//* tt-model imports
	const inputValidationWrapper= f.createUniqueName('inputValidationWrapper');
	const ttModelImports: (string|ts.Identifier)[]= [
		'inputValidationWrapper', inputValidationWrapper
	];
	//* Other imports
	const srcImports: Map<string, Map<string, ts.Identifier>>= new Map();
	//* Go through Model
	const {input: rootInput, output: rootOutput}= root;
	const queue: QueueInterface[]= [];
	if(rootOutput.has('Query')) queue.push({entity: rootInput.get('Query')!, isInput: false, index: 0});
	if(rootOutput.has('Mutation')) queue.push({entity: rootInput.get('Mutation')!, isInput: false, index: 0});
	if(rootOutput.has('Subscription')) queue.push({entity: rootInput.get('Subscription')!, isInput: false, index: 0});
	var queueLen: number;
	const mapEntities: Map<QueueInterface['entity'], ts.Identifier>= new Map();
	const PATH: Set<QueueInterface['entity']>= new Set();
	/** Circle fields from previous iterations */
	const circles: (formatedInputField|formatedOutputField|Reference)[]= [];
	var fieldHasCircle= false;
	const mapCirlces: CircleEntities[]= [];
	rootLoop: while((queueLen= queue.length) > 0){
		let currentNode= queue[queueLen-1];
		let {entity, isInput, index}= currentNode;
		let entityVar: ts.Identifier;
		switch(entity.kind){
			case ModelKind.FORMATED_INPUT_OBJECT:
			case ModelKind.FORMATED_OUTPUT_OBJECT:
				// Resolve each 
				isInput= entity.kind===ModelKind.FORMATED_INPUT_OBJECT;
				if(index < entity.fields.length){
					PATH.add(entity);
					queue.push({
						entity:		entity.fields[index++],
						isInput, index:		0
					});
					currentNode.index= index;
					continue rootLoop;
				}
				// Create entity var
				PATH.delete(entity);
				entityVar= f.createUniqueName(entity.escapedName);
				mapEntities.set(entity, entityVar);
				let gqlObjct= isInput ? GraphQLInputObjectType : GraphQLObjectType;
				// Create entity object
				if(circles.length){
					// Create fields with no circles
					let fieldsVar= f.createUniqueName(entity.escapedName+'_fileds');
					let expFields: Record<string, ts.Expression>= {};
					for(let i=0, fields= entity.fields, len= fields.length; i<len; ++i){
						let field= fields[i];
						if(circles.indexOf(field)===-1){
							expFields[field.name]= _compileField(field);
						}
					}
					mapCirlces.push({ entity, varname: fieldsVar, circles: circles.splice(0) });
					// Create obj
					let entityDesc:{[k in keyof (GraphQLInputObjectTypeConfig|GraphQLObjectTypeConfig<any, any>)]: any}= {
						name:			entity.escapedName,
						fields:			fieldsVar
					};
					if(entity.jsDoc!==null) entityDesc.description= entity.jsDoc;
					graphqlDeclarations.push(
						// Field var
						f.createVariableDeclaration( fieldsVar, undefined, f.createTypeReferenceNode(
								f.createIdentifier("Record"), [
									f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
									f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
								]
							), _serializeObject(expFields)
						),
						// Object
						f.createVariableDeclaration(entityVar, undefined, undefined, f.createNewExpression(
							gqlObjct, undefined, [_serializeObject(entityDesc)]
						))
					);
				} else {
					// Object without any circles
					let expFields: Record<string, ts.Expression>= {};
					for(let i=0, fields= entity.fields, len= fields.length; i<len; ++i){
						let field= fields[i];
						expFields[field.name]= _compileField(field);
					}
					// Create obj
					let entityDesc:{[k in keyof (GraphQLInputObjectTypeConfig|GraphQLObjectTypeConfig<any, any>)]: any}= {
						name:			entity.escapedName,
						fields:			_serializeObject(expFields)
					};
					if(entity.jsDoc!==null) entityDesc.description= entity.jsDoc;
					graphqlDeclarations.push(
						f.createVariableDeclaration(entityVar, undefined, undefined, f.createNewExpression(
							gqlObjct, undefined, [_serializeObject(entityDesc)]
						))
					);
				}
				break;
			case ModelKind.UNION:
				// Check for circles in previous type check
				if(fieldHasCircle){
					fieldHasCircle= false;
					if(index===0) throw new Error(`Enexpected circle before starting union!`);
					circles.push(entity.types[index-1]);
				}
				// Resolve each type
				if(index < entity.types.length){
					PATH.add(entity);
					queue.push({
						entity:		entity.types[index++],
						isInput: false, index: 0
					});
					currentNode.index= index;
					continue rootLoop;
				}
				// Resolved
				PATH.delete(entity);
				entityVar= f.createUniqueName(entity.name);
				mapEntities.set(entity, entityVar);
				// create types
				let typesVar= f.createUniqueName(entity.name+'Types');
				let types: ts.Identifier[]= [];
				if(circles.length===0){
					for(let i=0, tps= entity.types, len= tps.length; i<len; ++i){
						let t= tps[i];
						types.push(mapEntities.get(rootOutput.get(t.name!)!)!)
					}
				} else {
					for(let i=0, tps= entity.types, len= tps.length; i<len; ++i){
						let t= tps[i];
						if(circles.includes(t)===false)
							types.push(mapEntities.get(rootOutput.get(t.name!)!)!);
						mapCirlces.push({ entity, varname: typesVar , circles: circles.splice(0) });
					}
				}
				// Create object
				let unionImportedDescVar= _getLocalImport(entity.parser.fileName, entity.parser.className);
				let unionDesc=[
					f.createPropertyAssignment('name', f.createStringLiteral(entity.name)),
					f.createPropertyAssignment('types', typesVar),
					_createMethod('resolveType', ['value', 'ctx', 'info'], [
						f.createReturnStatement(
							f.createElementAccessExpression( typesVar, f.createCallExpression(
								f.createPropertyAccessExpression(unionImportedDescVar, f.createIdentifier('resolveType')),
								undefined, [
									f.createIdentifier("value"),
									f.createIdentifier("ctx"),
									f.createIdentifier("info")
								]
							))
						)
					])
				];
				if(entity.jsDoc!=null)
					unionDesc.push(f.createPropertyAssignment('description', f.createStringLiteral(entity.jsDoc)));
				graphqlDeclarations.push(
					// types
					f.createVariableDeclaration(
						typesVar, undefined, f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
						f.createArrayLiteralExpression(types, pretty)
					),
					// var
					f.createVariableDeclaration(entityVar, undefined, undefined, f.createNewExpression(
						GraphQLUnionType, undefined, [f.createObjectLiteralExpression(unionDesc, pretty)]
					))
				);
				break;
			case ModelKind.INPUT_FIELD:
				if(index===0){
					++currentNode.index;
					//* Resolve field
					queue.push({ entity: entity.type, isInput: true, index: 0 });
					continue rootLoop;
				} else if(fieldHasCircle){
					// Circle detected
					fieldHasCircle= false;
					circles.push(entity);
				}
				break;
			case ModelKind.OUTPUT_FIELD:
				switch(index){
					case 0:
						// Resolve type
						queue.push({ entity: entity.type, isInput: false, index: 0 });
						++currentNode.index;
						continue rootLoop;
					case 1:
						// Resolve param
						if(entity.param!=null && entity.param.type!=null){
							queue.push({ entity: entity.param.type, isInput: true, index: 0 });
							++currentNode.index;
							continue rootLoop;
						}
						break
					default:
						if(fieldHasCircle){
							// Circle detected
							fieldHasCircle= false;
							circles.push(entity);
						}
				}
				break;
			case ModelKind.LIST:
				if(index===0){
					++currentNode.index;
					queue.push({ entity: entity.type, isInput, index: 0 });
					continue rootLoop;
				}
				break;
			case ModelKind.REF:
				if(index===0){
					++currentNode.index;
					let refNode= isInput? rootInput.get(entity.name) : rootOutput.get(entity.name);
					if(refNode==null)
						throw new Error(`Enexpected Missing Entity "${entity.name}"`);
					if(mapEntities.has(refNode)){}
					else if(PATH.has(refNode)){
						//* Circle
						fieldHasCircle=true;
					} else {
						//* Parse new entity
						queue.push({ entity: refNode, isInput, index: 0 });
					}
					continue rootLoop;
				}
				break;
			case ModelKind.ENUM:
				//* ENUM
				entityVar= f.createUniqueName(entity.name);
				mapEntities.set(entity, entityVar);
				let enumValues: ts.PropertyAssignment[]= [];
				for(let i=0, members= entity.members, len= members.length; i<len; ++i){
					let member= members[i];
					let obj: {[k in keyof GraphQLEnumValueConfig]: any}= {
						value:	member.value
					};
					if(member.jsDoc)		obj.description= member.jsDoc;
					if(member.deprecated)	obj.deprecationReason= member.deprecated;
					enumValues.push(f.createPropertyAssignment(member.name, _serializeObject(obj) ))
				}
				let entityDesc: {[k in keyof GraphQLEnumTypeConfig]: any}= {
					name:	entity.name,
					values:	f.createObjectLiteralExpression(enumValues, pretty)
				};
				if(entity.jsDoc) entityDesc.description= entity.jsDoc;
				graphqlDeclarations.push(
					f.createVariableDeclaration(entityVar, undefined, undefined, f.createNewExpression(
						GraphQLEnumType, undefined, [_serializeObject(entityDesc)]
					))
				);
				break;
			case ModelKind.SCALAR:
				//* Scalar
				entityVar= f.createUniqueName(entity.name);
				mapEntities.set(entity, entityVar);
				let scalardesc: {[k in keyof GraphQLScalarTypeConfig<any, any>]: any}= {
					name:			entity.name,
					parseValue:		_getMethodCall(entity.parser, 'parse'),
					serialize:		_getMethodCall(entity.parser, 'serialize')
				};
				if(entity.jsDoc) scalardesc.description= entity.jsDoc;
				graphqlDeclarations.push(
					f.createVariableDeclaration(entityVar, undefined, undefined, f.createNewExpression(
						GraphQLScalarType, undefined, [_serializeObject(scalardesc)]
					))
				);
				break;
			case ModelKind.BASIC_SCALAR:
				entityVar= f.createUniqueName(entity.name);
				mapEntities.set(entity, entityVar);
				switch(entity.name){
					// Graphql basic scalars
					case 'Int':		gqlImports.push('GraphQLInt', entityVar); break;
					case 'string':	gqlImports.push('GraphQLString', entityVar); break;
					case 'number':	gqlImports.push('GraphQLFloat', entityVar); break;
					case 'boolean':	gqlImports.push('GraphQLBoolean', entityVar); break;
					// tt-model basic scalars
					case 'uInt':
						let uIntScalar= f.createUniqueName('uIntScalar');
						ttModelImports.push('uIntScalar', uIntScalar);
						_createBasicScalar(entity.name, entityVar, uIntScalar);
						break;
					case 'uFloat':
						let uFloatScalar= f.createUniqueName('uFloatScalar');
						ttModelImports.push('uFloatScalar', uFloatScalar);
						_createBasicScalar(entity.name, entityVar, uFloatScalar);
						break;
					default:
						throw new Error(`Unknown basic scalar: ${entity.name}`);
				}
				break;
			default:
				let nver: never= entity;
				// @ts-ignore
				throw new Error(`Enexpected kind: ${ModelKind[entity.kind]}`);
		}
		// Entity resolved
		queue.pop();
	}

	//* Create block statement
	const statmentsBlock: ts.Statement[]= [
		// Validation
		f.createVariableStatement(
			undefined,
			f.createVariableDeclarationList(validationDeclarations)
		),
		// Graphql schema
		f.createVariableStatement(
			undefined,
			f.createVariableDeclarationList(graphqlDeclarations)
		)
	];
	//* Imports
	var gqlImportsF: ts.ImportSpecifier[]= [];
	for(let i=0, len= gqlImports.length; i<len;){
		gqlImportsF.push(f.createImportSpecifier(
			f.createIdentifier(gqlImports[i++] as string),
			gqlImports[i++] as ts.Identifier
		));
	}
	var ttImportsF: ts.ImportSpecifier[]= [];
	for(let i=0, len= ttModelImports.length; i<len;){
		ttImportsF.push(f.createImportSpecifier(
			f.createIdentifier(ttModelImports[i++] as string),
			ttModelImports[i++] as ts.Identifier
		));
	}
	const imports: ts.ImportDeclaration[]= [
		// Graphql imports
		f.createImportDeclaration(undefined, undefined, f.createImportClause(
			false, undefined, f.createNamedImports(gqlImportsF)), f.createStringLiteral('graphql')),
		// tt-model imports
		f.createImportDeclaration(undefined, undefined, f.createImportClause(
			false, undefined, f.createNamedImports(ttImportsF)), f.createStringLiteral('tt-model'))
	];
	// Add other imports
	var importIt= srcImports.entries();
	while(true){
		let n= importIt.next();
		if(n.done) break;
		let [filename, mp]= n.value;
		let sbIt= mp.entries();
		let specifiers: ts.ImportSpecifier[]= [];
		while(true){
			let n2= sbIt.next();
			if(n2.done) break;
			let [classname, tmpVar]= n2.value;
			specifiers.push( f.createImportSpecifier(f.createIdentifier(classname), tmpVar) );
		}
		// FIXME: convert fileName to relative path!
		imports.push(f.createImportDeclaration(undefined, undefined, f.createImportClause(
			false, undefined, f.createNamedImports(specifiers)), f.createStringLiteral(filename)));
	}
	//* RETURN
	return {
		imports,
		node: f.createCallExpression(
			f.createParenthesizedExpression(f.createFunctionExpression(
				undefined,
				undefined,
				undefined,
				undefined,
				[],
				undefined,
				f.createBlock( statmentsBlock, pretty )
			)), undefined, []
		)
	}
	/** Create basic scalar */
	function _createBasicScalar(scalarName: string, scalarVar: ts.Identifier, scalarDescVar: ts.Identifier){
		let uIntConf: {[k in keyof GraphQLScalarTypeConfig<any, any>]: any}= {
			name:			scalarName,
			parseValue:		f.createPropertyAccessExpression(scalarDescVar, f.createIdentifier('parse')),
			serialize:		f.createPropertyAccessExpression(scalarDescVar, f.createIdentifier('serialize'))
		};
		// if(comment!=null) uIntConf.description= comment;
		graphqlDeclarations.push(
			f.createVariableDeclaration(scalarVar, undefined, undefined, f.createNewExpression(
				GraphQLScalarType,
				undefined,
				[_serializeObject(uIntConf)]
			))
		)
	}
	/** serialize object */
	function _serializeObject(
		obj: Record<string, ts.Expression|string|number|boolean|undefined>
	){
		var fieldArr: ts.ObjectLiteralElementLike[]= [];
		for(let k in obj){
			let v= obj[k]
			if(v==null) v= f.createIdentifier('undefined');
			else if(typeof v==='string') v= f.createStringLiteral(v);
			else if(typeof v==='number') v= f.createNumericLiteral(v);
			else if(typeof v==='boolean') v= v===true ? f.createTrue() : f.createFalse();
			fieldArr.push(
				f.createPropertyAssignment( f.createIdentifier(k), v ),
			)
		}
		return f.createObjectLiteralExpression(fieldArr, pretty)
	}
	/** Generate method call */
	function _getMethodCall(method: MethodDescriptor, methodName?: string){
		var varId= _getLocalImport(method.fileName, method.className);
		methodName??= method.name!;
		return f.createPropertyAccessExpression(
			varId,
			f.createIdentifier(method.isStatic===true ? methodName : `prototype.${methodName}`)
		);
	}
	/** Get import var from locale source */
	function _getLocalImport(fileName: string, className: string){
		var fl= srcImports.get(fileName);
		if(fl==null){
			fl= new Map();
			srcImports.set(fileName, fl);
		}
		var vr= fl.get(className);
		if(vr==null){
			vr= f.createUniqueName(className);
			fl.set(className, vr);
		}
		return vr;
	}
	/** Compile field */
	function _compileField(field: formatedInputField | formatedOutputField): ts.Expression {
		if(field.kind===ModelKind.INPUT_FIELD){
			let obj: {[k in keyof GraphQLInputFieldConfig]: any}= {
				type:			_compileFieldPart(field.type, true),
			};
			if(field.defaultValue!= null) obj.defaultValue= field.defaultValue;
			if(field.deprecated!=null) obj.deprecationReason= field.deprecated;
			if(field.jsDoc!=null) obj.description= field.jsDoc;
			return _serializeObject(obj);
		} else {
			let obj: {[k in keyof GraphQLFieldConfig<any,any, any>]: any}= {
				type:			_compileFieldPart(field.type, false),
			};
			if(field.deprecated!=null) obj.deprecationReason= field.deprecated;
			if(field.jsDoc!=null)	obj.description= field.jsDoc;
			if(field.param!=null && field.param.type!=null){
				let ref= field.param.type;
				let refNode= rootInput.get(ref.name);
				if(refNode==null) throw new Error(`Enexpected missing entity "${ref.name}" at ${_printStack()}`);
				if(refNode.kind!==ModelKind.FORMATED_INPUT_OBJECT)
					throw new Error(`Enexpected kind "${ModelKind[refNode.kind]}" of ${field.name}. Expected "FormatedInputObject" at ${_printStack()}`);
				let param: Record<string, any>= {};
				for(let i=0, flds= refNode.fields, len= flds.length; i<len; ++i){
					param[field.alias??field.name]= _compileField(flds[i]);
				}
				obj.args= _serializeObject(param);
			}
			//TODO add validator
			if(field.method!=null)	obj.resolve= _getMethodCall(field.method);
			return _serializeObject(obj);
		}
	}
	/** Compile field's type or param */
	function _compileFieldPart(part: formatedInputField | formatedOutputField | Reference | List, isInput: boolean){
		// Get wrappers (List, Optionnal)
		let wrappers: number[]= [];
		// let wrappers= field.required ? [1] : [];
		while(part.kind!== ModelKind.REF){
			if(part.required) wrappers.push(1);
			if(part.kind===ModelKind.LIST) wrappers.push(0);
			part= part.type;
			if(part==null)
				throw new Error(`Enexpected empty list! at: ${_printStack()}`);
		}
		var refNode= isInput? rootInput.get(part.name): rootOutput.get(part.name);
		if(refNode==null) throw new Error(`Enexpected missing entity "${part.name}" at ${_printStack()}`);
		var refNodeVar: ts.Expression|undefined= mapEntities.get(refNode);
		if(refNodeVar==null) throw new Error(`Enexpected missing entity var "${part.name}" at ${_printStack()}`);
		for(let i=0, len= wrappers.length; i<len; ++i){
			if(wrappers[i]===0) refNodeVar= f.createNewExpression(GraphQLList, undefined, [refNodeVar]);
			else refNodeVar= f.createNewExpression(GraphQLNonNull, undefined, [refNodeVar]);
		}
		return refNodeVar;
	}
	/** Generate method */
	function _createMethod(name: string, args: string[], body: ts.Statement[]) {
		var params= [];
		for(let i=0, len= args.length; i<len; ++i){
			params.push(f.createParameterDeclaration(
				undefined, undefined, undefined,
				f.createIdentifier('value'), undefined,
				f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), undefined
			));
		}
		return f.createMethodDeclaration(
			undefined, undefined, undefined,
			f.createIdentifier(name), undefined, undefined,
			params, undefined, f.createBlock(body, pretty)
		);
	}
	/** Print stack */
	function _printStack(){
		var stack= [];
		for(let i=0, len= queue.length; i<len; ++i){
			let entity= queue[i].entity;
			let entityName= (entity as FormatedInputNode).name;
			if(entityName!=null) stack.push(entityName)
		}
		return stack.join(' > ')
	}
}


/** Compiler response */
export interface GqlCompilerResp{
	imports:	ts.ImportDeclaration[]
	node:		ts.CallExpression
}
/** Queue interface */
interface QueueInterface{
	entity:		FormatedOutputNode|FormatedInputNode|formatedInputField|formatedOutputField|FieldType
	isInput:	boolean
	/** Current field index (plain_object) */
	index:		number
	// /** Fields with cicles */
	// circles:	ObjectField[]
	// /** Parent node in case of Plain_object */
	// parent?:		QueueInterface
}

/** Map circle entities */
interface CircleEntities {
	entity:		FormatedInputObject|FormatedOutputObject|Union,
	varname:	ts.Identifier,
	/** Fields with circles */
	circles:	(formatedInputField|formatedOutputField|Reference)[]
}
