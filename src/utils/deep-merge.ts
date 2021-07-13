import { ModelKind, ModelNode, SimplifiedNode } from "@src/schema/model";
/**
 * Model entries deep merge
 */
export function deepMerge(targetNode: SimplifiedNode, srcNode: SimplifiedNode){
	const queue: DeepMergeNode[]= [{
		src: srcNode,
		target: targetNode,
		trace: [srcNode.name]
	}];
	var i=0, n: DeepMergeNode;
	while(i<queue.length){
		n= queue[i++];
		targetNode= n.target;
		srcNode= n.src;
		if(targetNode.kind !== srcNode.kind)
			throw new Error(`Wrong kind ${ModelKind[targetNode.kind]}:${targetNode.name} and ${ModelKind[srcNode.kind]}:${srcNode.name} at ${n.trace.join(' ➜ ')}`);
		
		let j:number, jlen, srcChilds= srcNode.children, targetChilds= targetNode.children, child: ModelNode, tChild: ModelNode|undefined;
		switch(srcNode.kind){
			case ModelKind.PLAIN_OBJECT:
			case ModelKind.ROOT:
				for(j=0, jlen= srcChilds.length; j<jlen; ++j){
					child= srcChilds[j]!;
					if(tChild= targetChilds.find(e=> e.name === child.name)){
						if((child as SimplifiedNode).children){
							queue.push({
								target:	tChild as SimplifiedNode,
								src:	child as SimplifiedNode,
								trace:	n.trace.concat(child.name)
							});
						} else {
							throw new Error(`${child.name} has no children at ${n.trace.join(' ➜ ')}`);
						}
					} else {
						targetChilds.push(child);
					}
				}
				break;
			// case ModelKind.METHOD:
			// 	for(j=0, jlen= srcChilds.length; j<jlen; ++j){
			// 		queue.push({
			// 			target:	targetChilds[j] as SimplifiedNode,
			// 			src:	srcChilds[j] as SimplifiedNode,
			// 			trace:	n.trace.concat(srcChilds[j].name)
			// 		});
			// 	}
			// default:
			// 	if(srcChilds==null && targetChilds==null){}
			// 	else if(srcChilds.length===1 && targetChilds.length===1){
			// 		queue.push({
			// 			target:	targetChilds[0] as SimplifiedNode,
			// 			src:	srcChilds[0] as SimplifiedNode,
			// 			trace:	n.trace.concat(srcChilds[0].name)
			// 		});
			// 	}
			// 	else{
			// 		throw new Error(`Could not merge ${ModelKind[srcNode.kind]}:${srcNode.name} and ${ModelKind[targetNode.kind]}:${targetNode.name} at ${n.trace.join(' ➜ ')}`);
			// 	}
		}
	}
}

interface DeepMergeNode{
	src: SimplifiedNode
	target: SimplifiedNode
	trace: (string|undefined)[]
}