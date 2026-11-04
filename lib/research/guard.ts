// Best-effort per-isolate protection; platform access remains the primary boundary.
const buckets=new Map<string,{start:number;count:number}>();
export function allowRequest(identity:string,now=Date.now()):boolean {
 if(buckets.size>1000)for(const [key,b] of buckets)if(now-b.start>60000)buckets.delete(key);
 const key=identity.slice(0,128);const old=buckets.get(key);
 if(!old||now-old.start>=60000){if(buckets.size>=2000)return false;buckets.set(key,{start:now,count:1});return true}
 old.count++;return old.count<=12;
}
