import { EnumMember, ModelBasicScalar, ModelKind, ModelNode, ModelObjectNode, ModelRoot, ModelScalarNode, ObjectField } from "@src/schema/model";
import { GraphQLFieldConfigMap } from "graphql";
import ts from 'typescript';

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
	fieldsVar: ts.Expression
}
/**
 * Compile Model to Graphql
 */
export function compileGraphQL(factory: ts.NodeFactory, ast: ModelRoot, pretty: boolean):GqlCompilerResp{
	/** Map entity to TYPSCRIPT var */
	const mapNodeVar: Map<ModelNode, MapRef>= new Map();
	/** Circle fields */
	const circleMapFields:CircleEntities[]= [];
	/** Entity names: add new names for INPUT or OUTPUT */
	const entityNameSet: Set<string>= new Set();
	var entitiesMap= ast.mapChilds, entity: ModelNode;
	/** Variable declaration list */
	const varDeclarationList: ts.VariableDeclaration[]= [];
	/** map imports */
	const importGqlVars: Map<string, ts.Identifier>= new Map();
	const GraphQLScalarTypeVar= factory.createUniqueName('GraphQLScalarType');
	const GraphQLSchemaVar= factory.createUniqueName('GraphQLSchema');
	const GraphQLEnumTypeVar= factory.createUniqueName('GraphQLEnumType');
	const GraphQLObjectTypeVar = factory.createUniqueName('GraphQLObjectType');
	const GraphQLInputObjectTypeVar = factory.createUniqueName('GraphQLInputObjectType');
	const GraphQLListVar= factory.createUniqueName('GraphQLList');
	const GraphQLNonNullVar= factory.createUniqueName('GraphQLNonNull')
	importGqlVars
		.set('GraphQLScalarType', GraphQLScalarTypeVar)
		.set('GraphQLSchema', GraphQLSchemaVar)
		.set('GraphQLEnumType', GraphQLEnumTypeVar)
		.set('GraphQLObjectType', GraphQLObjectTypeVar)
		.set('GraphQLInputObjectType', GraphQLInputObjectTypeVar)
		.set('GraphQLList', GraphQLListVar)
		.set('GraphQLNonNull', GraphQLNonNullVar);
	//* Model imports
	const uIntScalarVar= factory.createUniqueName('uIntScalar');
	const uFloatScalar= factory.createUniqueName('uFloatScalar');
	// Queue
	interface QueueInterface{
		entity:		ModelNode
		isInput:	boolean
		/** Current field index (plain_object) */
		index:		number
		/** Entity name */
		entityName: string|undefined,
		/** Has circles */
		hasCircles:	boolean
	}
	//* Go through Model
	const queue: QueueInterface[]= [];
	// Add interface nodes
	if(entity= entitiesMap.Query) queue.push({entity, isInput: false, index: 0, entityName: 'Query', hasCircles: false});
	if(entity= entitiesMap.Mutation) queue.push({entity, isInput: false, index: 0, entityName: 'Mutation', hasCircles: false});
	if(entity= entitiesMap.Subscription) queue.push({entity, isInput: false, index: 0, entityName: 'Subscription', hasCircles: false});
	var entityVar: ts.Identifier;
	var childs: ModelNode[];
	var mx= 0;
	const path: Set<ModelNode>= new Set();
	while(true){
		if(mx++>100000){
			console.log('----- <STOP> -----');
			break;
		}
		let queueLen= queue.length;
		if(queueLen===0) break;
		let currentNode= queue[queueLen-1];
		let {entity, isInput, index, entityName}= currentNode;
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
		let isResolved= true;
		// Switch Node type:
		switch(entity.kind){
			case ModelKind.PLAIN_OBJECT:
				//* Plain object: Check if all fields are resolved
				childs= entity.children;
				let len= childs.length;
				while(index<len){
					let field= childs[index++] as ObjectField;
					let child= isInput ? field.children[0] : (field.resolver?.children[0] ?? field.children[0]);
					//TODO resolve param
					while(child.kind!== ModelKind.REF){
						child= (child as ObjectField).children[0];
						if(child==null)
							throw new Error(`Enexpected empty child! at ${entity.name}.${field.name}`);
					}
					let refNode= entitiesMap[child.name!];
					let refNodeEl: ts.Expression|undefined= isInput ? mapNodeVar.get(refNode)?.input : mapNodeVar.get(refNode)?.output;
					if(refNodeEl==null){
						// Check for circles
						if(path.has(refNode)){
							currentNode.hasCircles= true;
						} else {
							// Go dept
							isResolved= false;
							path.add(refNode);
							queue.push({ entity: refNode, isInput, index: 0, entityName: undefined, hasCircles: false});
						}
						break;
					}
				}
				if(isResolved){
					//* All fields resolved
					if(currentNode.hasCircles){
						let fieldsVar= factory.createUniqueName(entityName+'_fileds');
						circleMapFields.push({ entity, isInput, fieldsVar });
						varDeclarationList.push(
							// Field var
							factory.createVariableDeclaration(fieldsVar, undefined, undefined, factory.createObjectLiteralExpression()),
							// Object
							createNewVarExpression(pretty, factory, entityVar,
								isInput ? GraphQLInputObjectTypeVar: GraphQLObjectTypeVar,
								serializeObject(factory, pretty, {
									name:			entityName,
									fields:			fieldsVar,
									description:	entity.jsDoc
								})
							)
						);
					} else {
						varDeclarationList.push(_compilePlainObject(entity, entityName, entityVar, isInput));
					}
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
					enumValues.push(factory.createPropertyAssignment(
						factory.createIdentifier(child.name!),
						serializeObject(factory, pretty, {
							description: child.jsDoc,
							deprecationReason: child.deprecated,
							value: (child as EnumMember).value
						})
					))
				}
				varDeclarationList.push(createNewVarExpression(
					pretty, factory, entityVar, GraphQLEnumTypeVar, serializeObject(factory, pretty, {
						name:	entityName,
						values: factory.createObjectLiteralExpression(enumValues, pretty),
						description: entity.jsDoc 
					})
				));
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.UNION:
				//* UNION
				// varDeclarationList.push();
				//TODO
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.SCALAR:
				//* Scalar
				varDeclarationList.push(
					createNewVarExpression(
						pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, {
							name:			entityName,
							description:	entity.jsDoc,
							parser: factory.createPropertyAccessExpression(
								uIntScalarVar, factory.createIdentifier('parse')
							)//FIXME
						})
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
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, {
									name:			entityName,
									description:	entity.jsDoc,
									parser: factory.createPropertyAccessExpression(
										uIntScalarVar, factory.createIdentifier('parse')
									)
								})
							)
						)
						break;
					case 'uFloat':
						// entityVar= factory.createUniqueName(entityName);
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, serializeObject(factory, pretty, {
									name:			entityName,
									description:	entity.jsDoc,
									parser: factory.createPropertyAccessExpression(
										uFloatScalar, factory.createIdentifier('parse')
									)
								})
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
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(varDeclarationList)
		)
	];
	// Resolve circles
	for(let i=0, len= circleMapFields.length; i<len; ++i){
		let {entity, fieldsVar, isInput}= circleMapFields[i];
		var fields= entity.children;
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
				factory.createImportSpecifier(factory.createIdentifier('uFloatScalar'), uFloatScalar)
			])),
			factory.createStringLiteral('tt-model')
		)
	];

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
	/** Compile object fields */
	function compileFields(entity: ModelObjectNode, field: ObjectField, isInput: boolean): ts.ObjectLiteralExpression{
		var child= isInput ? field.children[0] : field.resolver?.children[0] ?? field.children[0];
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
			throw new Error(`Enexpected missing entity var: ${refNode.name} at ${entity.name}.${field.name}`)
			// console.log('Ignore circle>>', refNode.name);
			// //TODO resolve circles
			// continue;
		}
		// Put wrappers
		for(let i=0, len= wrappers.length; i<len; ++i){
			if(wrappers[i]===0) refNodeTs= factory.createNewExpression(GraphQLListVar, undefined, [refNodeTs]);
			else refNodeTs= factory.createNewExpression(GraphQLNonNullVar, undefined, [refNodeTs]);
		}
		var result: ts.ObjectLiteralExpression;
		if(isInput){
			result= serializeObject(factory, pretty, {
				type:			refNodeTs,
				// defaultValue:	
				description:	field.jsDoc
			});
		} else {
			result= serializeObject(factory, pretty, {
				type:				refNodeTs,
				//TODO args?:		GraphQLFieldConfigArgumentMap;
				//TODO resolve?:	GraphQLFieldResolveFn;
				deprecationReason:	field.deprecated,
				description:		field.jsDoc
			});
		}
		return result;
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
	fields: Record<string, ts.Expression|string|number|undefined>
){
	var fieldArr: ts.ObjectLiteralElementLike[]= [];
	for(let k in fields){
		let v= fields[k]
		if(v==null) v= factory.createIdentifier('undefined');
		else if(typeof v==='string') v= factory.createStringLiteral(v);
		else if(typeof v==='number') v= factory.createNumericLiteral(v);
		fieldArr.push(
			factory.createPropertyAssignment( factory.createIdentifier(k), v ),
		)
	}
	return factory.createObjectLiteralExpression(fieldArr, pretty)
}

/** Create function wrapper */
function createWrapper(
	pretty: boolean,
	factory: ts.NodeFactory,
	params: readonly ts.ParameterDeclaration[] | undefined,
	block: readonly ts.Statement[]
){
	return factory.createFunctionExpression(undefined, undefined, undefined, undefined, params, undefined, factory.createBlock(block, pretty));
}