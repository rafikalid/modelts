import { GqlField, GqlListNode } from "@src/compiler/gql-model";
import { InputResolver } from "@src/helpers/interfaces";
import { EnumMember, MethodDescriptor, ModelBasicScalar, ModelKind, ModelListNode, ModelNode, ModelObjectNode, ModelParam, ModelRefNode, ModelRoot, ModelScalarNode, ModelUnionNode, ObjectField } from "@src/schema/model";
import { compileAsserts } from "@src/transformer/ast-compile-assert";
import { GraphQLArgumentConfig, GraphQLEnumTypeConfig, GraphQLFieldConfig, GraphQLInputField, GraphQLInputFieldConfig, GraphQLScalarTypeConfig, GraphQLUnionTypeConfig } from "graphql";
import ts, { isJSDoc } from 'typescript';

/** Compiler response */
export interface GqlCompilerResp{
	imports: ts.ImportDeclaration[]
	node: ts.CallExpression
}
/** Map entity to TYPSCRIPT var */
interface MapRef{
	input?:		ts.Identifier
	output?:	ts.Identifier
}

interface CircleEntities{
	entity: ModelObjectNode,
	isInput: boolean,
	fieldsVar: ts.Expression,
	/** Fields with circles */
	fields: ObjectField[]
}

interface ParamItem{
	var: ts.Identifier
	len: number
}
/**
 * Compile Model to Graphql
 */
