export type Stance = 'positive' | 'negative' | 'conflict' | 'unknown';
export type Source = { id:string; title:string; company:string; url:string; published:string; fetched:string; sha256:string; pages:number };
export type Observation = {id:string; label:string; raw:string; unit:'CNY'|'percent'|'shares'; period:string; sourceId:string; page:number; scope:string};
export type FilingNote = {id:string; title:string; text:string; sourceId:string; page:number; kind:'disclosure'|'limitation'};
export type Metric = {id:string; label:string; value:number|null; unit:string; formula:string; inputs:string[]; reason?:string};
export type Claim = {id:string; title:string; body:string; stance:Stance; kind:'事实'|'分析推断'|'未验证'; dimension:string; metrics:string[]; notes:string[]; limitation:string; next:string};
export type ResearchTask = {intent:string; dimensions:string[]; explanation:string; restricted:boolean};
export type AIResult = {status:'unconfigured'|'verified'|'failed'; summary:string; claims:{text:string;evidenceIds:string[]}[]; message:string};
