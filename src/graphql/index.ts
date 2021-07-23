import { ModelRoot, ModelNode, ModelKind, EnumMember, ObjectField, ModelListNode, ModelRefNode, ModelMethod, ModelObjectNode } from "@src/schema/model";
import { DEFAULT_SCALARS, ModelScalar, uFloatScalar, uIntScalar, UNION } from "@src/schema/types";
import { graphql, GraphQLBoolean, GraphQLEnumType, GraphQLEnumValueConfigMap, GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFloat, GraphQLInputFieldMap, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLString, GraphQLType, GraphQLUnionType } from 'graphql';

/** Graphql basic scalars */
const GraphqlBasicScalars: {[p in typeof DEFAULT_SCALARS[number]]: GraphQLScalarType}={
	Int:	GraphQLInt,
	string:	GraphQLString,
    number:	GraphQLFloat,
    boolean: GraphQLBoolean,
	// --
    uInt:	new GraphQLScalarType({
		name:	'uInt',
		description: 'Unsigned int',
		parseValue: uIntScalar.parse
	}),
    uFloat: new GraphQLScalarType({
		name:	'uFloat',
		description: 'Unsigned float',
		parseValue: uFloatScalar.parse
	})
};


/**
 * Convert into graphql
 */
export function toGraphql(ast: ModelRoot){
	const mapInputEntities: Map<ModelNode, mapFieldsItem>= new Map();
	const mapOutputEntities: Map<ModelNode, mapFieldsItem>= new Map();
	const entityNameSet: Set<string>= new Set();
	var entitiesMap= ast.mapChilds, entity: ModelNode;
	// Queue
	interface QueueInterface{
		entity: ModelNode
		isInput: boolean
	}
	const queue: QueueInterface[]= [];
	// Add interface nodes
	if(entity= entitiesMap.Query) queue.push({entity, isInput: false});
	if(entity= entitiesMap.Mutation) queue.push({entity, isInput: false});
	if(entity= entitiesMap.Inscription) queue.push({entity, isInput: false});
	// Loop
	var i=0;
	var j:number, jlen: number, childs: ModelNode[], child: ModelNode;
	var fields: any;
	while(i< queue.length){
		var {entity, isInput}= queue[i++];
		fields= _getNode(entity, isInput).fields!;
		switch(entity.kind){
			case ModelKind.PLAIN_OBJECT:
				childs= entity.children;
				if(isInput){
					const objFields: GraphQLInputFieldMap= fields;
					for(j=0, jlen= childs.length; j<jlen; ++j){
						child= childs[j];
						objFields[child.name!]={
							type:				_resolveFieldType(child as ObjectField, isInput, entity) as GraphQLInputType,
							description:		child.jsDoc,
							defaultValue:		(child as ObjectField).defaultValue,
							name:				child.name!,
							deprecationReason:	child.deprecated,
							extensions:			undefined
						};
					}
				} else {
					const objFields: GraphQLFieldConfigMap<any, any>= fields;
					for(j=0, jlen= childs.length; j<jlen; ++j){
						child= childs[j];
						let resolver= (child as ObjectField).resolver
						objFields[child.name!]= {
							type:				_resolveFieldType(child as ObjectField, isInput, entity) as GraphQLOutputType,
							description:		child.jsDoc,
							deprecationReason:	child.deprecated,
							args:				resolver && _resolverArgs(resolver, child as ObjectField, entity),
							resolve:			resolver?.method as any
						};
					}
				}
				break;
			case ModelKind.ENUM:
				childs= entity.children;
				const enumFields: GraphQLEnumValueConfigMap= fields!;
				for(j=0, jlen= childs.length; j<jlen; ++j){
					child= childs[j];
					enumFields[child.name!]={
						description: child.jsDoc,
						deprecationReason: child.deprecated,
						value: (child as EnumMember).value
					};
				}
				break;
			case ModelKind.UNION:
				childs= entity.children;
				const unionItems: GraphQLObjectType[]= fields!;
				for(j=0, jlen= childs.length; j<jlen; ++j){
					child= childs[j];
					unionItems.push(_getNode(child, isInput).node as GraphQLObjectType);
				}
				break;
			case ModelKind.SCALAR:
			case ModelKind.BASIC_SCALAR:
				// Nothing to do
				break;
		}
	}

	/** Map graphql nodes */
	interface mapFieldsItem {
		fields:	any,
		node:	GraphQLType
	}
	/** get entity name */
	function _getEntityName(entity: ModelNode, isInput: boolean){
		var entityName= entity.name!;
		while(entityNameSet.has(entityName)){
			entityName += isInput ? 'Input': 'Output';
		}
		entityNameSet.add(entityName);
		return entityName;
	}
	/** Create Graphql Node */
	function _getNode(entity: ModelNode, isInput: boolean): mapFieldsItem{
		var result: mapFieldsItem|undefined;
		var fields: any;
		// resolve reference
		if(entity.kind===ModelKind.REF){
			var n= entitiesMap[entity.name!]
			if(!n)
				throw new Error(`Missing entity: ${entity.name}`);
			entity= n;
		}
		// var fields: any[]= [];
		switch(entity.kind){
			case ModelKind.PLAIN_OBJECT:
				if(isInput){
					if(!(result= mapInputEntities.get(entity))){
						fields= {};
						result={
							fields,
							node: new GraphQLInputObjectType({
								name: _getEntityName(entity, isInput),
								description: entity.jsDoc,
								fields: fields
							})
						};
						mapInputEntities.set(entity, result);
					}
				} else if(!(result= mapOutputEntities.get(entity))){
					fields= {};
					result={
						fields,
						node: new GraphQLObjectType({
							name: _getEntityName(entity, isInput),
							description: entity.jsDoc,
							fields:	fields
						})
					}
					mapOutputEntities.set(entity, result);
				}
				break;
			case ModelKind.ENUM:
				if(!(result= mapOutputEntities.get(entity))){
					fields= {};
					result={
						fields,
						node: new GraphQLEnumType({
							name:	entity.name!,
							description: entity.jsDoc,
							values: fields
						})
					};
					mapOutputEntities.set(entity, result);
				}
				break;
			case ModelKind.UNION:
				if(!(result= mapOutputEntities.get(entity))){
					let parser= entity.parser as UNION<any>;
					let types: GraphQLObjectType[]= [];
					result= {
						fields: types,
						node: new GraphQLUnionType({
							name:	entity.name!,
							description: entity.jsDoc,
							types:	types,
							resolveType(value, ctx, info){
								return types[parser.resolveType(value, ctx, info)];
							}
						})
					};
					mapOutputEntities.set(entity, result);
				}
				break;
			case ModelKind.SCALAR:
				if(!(result= mapOutputEntities.get(entity))){
					var scalarParser= (entity.parser as ModelScalar<any>);
					result={
						fields: undefined,
						node: new GraphQLScalarType({
							name:			entity.name!,
							description:	entity.jsDoc,
							parseValue:		scalarParser.parse,
							serialize:		scalarParser.serialize
						})
					};
					mapOutputEntities.set(entity, result);
				}
				break;
			case ModelKind.BASIC_SCALAR:
				if(!(result= mapOutputEntities.get(entity))){
					result= {
						fields: undefined,
						node: GraphqlBasicScalars[entity.name! as keyof typeof GraphqlBasicScalars]
					};
					mapOutputEntities.set(entity, result);
				}
				break;
			default:
				throw new Error(`Unsupported entity ${entity.name} as ${ModelKind[entity.kind]}`);
		}
		return result;
	}
	/** Resolve field type */
	function _resolveFieldType(field: ObjectField, isInput: boolean, parentNode: ModelObjectNode){
		var result: GraphQLType;
		var wrappers= [];
		var el: ModelNode= field.children[0]??field.resolver?.children[0];
		if(!el)
			throw new Error(`Empty field  at ${parentNode.name}.${field.name}`);
		while(true){
			if((el as ObjectField).required) wrappers.push(1);
			if(el.kind===ModelKind.LIST){
				wrappers.push(0);
				el= (el as ModelListNode).children[0];
				if(!el) throw new Error(`Enexpected empty list! at ${parentNode.name}.${field.name}`);
			} else if(el.kind===ModelKind.REF || el.kind===ModelKind.SCALAR ||el.kind===ModelKind.UNION){
				result= _getNode(el, isInput).node;
				break;
			} else {
				throw new Error(`Enexpected kind: ${ModelKind[el.kind]} at ${parentNode.name}.${field.name}`);
			}
		}
		var i=0, len= wrappers.length;
		while(i<len){
			if(wrappers[i++]===0) // List
				result= new GraphQLList(result);
			else // required
				result= new GraphQLNonNull(result);
		}
		return result;
	}
	/** Resolver args */
	function _resolverArgs(resolver: ModelMethod, field: ObjectField, entity: ModelObjectNode){
		var result: GraphQLFieldConfigArgumentMap|undefined;
		var ref= resolver.children[1];
		if(!ref) throw new Error(`Missing resolver argument at ${field.name}.${entity.name}!`);
		if(ref.kind !== ModelKind.PARAM) throw new Error(`Resolver argument expected PARAM, got ${ModelKind[ref.kind]} at ${field.name}.${entity.name}`);
		ref= ref.children[0];
		if(ref){
			result= {};
			if(ref.kind !== ModelKind.REF) throw new Error(`Param type expected REF, got ${ModelKind[ref.kind]} at ${field.name}.${entity.name}`);
	
			var node= entitiesMap[ref.name!];
			if(!node)
				throw new Error(`Missing entity ${ref.name} as Resolver arg at ${field.name}.${entity.name}`);
			if(node.kind !== ModelKind.PLAIN_OBJECT)
				throw new Error(`Expected plain object as resolver's argument. Got ${node.name} as ${ModelKind[node.kind]}. at ${field.name}.${entity.name}`);
			var childs= node.children, i=0, len= childs.length, child: ObjectField;
			while(i<len){
				child= childs[i++] as ObjectField;
				result[child.name!]= {
					type:	_resolveFieldType(child, true, node) as GraphQLInputType,
					deprecationReason:	child.deprecated,
					defaultValue:		child.defaultValue,
					description:		child.jsDoc
				};
			}
		}
		return result;
	}
}