export function compileGraphQL(factory: ts.NodeFactory, pretty: boolean, importsMapper: Map<string, Map<string, ts.Identifier>>, ast: ModelRoot):GqlCompilerResp{
	/** Map entity to TYPSCRIPT var */
	const mapNodeVar: Map<ModelNode, MapRef>= new Map();
	const paramsEntityVars: Map<ModelNode, ParamItem>= new Map();
	/** Circle fields */
	const circleMapFields:CircleEntities[]= [];
	const circleVldMapFields:CircleEntities[]= [];
	/** Entity names: add new names for INPUT or OUTPUT */
	const entityNameSet: Set<string>= new Set();
	var entitiesMap= ast.mapChilds, entity: ModelNode;
	/** Variable declaration list */
	const varDeclarationList: ts.VariableDeclaration[]= [];
	/** Validation schema decaration */
	const inputValidationDeclarationList: ts.VariableDeclaration[]= [];
	/** map imports */
	const importGqlVars: Map<string, ts.Identifier>= new Map();
	const GraphQLScalarTypeVar= factory.createUniqueName('GraphQLScalarType');
	const GraphQLSchemaVar= factory.createUniqueName('GraphQLSchema');
	const GraphQLEnumTypeVar= factory.createUniqueName('GraphQLEnumType');
	const GraphQLObjectTypeVar = factory.createUniqueName('GraphQLObjectType');
	const GraphQLInputObjectTypeVar = factory.createUniqueName('GraphQLInputObjectType');
	const GraphQLListVar= factory.createUniqueName('GraphQLList');
	const GraphQLNonNullVar= factory.createUniqueName('GraphQLNonNull');
	const GraphQLUnionTypeVar= factory.createUniqueName('GraphQLUnionType');
	const GraphQLFieldResolverVar= factory.createUniqueName('GraphQLFieldResolver');
	importGqlVars
		.set('GraphQLScalarType', GraphQLScalarTypeVar)
		.set('GraphQLSchema', GraphQLSchemaVar)
		.set('GraphQLEnumType', GraphQLEnumTypeVar)
		.set('GraphQLObjectType', GraphQLObjectTypeVar)
		.set('GraphQLInputObjectType', GraphQLInputObjectTypeVar)
		.set('GraphQLList', GraphQLListVar)
		.set('GraphQLNonNull', GraphQLNonNullVar)
		.set('GraphQLUnionType', GraphQLUnionTypeVar)
		.set('GraphQLFieldResolver', GraphQLFieldResolverVar);
	//* Model imports
	const uIntScalarVar= factory.createUniqueName('uIntScalar');
	const uFloatScalar= factory.createUniqueName('uFloatScalar');
	const inputValidationWrapperVar= factory.createUniqueName('inputValidationWrapper');
	// Queue
	interface QueueInterface{
		entity:		ModelNode
		isInput:	boolean
		/** Current field index (plain_object) */
		index:		number
		/** Entity name */
		entityName: string|undefined,
		/** Fields with cicles */
		circles:	ObjectField[]
		/** Parent node in case of Plain_object */
		parent?:		QueueInterface
	}
	//* Go through Model
	const queue: QueueInterface[]= [];
	// Add interface nodes
	if(entity= entitiesMap.Query) queue.push({entity, isInput: false, index: 0, entityName: 'Query', circles: []});
	if(entity= entitiesMap.Mutation) queue.push({entity, isInput: false, index: 0, entityName: 'Mutation', circles: []});
	if(entity= entitiesMap.Subscription) queue.push({entity, isInput: false, index: 0, entityName: 'Subscription', circles: []});
	var entityVar: ts.Identifier;
	var inputValidationVar: ts.Identifier;
	var childs: ModelNode[];
	/** Union types */
	const unionTypes: {entity: ModelUnionNode, var: ts.Identifier}[]= [];
	/** Path for output */
	const outputPath: Set<ModelNode>= new Set();
	/** Path for input */
	const inputPath: Set<ModelNode>= new Set();
	while(true){
		let queueLen= queue.length;
		if(queueLen===0) break;
		let currentNode= queue[queueLen-1];
		let {entity, isInput, index, entityName}= currentNode;
		let path= isInput ? inputPath : outputPath;
		//* Entity name
		if(entityName== null){
			entityName= (entity as ModelObjectNode).name!;
			entityName= entityName.replace(/</g, '_').replace(/>/g, '');
			if(entityNameSet.has(entityName)){
				entityName+= isInput ? 'Input_' : 'Output_';
				let i=0;
				let str: string;
				do{
					str= entityName+(i++);
				}while(entityNameSet.has(str));
				entityName= str;
			} else {
				entityNameSet.add(entityName);
			}
			currentNode.entityName= entityName;
		}
		/** Entity var */
		entityVar= factory.createUniqueName(entityName);
		inputValidationVar= factory.createUniqueName(entityName);
		let isResolved= true;
		// Switch Node type:
		switch(entity.kind){
			/** Plain Object field */
			case ModelKind.FIELD:
				let field= entity as ObjectField;
				let flen= isInput? 1: 2;
				fieldw: while(index<flen){
					let child: ModelNode;
					++index;
					if(index===1)
						child= isInput ? field.children[0] : (field.resolver?.children[0] ?? field.children[0]);
					else if(child= field.resolver?.children[1]!){// 2 as input
						isInput= true;
					} else break;
					if(child==null) throw new Error(`Enexpected empty child at: ${currentNode.parent!.entity.name}.${field.name}`);
					// Escape wrapping list
					while(child.kind!== ModelKind.REF){
						child= (child as ObjectField).children[0];
						if(child==null) break fieldw;
							//throw new Error(`Enexpected empty child! at ${currentNode.parent!.entity.name}.${field.name}`);
					}
					let refNode= entitiesMap[child.name!];
					if(index===1){
						//* Type
						let refNodeEl: ts.Expression|undefined= isInput ? mapNodeVar.get(refNode)?.input : mapNodeVar.get(refNode)?.output;
						if(refNodeEl==null){
							isResolved= false;
							// Check for circles
							if(path.has(refNode)){
								currentNode.parent!.circles.push(field);
							} else {
								// Go dept
								path.add(refNode);
								queue.push({ entity: refNode, isInput, index: 0, entityName: undefined, circles: []});
							}
							break;
						}
					} else {
						//* Param
						isResolved = false;
						queue.push({ entity: refNode, isInput: true, index: 0, entityName: undefined, circles: []});
					}
				}
				currentNode.index= index;
				break;
			/** Plain Object */
			case ModelKind.PLAIN_OBJECT:
				//* Plain object: Check if all fields are resolved
				childs= entity.children;
				let len= childs.length;
				// while(index<len){
				if(index<len){
					path.add(entity);
					queue.push({ entity: childs[index++] as ObjectField, isInput, index: 0, entityName: undefined, circles: [], parent: currentNode});
					isResolved= false; 
				}
				// }
				if(isResolved){
					//* All fields resolved
					if(currentNode.circles.length){
						// Create fields with no circles
						let fieldsVar= factory.createUniqueName(entityName+'_fileds');
						let fields: Record<string, ts.Expression>= {};
						let childs= entity.children;
						let circles= currentNode.circles;
						for(let i=0, len= childs.length; i<len; ++i){
							let field= childs[i] as ObjectField;
							if(circles.indexOf(field)===-1){
								fields[field.name!]= compileFields(entity, field, isInput);
							}
						}
						circleMapFields.push({ entity, isInput, fieldsVar, fields: circles });
						// Create Object
						let obj: Record<string, any>= {
							name:			entityName,
							fields:			fieldsVar,
						};
						if(entity.jsDoc) obj.description= entity.jsDoc;
						varDeclarationList.push(
							// Field var
							factory.createVariableDeclaration(
								fieldsVar,
								undefined,
								factory.createTypeReferenceNode(
									factory.createIdentifier("Record"),
									[
										factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
										factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
									]
								),
								serializeObject(factory, pretty, fields)
							),
							// Object
							createNewVarExpression(pretty, factory, entityVar,
								isInput ? GraphQLInputObjectTypeVar: GraphQLObjectTypeVar,
								serializeObject(factory, pretty, obj)
							)
						);
					} else {
						varDeclarationList.push(_compilePlainObject(entity, entityName, entityVar, isInput));
					}
					if(isInput) _compileInputValidation(inputValidationDeclarationList, entity, entityName, inputValidationVar, currentNode.circles);
					_addMapNodeVar(mapNodeVar, entity, entityVar, isInput);
				} else {
					//* Missing fields
					currentNode.index= index;
				}
				break;
			case ModelKind.ENUM:
				//* ENUM
				let enumValues: ts.PropertyAssignment[]= [];
				childs= entity.children;
				for(let i=0, len= childs.length; i<len; ++i){
					let child= childs[i];
					let obj:Record<string, any>= {
						value: (child as EnumMember).value
					};
					if(child.jsDoc) obj.description= child.jsDoc;
					if(child.deprecated) obj.deprecationReason= child.deprecated;
					enumValues.push(factory.createPropertyAssignment(child.name!, serializeObject(factory, pretty, obj) ))
				}
				let entityDesc: {[k in keyof GraphQLEnumTypeConfig]: any}= {
					name:	entityName,
					values: factory.createObjectLiteralExpression(enumValues, pretty)
				};
				if(entity.jsDoc) entityDesc.description= entity.jsDoc;
				varDeclarationList.push(createNewVarExpression(
					pretty, factory, entityVar, GraphQLEnumTypeVar, serializeObject(factory, pretty, entityDesc)
				));
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.UNION:
				//* UNION
				if(mapNodeVar.has(entity)) break;
				let unionTypesVar= factory.createUniqueName(entityName+'_types');
				let uParser= entity.parser as MethodDescriptor;
				let unionImportedDescVar= importsMapper.get(uParser.fileName)!.get(uParser.className)!;
				if(unionImportedDescVar==null)
					throw new Error(`UNION>> Expected parser from "${uParser.fileName}::${uParser.className}"`);
				let unionFields= [
					factory.createPropertyAssignment('name', factory.createStringLiteral(entityName)),
					factory.createPropertyAssignment('types', unionTypesVar),
					factory.createMethodDeclaration(
						undefined, undefined, undefined,
						factory.createIdentifier('resolveType'), undefined, undefined,
						[
							factory.createParameterDeclaration(undefined, undefined, undefined, factory.createIdentifier('value'), undefined, factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), undefined),
							factory.createParameterDeclaration(undefined, undefined, undefined, factory.createIdentifier('ctx'), undefined, factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), undefined),
							factory.createParameterDeclaration(undefined, undefined, undefined, factory.createIdentifier('info'), undefined, factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), undefined),
						], undefined,
						factory.createBlock([
							factory.createReturnStatement(factory.createElementAccessExpression(
								unionTypesVar,
								factory.createCallExpression(
									factory.createPropertyAccessExpression(unionImportedDescVar, factory.createIdentifier('resolveType')),
									undefined,
									[
										factory.createIdentifier("value"),
										factory.createIdentifier("ctx"),
										factory.createIdentifier("info")
									]
								)
							))
						], pretty)
					)
				];
				if(entity.jsDoc)
					unionFields.push(factory.createPropertyAssignment('description', factory.createStringLiteral(entity.jsDoc)));
				varDeclarationList.push(
					factory.createVariableDeclaration(unionTypesVar, undefined, factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), factory.createArrayLiteralExpression([], pretty)),
					createNewVarExpression(
						pretty, factory, entityVar, GraphQLUnionTypeVar,
						factory.createObjectLiteralExpression(unionFields, pretty)
					)
				);
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				unionTypes.push({entity, var: unionTypesVar});
				//* Resolve types
				let uTypes= entity.children;
				let uLen= uTypes.length;
				while(index < uLen){
					isResolved= false;
					let child= uTypes[index++];
					if(child.kind !== ModelKind.REF) throw new Error(`Exprected references for UNION at: ${entity.name}`);
					let refNode= entitiesMap[child.name!];
					if(refNode==null) throw new Error(`Union>> Missing reference: ${entity.name}.${child.name}`);
					if(mapNodeVar.get(refNode)?.output==null){
						path.add(refNode);
						queue.push({ entity: refNode, isInput: false, index: 0, entityName: undefined, circles: []});
						break;
					}
				}
				currentNode.index= index;
				break;
			case ModelKind.SCALAR:
				//* Scalar
				let scalardesc: {[k in keyof GraphQLScalarTypeConfig<any, any>]: any}= {
					name:			entityName,
					parseValue:		genMethodCall(factory, (entity as ModelScalarNode<any>).parser as MethodDescriptor, 'parse'),
					serialize:		genMethodCall(factory, (entity as ModelScalarNode<any>).parser as MethodDescriptor, 'serialize')
				};
				if(entity.jsDoc) scalardesc.description= entity.jsDoc;
				varDeclarationList.push(
					createNewVarExpression(
						pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, scalardesc)
					)
				);
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.BASIC_SCALAR:
				switch(entityName){
					case 'Int':
						// entityVar= factory.createUniqueName('gqlInt');
						importGqlVars.set('GraphQLInt', entityVar);
						break;
					case 'string':
						// entityVar= factory.createUniqueName('gqlString');
						importGqlVars.set('GraphQLString', entityVar);
						break;
					case 'number':
						// entityVar= factory.createUniqueName('gqlNumber');
						importGqlVars.set('GraphQLFloat', entityVar);
						break;
					case 'boolean':
						// entityVar= factory.createUniqueName('gqlBoolean');
						importGqlVars.set('GraphQLBoolean', entityVar);
						break;
					case 'uInt':
						// entityVar= factory.createUniqueName(entityName);
						let uIntConf: {[k in keyof GraphQLScalarTypeConfig<any, any>]: any}= {
							name:			entityName,
							parseValue:		factory.createPropertyAccessExpression(uIntScalarVar, factory.createIdentifier('parse')),
							serialize:		factory.createPropertyAccessExpression(uIntScalarVar, factory.createIdentifier('serialize'))
						};
						if(entity.jsDoc) uIntConf.description= entity.jsDoc;
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, uIntConf)
							)
						)
						break;
					case 'uFloat':
						// entityVar= factory.createUniqueName(entityName);
						let uFloatConf: {[k in keyof GraphQLScalarTypeConfig<any, any>]: any}= {
							name:			entityName,
							parseValue:		factory.createPropertyAccessExpression(uFloatScalar, factory.createIdentifier('parse')),
							serialize:		factory.createPropertyAccessExpression(uFloatScalar, factory.createIdentifier('serialize'))
						};
						if(entity.jsDoc) uFloatConf.description= entity.jsDoc;
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, uFloatConf)
							)
						)
						break;
					default:
						throw new Error(`Unknown basic scalar: ${entityName}`);
				}
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
		}
		// remove last node
		if(isResolved){
			path.delete(entity);
			queue.pop();
		}
	}

	// add variable declarations
	const statmentsBlock: ts.Statement[]= [
		// Validation
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(inputValidationDeclarationList)
		),
		// Graphql schema
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(varDeclarationList)
		)
	];
	//* Resolve validation circles
	for(let i=0, len= circleVldMapFields.length; i<len; ++i){
		let {entity, fieldsVar, fields}= circleVldMapFields[i];
		let desc= paramsEntityVars.get(entity)!
		if(desc==null) throw new Error(`Enexpected missing var for entity validation for: ${entity.name}`);
		for(let j=0, jlen= fields.length; j<jlen; ++j){
			let field= fields[j] as ObjectField;
			let f= _compileVldField(entity, field);
			if(f!=null){
				++desc.len;
				statmentsBlock.push(
					factory.createExpressionStatement(factory.createCallExpression(
						factory.createPropertyAccessExpression( fieldsVar, factory.createIdentifier("push")),
						undefined, [ f ]
					))
				);
			}
		}
	}
	// Resolve circles
	for(let i=0, len= circleMapFields.length; i<len; ++i){
		let {entity, fieldsVar, isInput, fields}= circleMapFields[i];
		for(let j=0, jlen= fields.length; j<jlen; ++j){
			let field= fields[j] as ObjectField;
			statmentsBlock.push(
				factory.createExpressionStatement(
					factory.createBinaryExpression(
						factory.createPropertyAccessExpression(
							fieldsVar, factory.createIdentifier(field.name!)
						),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						compileFields(entity, field, isInput)
					)
				)
			);
		}
	}
	//* Resolve unions
	for(let i=0, len= unionTypes.length; i<len; ++i){
		let {entity, var: varname}= unionTypes[i];
		let childs= entity.children;
		let uTypes: ts.Expression[]= [];
		for(let j=0, jlen= childs.length; j<jlen; ++j){
			let refNode= entitiesMap[childs[j].name!];
			if(refNode==null)
				throw new Error(`Missing entity: ${childs[j].name!}. Found at UNION : ${entity.name}`);
			let refNodeTs: ts.Expression|undefined= mapNodeVar.get(refNode)?.output;
			if(refNodeTs==null)
				throw new Error(`Enexpected missing UNION: ${refNode.name} at UNION: ${entity.name}`);
			uTypes.push(refNodeTs);
		}
		statmentsBlock.push(
			factory.createExpressionStatement(factory.createCallExpression(
				factory.createPropertyAccessExpression(varname, factory.createIdentifier('push')),
				undefined,
				uTypes
			))
		);
	}

	// Create imports
	var gqlImportSp: ts.ImportSpecifier[] = [];
	importGqlVars.forEach(function(v, k){
		gqlImportSp.push(factory.createImportSpecifier(factory.createIdentifier(k), v));
	});
	
	var importDeclarations= [
		// From graphql
		factory.createImportDeclaration(
			undefined, undefined,
			factory.createImportClause(false, undefined, factory.createNamedImports(gqlImportSp)),
			factory.createStringLiteral('graphql')
		),
		// From tt-model
		factory.createImportDeclaration(
			undefined, undefined,
			factory.createImportClause(false, undefined, factory.createNamedImports([
				factory.createImportSpecifier(factory.createIdentifier('uIntScalar'), uIntScalarVar),
				factory.createImportSpecifier(factory.createIdentifier('uFloatScalar'), uFloatScalar),
				factory.createImportSpecifier(factory.createIdentifier('inputValidationWrapper'), inputValidationWrapperVar)
			])),
			factory.createStringLiteral('tt-model')
		)
	];

	// Add return statement
	statmentsBlock.push(
		factory.createReturnStatement(createNewExp(factory, GraphQLSchemaVar, serializeObject(factory, pretty, {
			query:		mapNodeVar.get(entitiesMap.Query)?.output,
			mutation:	mapNodeVar.get(entitiesMap.Mutation)?.output
		})))
	);
	// return factory
	return {
		imports: importDeclarations,
		node: factory.createCallExpression(
			factory.createParenthesizedExpression(factory.createFunctionExpression(
				undefined,
				undefined,
				undefined,
				undefined,
				[],
				undefined,
				factory.createBlock( statmentsBlock, pretty )
			)), undefined, []
		)
	};
	/** Compile plain object */
	function _compilePlainObject(entity: ModelObjectNode, entityName: string, entityVar: ts.Identifier, isInput: boolean): ts.VariableDeclaration{
		let fields: Record<string, ts.Expression>= {};
		let childs= entity.children;
		for(let i=0, len= childs.length; i<len; ++i){
			let field= childs[i] as ObjectField;
			fields[field.name!]= compileFields(entity, field, isInput);
		}
		return createNewVarExpression(pretty, factory, entityVar,
			isInput ? GraphQLInputObjectTypeVar: GraphQLObjectTypeVar,
			serializeObject(factory, pretty, {
				name:			entityName,
				fields:			serializeObject(factory, pretty, fields),
				description:	entity.jsDoc
			})
		)
	}
	/** Compile validation input object */
	function _compileInputValidation(varList: ts.VariableDeclaration[], entity: ModelObjectNode, entityName: string, entityVar: ts.Identifier, circles?: ObjectField[]){
		let fields: ts.Expression[]= [];
		let childs= entity.children;
		if(circles==null || circles.length===0){
			//* Object has all it's fields
			for(let i=0, len= childs.length; i<len; ++i){
				let f= _compileVldField(entity, childs[i] as ObjectField)
				if(f!=null) fields.push(f);
			}
			// add object definition
			if(fields.length)
				varList.push(factory.createVariableDeclaration(
					entityVar, undefined,
					factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
					serializeObject(factory, pretty, {
						kind: ModelKind.PLAIN_OBJECT,
						fields: factory.createArrayLiteralExpression(fields, pretty)
					})
				));
		} else {
			//* Missing fields will be added later
			let fieldsVar= factory.createUniqueName(entityName+'_fileds');
			for(let i=0, len= childs.length; i<len; ++i){
				let field= childs[i] as ObjectField;
				if(circles.indexOf(field)===-1){
					let f= _compileVldField(entity, field)
					if(f!=null) fields.push(f);
				}
			}
			circleVldMapFields.push({ entity, isInput: true, fieldsVar, fields: circles });
			varList.push(
				// Fields
				factory.createVariableDeclaration(
					fieldsVar, undefined,
					factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
					factory.createArrayLiteralExpression(fields, pretty)
				),
				// Add object definition
				factory.createVariableDeclaration(
					entityVar, undefined,
					factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
					serializeObject(factory, pretty, {
						kind: ModelKind.PLAIN_OBJECT,
						fields: fieldsVar
					})
				)
			);
		}
		paramsEntityVars.set(entity, {var: entityVar, len: fields.length});
	}
	/** Compile validation field */
	type compileTargetTypes= ObjectField|ModelListNode|ModelRefNode;
	function _compileVldField(entity: ModelObjectNode, field: ObjectField): ts.ObjectLiteralExpression|undefined{
		if(field.asserts!=null || field.input!=null){
			// Wrappers (list, required)
			var fieldProperties: ts.ObjectLiteralElementLike[]= [
				factory.createPropertyAssignment('kind', factory.createNumericLiteral(ModelKind.FIELD)),
				factory.createPropertyAssignment('name', factory.createStringLiteral(field.name))
			];
			var parentProperties: ts.ObjectLiteralElementLike[]|undefined;
			let child: compileTargetTypes= field;
			while(child.kind!== ModelKind.REF){
				let properties: ts.ObjectLiteralElementLike[];
				if(parentProperties==null){
					properties= fieldProperties;
				} else {
					// LIST
					properties= [];
					parentProperties.push(
						factory.createPropertyAssignment('type', factory.createObjectLiteralExpression(properties, pretty))
					);
				}
				// Input
				if(child.input!=null)
					properties.push(factory.createPropertyAssignment('input', genMethodCall(factory, child.input)));
				// Asserts
				let assertTs: ts.MethodDeclaration | undefined;
				if(child.asserts!=null && (assertTs= compileAsserts(`${entity.name}.${field.name}`, child.asserts, field.children[0], factory, pretty))!= null)
					properties.push(assertTs);
				// Next
				parentProperties= properties;
				child= (child as ObjectField).children[0] as compileTargetTypes;
				if(child==null)
					throw new Error(`Validation>> Enexpected empty list! at ${entity.name}.${field.name}`);
			}
			
			// Resolve reference
			let refNode= entitiesMap[child.name!];
			if(refNode==null) throw new Error(`Missing entity: ${child.name}. Found at: ${entity.name}.${field.name}`);
			let refNodeTs: ts.Expression|undefined= paramsEntityVars.get(refNode)?.var;
			if(refNodeTs!=null){
				parentProperties?.push(factory.createPropertyAssignment('type', refNodeTs));
			}
			// return field
			return factory.createObjectLiteralExpression(fieldProperties, pretty);
		}
	}
	/** Compile each field part */
	function compileEachFieldPart(entity: ModelObjectNode, field: ObjectField, child: ModelNode, isInput: boolean): ts.Expression{
		// Wrappers (list, required)
		let wrappers= field.required ? [1] : [];
		while(child.kind!== ModelKind.REF){
			if((child as ObjectField).required) wrappers.push(1);
			if(child.kind=== ModelKind.LIST) wrappers.push(0);
			child= (child as ObjectField).children[0];
			if(child==null)
				throw new Error(`Enexpected empty list! at ${entity.name}.${field.name}`);
		}
		// Resolve reference
		let refNode= entitiesMap[child.name!];
		if(refNode==null)
			throw new Error(`Missing entity: ${child.name}. Found at: ${entity.name}.${field.name}`);
		let refNodeTs: ts.Expression|undefined= isInput ? mapNodeVar.get(refNode)?.input : mapNodeVar.get(refNode)?.output;
		if(refNodeTs==null){
			throw new Error(`Enexpected missing entity ${isInput? 'Input': 'Output'}: ${refNode.name} at ${entity.name}.${field.name}`);
		}
		// Put wrappers
		for(let i=0, len= wrappers.length; i<len; ++i){
			if(wrappers[i]===0) refNodeTs= factory.createNewExpression(GraphQLListVar, undefined, [refNodeTs]);
			else refNodeTs= factory.createNewExpression(GraphQLNonNullVar, undefined, [refNodeTs]);
		}
		return refNodeTs;
	}
	/** Compile object fields */
	function compileFields(entity: ModelObjectNode, field: ObjectField, isInput: boolean): ts.ObjectLiteralExpression{
		//* Resolve type
		var child= isInput ? field.children[0] : field.resolver?.children[0] ?? field.children[0];
		var refNodeTs= compileEachFieldPart(entity, field, child, isInput);
		//* Result
		var result: ts.ObjectLiteralExpression;
		if(isInput){
			let obj: {[k in keyof GraphQLInputFieldConfig]: any}= {
				type: refNodeTs,
				// TODO defaultValue
			};
			if(field.jsDoc) obj.description= field.jsDoc;
			if(field.deprecated) obj.deprecationReason= field.deprecated;
			result= serializeObject(factory, pretty, obj);
		} else {
			let obj: {[k in keyof GraphQLFieldConfig<any,any, any>]: any}= {
				type:				refNodeTs,
				//TODO args?:		GraphQLFieldConfigArgumentMap;
			};
			let deprecated= field.resolver?.deprecated ?? field.deprecated;
			if(deprecated) obj.deprecationReason= deprecated;
			let comment= field.resolver?.jsDoc ?? field.jsDoc;
			if(comment) obj.description= comment;
			//* Resolver method
			if(field.resolver?.method){
				// Method signature
				let resolveCb= genMethodCall(factory, field.resolver!.method);
				// Method Params
				let child= field.resolver.children[1] as ModelParam;
				if(child!=null && child.children.length!==0){
					let ref= child.children[0] as ModelRefNode;
					let paramEntity: ModelObjectNode;
					if(
						ref.kind !== ModelKind.REF
						|| !(paramEntity= entitiesMap[ref.name!] as ModelObjectNode)
						|| paramEntity.kind!== ModelKind.PLAIN_OBJECT
						) throw new Error(`GraphQl expects a plain object as Param. At: ${entity.name}.${field.name}`);
					let childs= paramEntity.children;
					if(childs.length===0) throw new Error(`Empty params detected at: ${entity.name}.${field.name}::${ref.name}`)
					let param: Record<string, any>= {};
					for(let i=0, len= childs.length; i<len; ++i){
						let pField= childs[i] as ObjectField;
						if(pField.children[0]){
							let arg: {[k in keyof GraphQLArgumentConfig]: any}= { type: compileEachFieldPart(paramEntity, pField, pField.children[0], true) };
							if(pField.jsDoc) arg.description= pField.jsDoc;
							if(pField.defaultValue) arg.defaultValue= pField.defaultValue;
							if(pField.deprecated) arg.deprecationReason= pField.deprecated;
							param[pField.name!]= serializeObject(factory, pretty, arg);
						}
					}
					obj.args= serializeObject(factory, pretty, param);
					// Wrap resolver
					obj.resolve= _wrapResolver(resolveCb, paramEntity);
				} else {
					obj.resolve= _wrapResolver(resolveCb);
				}
			}
			// Add
			result= serializeObject(factory, pretty, obj);
		}
		return result;
	}
	/** Generate methods call */
	function genMethodCall(factory: ts.NodeFactory, r: MethodDescriptor, methodName?:string): ts.Expression{
		var varId= importsMapper.get(r.fileName)!.get(r.className)!;
		methodName??= r.name;
		return factory.createPropertyAccessExpression(
			varId,
			factory.createIdentifier(r.isStatic ? methodName! : `prototype.${methodName}`)
		);
	}
	/** Generate resolver with validation & input wrapper */
	function _wrapResolver(resolveCb: ts.Expression, inputEntity?: ModelObjectNode): ts.Expression{
		//* Collect input resolvers & validation
		var vr: ParamItem
		if(inputEntity!=null && (vr= paramsEntityVars.get(inputEntity)!)!=null && vr.len > 0){
			resolveCb= factory.createCallExpression(inputValidationWrapperVar, undefined, [vr.var, resolveCb]);
		}
		//* Return
		return factory.createAsExpression(
			resolveCb,
			factory.createTypeReferenceNode(
				GraphQLFieldResolverVar,
				[
				factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
				factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
				]
			)
		);
	}
}

