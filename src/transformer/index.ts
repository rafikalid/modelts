import { objectCreate } from "@src/helpers/utils";
import { ModelKind, ModelObjectNode, RootModel } from "@src/schema/model";
import ts, { ClassLikeDeclaration } from "typescript";


type TsClazzType= ts.ClassLikeDeclaration | ts.InterfaceDeclaration;

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createBeforeTransformer(){
	// return transformer
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
		return function(sf: ts.SourceFile){ return ts.visitNode(sf, _visitor(ctx, sf)); }
	}
}

/** Visitor */
function _visitor(ctx:ts.TransformationContext, sf:ts.SourceFile): ts.Visitor{
	/** Root class */
	var root: RootModel= {
		models:	[],
		map:	{}
	}
	/** Visitor callback */
	function visitorCb(node: ts.Node): ts.VisitResult<ts.Node>{
		// Check for jsDoc
		// Classes & interfaces
		switch(node.kind){
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.InterfaceDeclaration:
				if(_isTsModel(node))
					return _visiteClassInterface(node as TsClazzType);
				break;
			case ts.SyntaxKind.EnumDeclaration:
				if(_isTsModel(node)) break;
				//TODO compile enum
				console.log('----- compile enum')
				break;
			case ts.SyntaxKind.TypeAliasDeclaration:
				if(_isTsModel(node)) break;
				//TODO check and compile "type"
				console.log('----- compile type')
				break
		}
		return ts.visitEachChild(node, visitorCb, ctx);
	}
	/** Compile classes and interfaces */
	function _visiteClassInterface(node: TsClazzType): ts.VisitResult<ts.Node>{
		// class model
		var clazz: ModelObjectNode= {
			name:		node.name?.getText(),
			kind:		ModelKind.PLAIN_OBJECT,
			jsDoc:		undefined,
			fields:		[],
			fieldMap:	{}
		};
		// Eeach child
		var childs= node.getChildren();
		for (var i = 0, len= childs.length; i < len; i++) {
			var childNode = childs[i];
			switch(childNode.kind){
				case ts.SyntaxKind.JSDocComment:
					clazz.jsDoc= childNode.getFullText();
			}
		}



		return node;
	}
	/** Return */
	return visitorCb;
}

/** Check has not "@tsmodel" flag */
function _isTsModel(node: ts.Node):boolean{
	var childs= node.getChildren();
	var i, len;
	for (i=0, len=childs.length; i < len; i++) {
		const childNode = childs[i];
		if(ts.isJSDoc(childNode)){
			var childNodes= childNode.getChildren();
			for (let j = 0, jLen= childNodes.length; j < jLen; j++) {
				if(childNodes[j].getFullText().trim()=== '@tsmodel') { return true }
			}
		}
	}
	return false;
}

