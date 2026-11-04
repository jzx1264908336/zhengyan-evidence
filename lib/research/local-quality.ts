import {claims,metrics,notes,routeQuestion} from './engine.ts';
import {compareRevision} from './revisions.ts';
export type AnswerSection={key:string;title:string;question:string;facts:string;boundary:string;evidenceIds:string[]};
const clean=(text:string)=>text.replace(/沪深300/g,'基准指数').replace(/最近\s*20\s*个共同交易日/g,'所选共同交易日区间').replace(/2026\s*前三季度/g,'最新累计期').replace(/2025\s*年/g,'上一年度').replace(/[-+]?\d+(?:\.\d+)?\s*%/g,'（见程序指标）').replace(/[-+]?\d+(?:\.\d+)?\s*倍/g,'（见程序比值）');
function section(key:string,id:string,question:string):AnswerSection{
 const claim=claims.find(c=>c.id===id)!;
 return {key,title:claim.dimension,question,facts:clean(claim.body),boundary:clean(claim.limitation),evidenceIds:[...claim.metrics,...claim.notes]};
}
export function localAnswerPlan(question:string,challenge=false):AnswerSection[]{
 if(routeQuestion(question).restricted)return [];
 const cash=()=>{const s=section('cash','C-cash','直接说明现金流与销售回款差异为何不能证明酒类主业或终端动销改善，保留财务公司影响。');s.boundary+=' 披露仅关联财务公司与合并经营现金流变动，未证明销售回款同比变化由财务公司造成，不能将两者一并归因。';return s;};
 const valuation=()=>{const s=section('valuation','C-value','解释估值倍数的口径和报告期滞后，明确不能仅凭倍数判断合理性，不讨论基准指数。');s.facts='产品计算基于同日公开市值和已披露财务数据的市盈率TTM、市净率。计算结果仅是倍数事实，本身不能证明低估或高估。市净率权益使用最近披露报告期数据，存在报告期滞后。具体倍数由程序展示，不在解释中留占位语。';return s;};
 const price=()=>{const s=section('price','C-price','解释所选共同交易日个股与基准价格表现、最大回撤及其含义；不把区间表现当作经营改善或事件因果证明。');s.boundary+=' 最大回撤是此前已出现的峰值到随后低点的最大跌幅，必须保留先后顺序，不能不顾顺序地用全区间最高价和最低价计算。';return s;};
 let plan:AnswerSection[];
 if(/估值/.test(question)&&/行情|股价|走势/.test(question)&&/经营/.test(question))plan=[cash(),valuation(),price()];
 else if(/(?:归母|归属于母公司|母公司股东).*(?:合并|现金流)|(?:合并|现金流).*(?:归母|归属于母公司|母公司股东)/.test(question)){
  const scope=section('scope','C-coverage','直接回答合并现金流和归母净利润能否机械比较，并说明少数股东损益的归属差异。');
  scope.title='合并与归母口径';scope.facts='合并经营现金流覆盖合并范围；合并净利润包含少数股东损益，归母净利润不包含少数股东损益。因此合并经营现金流与合并净利润范围一致，与归母净利润的归属范围不同。页面现金覆盖比值的分母是合并净利润，不是归母净利润。';
  scope.boundary='不能声称合并现金流与合并净利润本身归属口径不一致。归母净利润仍可作为补充指标观察，但不能把两种分母的比值混为一谈。';plan=[scope,cash()];
 }else if(/支持.*反对/.test(question))plan=[section('support','C-coverage','先说明合并现金流覆盖合并净利润这一支持事实，再保留财务公司影响限制。'),cash(),section('annual','C-annual','说明上一年度下降与最新累计期恢复的对照，不能推断全年。')];
 else if(/年度|全年|趋势/.test(question))plan=[section('annual','C-annual','分别交代上一年度收入与现金流下降、最新累计期现金流恢复；累计期不能直接代表全年。'),section('revenue','C-revenue','说明最新累计期收入与归母利润变化方向不同，不自行认定原因。')];
 else if(/五粮液/.test(question)&&/更新|更正|修订|版本/.test(question)){
  const r=compareRevision();
  const revision:AnswerSection={key:'revision',title:'报告版本与重算',question:'报告更新改变了哪些已核验字段？为何同行比较不能混用原始版和更新版？',facts:'已保留同一季度报告的原始版与更新版，更新版替代原始版。营业收入与归母净利润在两个版本之间变化，经营现金流保持不变。依赖收入和利润的归母利润收入比也随版本重算。',boundary:'只讨论这两份已保存报告的字段差异，不将年度核算调整说明当作该次更新的全部原因；不认定异常或造假，不回填更新前本不可能看到的信息。',evidenceIds:r.changes.flatMap(c=>[c.oldId+'-value',c.newId+'-value'])};
  plan=[revision,section('peers','C-peer','年度同行比较应怎样处理收入确认口径可比性？区分材料与报告期，不能仅凭年度说明确定季度更新的全部原因，也不能断言二者属于独立事件。')];
 }
 else if(/五粮液|泸州|汾酒|同行|比较/.test(question)){
  const peer=section('peers','C-peer','五粮液的收入确认调整会给年度同行同比比较带来什么限制？本产品默认怎样处理样本？');
  peer.boundary+=' 排除是本产品为保持可比性的默认选择，不是所有研究都必须排除；不得从年度证据推断季度数据异常或差异严重程度。';plan=[peer];
 }
 else if(/估值|市值|便宜|市盈率|市净率|\bPB\b|\bPE\b|TTM|权益.*滞后/i.test(question))plan=[valuation()];
 else if(/最大回撤|基准|股价|行情/.test(question))plan=[price()];
 else if(/下一步|核验哪些/.test(question)){
  const next=section('next','C-risk','提出具体核验动作，使用“核验”或“查阅”开头，覆盖审计、财务公司拆分和终端动销口径。');
  next.facts='核验后续年度审计报告及三季报未经审计标注；查阅财务公司现金流与酒类经营现金流的可比拆分；寻找覆盖期和样本明确的终端库存、动销资料，不能以渠道收入替代。';plan=[next];
 }else if(/风险|未知/.test(question))plan=[section('risk','C-risk','只说明未知和资料局限，不把信息不足认定为公司已经发生问题。')];
 else if(/利润.*收入|收入.*利润/.test(question))plan=[section('revenue','C-revenue','直接回答收入与归母利润变化方向是否一致，原因仍待核验。')];
 else plan=[cash()];
 if(challenge)plan=plan.filter(s=>s.key!=='support');
 return plan;
}
export function localSectionSchema(plan:AnswerSection[]){return {type:'object',additionalProperties:false,required:plan.map(s=>s.key),properties:Object.fromEntries(plan.map(s=>[s.key,{type:'string',minLength:12,maxLength:500,pattern:'^[^0-9０-９%％{}]+$'}]))};}
export function localSectionPacket(plan:AnswerSection[]){return plan.map(s=>({key:s.key,question:s.question,facts:s.facts,boundary:s.boundary,metrics:metrics.filter(m=>s.evidenceIds.includes(m.id)).map(m=>({label:clean(m.label),value:m.value,unit:m.unit})),notes:notes.filter(n=>s.evidenceIds.includes(n.id)).map(n=>clean(n.text))}));}
function unqualified(text:string,pattern:RegExp){return [...text.matchAll(pattern)].some(match=>{const clause=text.slice(0,match.index).split(/[，。；！？]/).at(-1)??'';return !/不把|不是|并非|而非|不应|不能|不足以|不等于|不代表|不可|不得|不将|避免|不推断|不从|无证据|未证明|不意味着/.test(clause)});}
export function validateLocalSections(input:unknown,plan:AnswerSection[]){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('本地分节格式不正确');
 const data=input as Record<string,unknown>;
 if(Object.keys(data).length!==plan.length||Object.keys(data).some(k=>!plan.some(s=>s.key===k)))throw new Error('回答遗漏或添加了研究维度');
 return {claims:plan.map(s=>{
  const raw=data[s.key];if(typeof raw!=='string'||raw.trim().length<12||raw.length>500)throw new Error('研究维度内容不完整：'+s.key);
  const text=raw.replace(/^(?:该节完整解释正文|完整解释正文)[：:]\s*/,'').trim();
  if(/^(?:该节|直接说明|请重新)/.test(text))throw new Error('不要复述任务指令，应直接回答已披露事实与边界');
  const unsupported=unqualified(text,/数据异常|异常数据|财务造假|公司异常|造假/g);
  if(/沪深/.test(text)||unsupported)throw new Error('出现未获证据支持的异常认定或指数名');
  if(s.key==='peers'&&unqualified(text,/季度数据|季度.{0,12}差异|重大差异/g))throw new Error('本节仅有年度可比性证据，不得扩展季度数据或差异严重程度');
  if(s.key==='cash'&&unqualified(text,/销售.{0,40}(?:亦受此因素|也受财务公司|同样受财务公司)/g))throw new Error('不能将销售回款变动归因于财务公司');
  if(s.key==='cash'&&unqualified(text,/两者(?:均|都|同样)受财务公司/g))throw new Error('未有证据证明经营现金流和销售回款均受财务公司因素影响');
  if(s.key==='scope'&&(!/归母/.test(text)||!/合并/.test(text)||!/少数股东/.test(text)||!/不含|不包含|排除/.test(text)))throw new Error('口径解释必须说明归母净利润不包含少数股东损益');
  if(s.key==='scope'&&/合并净利润.{0,15}(?:口径不一致|范围不同)/.test(text)&&!/与归母|和归母/.test(text))throw new Error('错误地否定同一合并范围');
  if(s.key==='scope'&&/分母应|使用合并净利润而非/.test(text)&&!/本产品|页面|现金覆盖比值/.test(text))throw new Error('分母要求仅限定本产品页面的合并现金覆盖比值，不能禁止其他明确口径的补充比较');
  if(s.key==='valuation'&&!/估值|市盈率|市净率|倍数/.test(text))throw new Error('遗漏估值解释');
  if(s.key==='peers'&&!/收入确认|核算调整/.test(text))throw new Error('遗漏同行可比性调整');
  if(s.key==='price'&&(!/基准|股价|价格|行情/.test(text)||!/不能|不代表|不等于|不足|无法|因果/.test(text)))throw new Error('遗漏行情或其解释边界');
  if(s.key==='price'&&/最高.{0,15}最低/.test(text)&&!/此前|先前|随后|之后|先后|顺序|历史峰值/.test(text))throw new Error('最大回撤必须解释为此前峰值到随后低点，不能忽略时间顺序');
  if(s.key==='annual'&&(!/上一年度/.test(text)||!/最新累计期/.test(text)))throw new Error('遗漏年度与累计期对照');
  if(s.key==='next'&&!/核验|查阅/.test(text))throw new Error('遗漏具体下一步核验动作');
  if(s.key==='revision'&&(!/原始|原版/.test(text)||!/更新|修订|更正/.test(text)))throw new Error('遗漏原始版与更新版对照');
  return {text:'【'+s.title+'】'+text,evidenceIds:s.evidenceIds};
 })};
}