// Add var 
function _addMapNodeVar(mapNodeVar: Map<ModelNode, MapRef>, entity: ModelNode, varname: ts.Identifier, isInput: boolean){
	var c= mapNodeVar.get(entity);
	if(c==null){
		c= {input: undefined, output: undefined};
		mapNodeVar.set(entity, c);
	}
	if(isInput) c!.input= varname;
	else c!.output= varname;
}

/** Create new express */
function createNewVarExpression(
	pretty: boolean,
	factory: ts.NodeFactory,
	varname: ts.Identifier,
	constructVar: ts.Identifier,
	arg: ts.Expression
){
	// return
	return factory.createVariableDeclaration(
		varname,
		undefined,
		undefined,
		factory.createNewExpression(
			constructVar,
			undefined,
			[arg]
		)
	);
}
/** Wrap new expression */
function createNewExp(
	factory: ts.NodeFactory,
	constructVar: ts.Identifier,
	vl: ts.Expression
){
	// return
	return factory.createNewExpression(
			constructVar,
			undefined,
			[vl]
		);
}

/** Serialize object */
function serializeObject(
	factory: ts.NodeFactory,
	pretty: boolean,
	fields: Record<string, ts.Expression|string|number|boolean|undefined>
){
	var fieldArr: ts.ObjectLiteralElementLike[]= [];
	for(let k in fields){
		let v= fields[k]
		if(v==null) v= factory.createIdentifier('undefined');
		else if(typeof v==='string') v= factory.createStringLiteral(v);
		else if(typeof v==='number') v= factory.createNumericLiteral(v);
		else if(typeof v==='boolean') v= v===true ? factory.createTrue() : factory.createFalse();
		fieldArr.push(
			factory.createPropertyAssignment( factory.createIdentifier(k), v ),
		)
	}
	return factory.createObjectLiteralExpression(fieldArr, pretty)
}

// /** Create function wrapper */
// function createWrapper(
// 	pretty: boolean,
// 	factory: ts.NodeFactory,
// 	params: readonly ts.ParameterDeclaration[] | undefined,
// 	block: readonly ts.Statement[]
// ){
// 	return factory.createFunctionExpression(undefined, undefined, undefined, undefined, params, undefined, factory.createBlock(block, pretty));
// }

/** Collection input resolvers & asserts */
function getInputResolverAndAssertsOfFiled(factory: ts.NodeFactory, field: ObjectField, pretty: boolean): ts.ArrayLiteralExpression | undefined{
	var result: ts.Expression[]=[];
	
	if(result.length) return factory.createArrayLiteralExpression(result, pretty);
}