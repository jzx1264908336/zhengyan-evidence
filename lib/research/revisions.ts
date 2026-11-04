import {value,revisionVersions,format,metric} from './engine.ts';
export function compareRevision(){
 const old=revisionVersions[0],updated=revisionVersions[1];
 const changes=['revenue','profit','ocf'].map(field=>{const oldId=old.id+'-'+field,newId=updated.id+'-'+field;return {field,oldId,newId,before:value(oldId),after:value(newId),delta:value(newId)!-value(oldId)!,changed:value(newId)!==value(oldId)!}});
 return {old,updated,changes,superseded:updated.supersedes===old.id,oldMargin:metric(old.id+'-margin')!.value,newMargin:metric(updated.id+'-margin')!.value,affectedMetrics:[old.id+'-margin',updated.id+'-margin']};
}
export function revisionVisibleOn(date:string){return revisionVersions.filter(v=>v.published<=date).at(-1)??null;}
