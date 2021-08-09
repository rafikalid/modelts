import { EnumMember, ModelBasicScalar, ModelKind, ModelNode, ModelObjectNode, ModelRoot, ModelScalarNode, ObjectField } from "@src/schema/model";
import { GraphQLFieldConfigMap } from "graphql";
import ts from 'typescript';

/**
 * Compile Model to Graphql
 */
export function compileGraphQL(factory: ts.NodeFactory, ast: ModelRoot, pretty: boolean):ts.CallExpression{
	/** Map entity to TYPSCRIPT var */
	interface MapRef{
		input:	ts.Identifier
		output:	ts.Identifier
	}
	const mapNodeVar: Map<ModelNode, MapRef>= new Map();
	/** Entities with circles */
	const entitiesWithCircles: Set<ModelObjectNode>= new Set();
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
	importGqlVars
		.set('GraphQLScalarType', GraphQLScalarTypeVar)
		.set('GraphQLSchema', GraphQLSchemaVar)
		.set('GraphQLEnumType', GraphQLEnumTypeVar)
		.set('GraphQLObjectType', GraphQLObjectTypeVar);
	//* Model imports
	const uIntScalarVar= factory.createUniqueName('uIntScalar');
	const uFloatScalar= factory.createUniqueName('uFloatScalar');
	// Queue
	interface QueueInterface{
		entity: ModelNode
		isInput: boolean
	}
	//* Go through Model
	const queue: QueueInterface[]= [];
	// Add interface nodes
	if(entity= entitiesMap.Query) queue.push({entity, isInput: false});
	if(entity= entitiesMap.Mutation) queue.push({entity, isInput: false});
	if(entity= entitiesMap.Subscription) queue.push({entity, isInput: false});
	var entityVar: ts.Identifier;
	var entityName: string;
	var childs: ModelNode[];
	while(true){
		var qlen=queue.length;
		if(qlen===0) break;
		let {entity, isInput}= queue[qlen-1];
		entityName= (entity as ModelObjectNode).name!;
		switch(entity.kind){
			case ModelKind.PLAIN_OBJECT:
				//* Plain object
				childs= entity.children;
				if(isInput){
					// TODO
					entityVar= factory.createUniqueName(entityName);
				} else {
					let fields: Record<string, ts.Expression>= {};
					for(let i=0, len= childs.length; i<len; ++i){
						let child= childs[i];
						let field= child;
						let wrappers= [];
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
						let refNodeOutput= mapNodeVar.get(refNode)?.output;
						if(refNodeOutput!=null){
							//* Already resolved entity
							fields[field.name!]= refNodeOutput;
						}
						else if(){
							//TODO
						}

					}
					// create
					entityVar= factory.createUniqueName(entityName);
					createNewVarExpression(pretty, factory, entityVar, GraphQLObjectTypeVar, {
						name:			entityName,
						fields:			serializeObject(factory, pretty, fields),
						description:	entity.jsDoc
					});
				}
				break;
			case ModelKind.ENUM:
				//* ENUM
				entityVar= factory.createUniqueName(entityName);
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
					pretty, factory, entityVar, GraphQLEnumTypeVar, {
						name:	entityName,
						values: factory.createObjectLiteralExpression(enumValues, pretty),
						description: entity.jsDoc 
					}
				));
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.UNION:
				//* UNION
				entityVar= factory.createUniqueName(entityName);
				varDeclarationList.push();
				//TODO
				break;
			case ModelKind.SCALAR:
				//* Scalar
				entityVar= factory.createUniqueName(entityName);
				varDeclarationList.push(
					createNewVarExpression(
						pretty, factory, entityVar, GraphQLScalarTypeVar, {
							name:			entityName,
							description:	entity.jsDoc,
							parser: factory.createPropertyAccessExpression(
								uIntScalarVar, factory.createIdentifier('parse')
							)//FIXME
						}
					)
				);
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
			case ModelKind.BASIC_SCALAR:
				switch(entityName){
					case 'Int':
						entityVar= factory.createUniqueName('gqlInt');
						importGqlVars.set('GraphQLInt', entityVar);
						break;
					case 'string':
						entityVar= factory.createUniqueName('gqlString');
						importGqlVars.set('GraphQLString', entityVar);
						break;
					case 'number':
						entityVar= factory.createUniqueName('gqlNumber');
						importGqlVars.set('GraphQLFloat', entityVar);
						break;
					case 'boolean':
						entityVar= factory.createUniqueName('gqlBoolean');
						importGqlVars.set('GraphQLBoolean', entityVar);
						break;
					case 'uInt':
						entityVar= factory.createUniqueName(entityName);
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, {
									name:			entityName,
									description:	entity.jsDoc,
									parser: factory.createPropertyAccessExpression(
										uIntScalarVar, factory.createIdentifier('parse')
									)
								}
							)
						)
						break;
					case 'uFloat':
						entityVar= factory.createUniqueName(entityName);
						varDeclarationList.push(
							createNewVarExpression(
								pretty, factory, entityVar, GraphQLScalarTypeVar, {
									name:			entityName,
									description:	entity.jsDoc,
									parser: factory.createPropertyAccessExpression(
										uFloatScalar, factory.createIdentifier('parse')
									)
								}
							)
						)
						break;
					default:
						throw new Error(`Unknown basic scalar: ${entityName}`);
				}
				mapNodeVar.set(entity, {input: entityVar, output: entityVar});
				break;
		}
	}

	// return factory
	return factory.createCallExpression(
		factory.createParenthesizedExpression(factory.createFunctionExpression(
			undefined,
			undefined,
			undefined,
			undefined,
			[],
			undefined,
			factory.createBlock(
				[
					factory.createVariableStatement(
						undefined,
						factory.createVariableDeclarationList(varDeclarationList)
					)
				],
				pretty
			)
		)), undefined, []
	);
}


/** Create new express */
function createNewVarExpression(
	pretty: boolean,
	factory: ts.NodeFactory,
	varname: ts.Identifier,
	constructVar: ts.Identifier,
	fields: Record<string, ts.Expression|string|number|undefined>
){
	// return
	return factory.createVariableDeclaration(
		varname,
		undefined,
		undefined,
		factory.createNewExpression(
			constructVar,
			undefined,
			[serializeObject(factory, pretty, fields)]
		)
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