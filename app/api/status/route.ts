import { snapshot,observations,sources } from '../../../lib/research/engine.ts';
export function GET(){return Response.json({snapshot:snapshot.version,asOf:snapshot.asOf,observations:observations.length,sources:sources.length,model:process.env.MODEL_API_KEY?'configured':'unconfigured',fuyao:'unconfigured',mode:'verified-public-filings'},{headers:{'Cache-Control':'no-store'}});}
