import { buildEventSearchQuery, buildGeographySearchQueries, enrichKnownResultFacts, expandEventSearchTerm, extractPublicEventFacts, extractTabularParticipantCandidates, extractTabularParticipantFacts, inferEventCategory, normalizeDiscoveryEvent, normalizeGeoBounds, normalizeSearchText } from "../dist/event-discovery-core.mjs";
const TERRARIUM_ORIGIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org/planet/latest";
const OPEN_TOPO_DATASETS=new Set(["COP30","COP90","NASADEM","SRTM_GL1","SRTM_GL3","AW3D30","EU_DTM","GEBCOIceTopo","GEBCOSubIceTopo"]);

export function isTerrainMedalRuntimeAsset(pathname=""){
  const path=String(pathname||"");
  return path==="/terrain-medal.html"
    || path==="/terrain-medal-v31.html"
    || path==="/terrain-medal.js"
    || path==="/terrain-medal-v31.js"
    || path==="/terrain-medal.css"
    || path==="/terrain-medal-v12.css"
    || /^\/(?:terrain-medal|print-model|fabrication-extras|pro-dem|vector-map|event-discovery|map-outline)-core\.mjs$/.test(path)
    || path.startsWith("/vendor/");
}

export function isRideStoriesRuntimeAsset(pathname=""){
  const path=String(pathname||"");
  return path==="/"||path==="/index.html"
    || path==="/app.js"
    || path==="/styles.css"
    || path==="/my-road-my-glory-theme.css"
    || path==="/vyndi-typography.css"
    || path==="/vyndi-icons.svg"
    || path.startsWith("/assets/");
}

export function buildSecurityHeaders(contentType="") {
  const headers=new Headers();
  headers.set("strict-transport-security","max-age=31536000");
  headers.set("x-content-type-options","nosniff");
  headers.set("x-frame-options","DENY");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("cross-origin-opener-policy","same-origin");
  headers.set("cross-origin-resource-policy","same-origin");
  headers.set("origin-agent-cluster","?1");
  headers.set("x-permitted-cross-domain-policies","none");
  headers.set("permissions-policy","camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=(), accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self), browsing-topics=()");
  if(String(contentType).toLowerCase().includes("text/html")){
    headers.set("content-security-policy",[
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.pexels.com https://tile.openstreetmap.org https://*.wikimedia.org",
      "media-src 'self' blob: https://videos.pexels.com",
      "connect-src 'self' https://tile.openstreetmap.org https://www.wikidata.org https://en.wikipedia.org https://*.wikimedia.org",
      "frame-src https://www.openstreetmap.org",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests"
    ].join("; "));
  }
  return headers;
}

export function applySecurityHeaders(response, contentType="") {
  const headers=new Headers(response.headers);
  headers.delete("access-control-allow-origin");
  const security=buildSecurityHeaders(contentType||headers.get("content-type")||"");
  for(const [name,value] of security)headers.set(name,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function isTrustedBrowserRequest(request) {
  const target=new URL(request.url);
  const origin=request.headers.get("origin");
  if(origin&&origin!==target.origin)return false;
  const fetchSite=String(request.headers.get("sec-fetch-site")||"").toLowerCase();
  if(fetchSite==="cross-site")return false;
  return true;
}

export function isTrustedMutationRequest(request) {
  if (!["POST","PUT","PATCH","DELETE"].includes(request.method)) return true;
  const target=new URL(request.url);
  const origin=request.headers.get("origin");
  const fetchSite=String(request.headers.get("sec-fetch-site")||"").toLowerCase();
  return origin===target.origin && (fetchSite==="same-origin" || fetchSite==="none" || fetchSite==="");
}

export function rateLimitKey(request,bucket="api"){
  const client=String(request.headers.get("cf-connecting-ip")||"anonymous").slice(0,80);
  return `${client}:${String(bucket||"api").slice(0,60)}`;
}
async function passRateLimit(binding,key,failClosed=false){
  if(!binding?.limit)return !failClosed;
  try{return (await binding.limit({key}))?.success!==false}catch{return !failClosed}
}


const AUTHENTICITY_ARTIFACT_TYPES=new Set(["terrain-medal","ride-memory-frame"]);
const AUTHENTICITY_ISSUER="VYNDI Ride Stories";

function utf8Bytes(value){return new TextEncoder().encode(String(value))}
function bytesToBase64Url(bytes){
  let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function base64UrlToBytes(value){
  const padded=String(value).replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(value).length+3)%4);
  const binary=atob(padded),out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
function stableJson(value){
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stableJson).join(",")+"]";
  return "{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+stableJson(value[key])).join(",")+"}";
}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest("SHA-256",typeof value==="string"?utf8Bytes(value):value);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function hmacBytes(message,secret){
  const key=await crypto.subtle.importKey("raw",utf8Bytes(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,utf8Bytes(message)));
}
function constantTimeEqual(a,b){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}

export function normalizeAuthenticityManifest(input={}){
  const artifactType=String(input.artifactType||"").trim();
  if(!AUTHENTICITY_ARTIFACT_TYPES.has(artifactType))throw new Error("Unsupported authenticity artifact type.");
  const stem=String(input.stem||"artifact").trim().slice(0,120).replace(/[^a-zA-Z0-9._ -]/g,"-")||"artifact";
  const files=Array.isArray(input.files)?input.files:[];
  if(!files.length||files.length>10)throw new Error("Authenticity manifest must contain 1 to 10 files.");
  const normalizedFiles=files.map(file=>{
    const name=String(file?.name||"").trim().slice(0,180);
    const sha256=String(file?.sha256||"").trim().toLowerCase();
    const size=Math.floor(Number(file?.size));
    if(!name||name.includes("/")||name.includes("\\"))throw new Error("Authenticity file name is invalid.");
    if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error("Authenticity file SHA-256 is invalid.");
    if(!Number.isFinite(size)||size<1||size>536870912)throw new Error("Authenticity file size is invalid.");
    return {name,sha256,size};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const governedInput=input.governed&&typeof input.governed==="object"?input.governed:{};
  const governed={};
  for(const key of ["profileId","shape","triangles","vertices","resolutionStepMm","placeLabels","watermarkMandatory"]){
    const value=governedInput[key];
    if(value===undefined||value===null)continue;
    if(typeof value==="string")governed[key]=value.slice(0,100);
    else if(typeof value==="boolean")governed[key]=value;
    else if(Number.isFinite(Number(value)))governed[key]=Number(value);
  }
  return {artifactType,stem,files:normalizedFiles,governed};
}

export async function issueAuthenticityReceipt(input,secret,options={}){
  if(typeof secret!=="string"||secret.length<32)throw new Error("Authenticity signing secret is not configured securely.");
  const manifest=normalizeAuthenticityManifest(input);
  const manifestHash=await sha256Hex(stableJson(manifest));
  const issuedAt=options.issuedAt||new Date().toISOString();
  const artifactId=options.artifactId||`VYNDI-${issuedAt.slice(0,10).replace(/-/g,"")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const claim={v:1,issuer:AUTHENTICITY_ISSUER,artifactId,artifactType:manifest.artifactType,issuedAt,manifestHash,service:"https://vmm.vayushastr.workers.dev"};
  const encodedClaim=bytesToBase64Url(utf8Bytes(stableJson(claim)));
  const signature=bytesToBase64Url(await hmacBytes(encodedClaim,secret));
  return {claim,manifest,token:`${encodedClaim}.${signature}`};
}

export async function verifyAuthenticityToken(token,secret){
  try{
    if(typeof secret!=="string"||secret.length<32)return {verified:false,error:"Signing secret unavailable."};
    const [encodedClaim,encodedSignature,...extra]=String(token||"").split(".");
    if(!encodedClaim||!encodedSignature||extra.length)return {verified:false,error:"Malformed authenticity token."};
    const expected=await hmacBytes(encodedClaim,secret),actual=base64UrlToBytes(encodedSignature);
    if(!constantTimeEqual(expected,actual))return {verified:false,error:"Signature mismatch."};
    const claim=JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedClaim)));
    if(claim?.v!==1||claim?.issuer!==AUTHENTICITY_ISSUER||!AUTHENTICITY_ARTIFACT_TYPES.has(claim?.artifactType)||!/^[a-f0-9]{64}$/.test(String(claim?.manifestHash||"")))return {verified:false,error:"Invalid authenticity claim."};
    return {verified:true,claim};
  }catch{return {verified:false,error:"Invalid authenticity token."}}
}

export async function verifyAuthenticityReceipt(receipt,secret){
  const tokenResult=await verifyAuthenticityToken(receipt?.token,secret);
  if(!tokenResult.verified)return tokenResult;
  try{
    const manifest=normalizeAuthenticityManifest(receipt?.manifest||{});
    const manifestHash=await sha256Hex(stableJson(manifest));
    if(manifestHash!==tokenResult.claim.manifestHash)return {verified:false,error:"Manifest hash mismatch.",claim:tokenResult.claim};
    if(manifest.artifactType!==tokenResult.claim.artifactType)return {verified:false,error:"Artifact type mismatch.",claim:tokenResult.claim};
    return {verified:true,claim:tokenResult.claim,manifest};
  }catch(error){return {verified:false,error:error.message||"Invalid authenticity receipt.",claim:tokenResult.claim}}
}

function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}

async function authenticityVerificationPage(url,secret){
  const result=await verifyAuthenticityToken(url.searchParams.get("receipt")||"",secret);
  const verified=result.verified,claim=result.claim||{};
  const title=verified?"Authentic VYNDI receipt":"Authenticity not verified";
  const status=verified?"VERIFIED":"NOT VERIFIED";
  const detail=verified
    ? `Artifact <strong>${escapeHtml(claim.artifactId)}</strong><br>Type: ${escapeHtml(claim.artifactType)}<br>Issued: ${escapeHtml(claim.issuedAt)}<br>Manifest SHA-256: <code>${escapeHtml(claim.manifestHash)}</code>`
    : escapeHtml(result.error||"The receipt could not be verified.");
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · VYNDI Ride Stories</title><style>body{margin:0;background:#030504;color:#f1f5ef;font-family:Arial,sans-serif}main{max-width:760px;margin:0 auto;padding:72px 28px}p{color:#94a299;line-height:1.6}.status{display:inline-block;padding:8px 12px;border:1px solid ${verified?"#B9FF2C":"#FF6A00"};color:${verified?"#B9FF2C":"#FF7A1A"};letter-spacing:.12em;font-size:12px}.card{margin-top:24px;padding:24px;border:1px solid #27322c;background:#0d1310;line-height:1.7}code{word-break:break-all;color:#69E7FF}footer{margin-top:48px;padding-top:20px;border-top:1px solid #27322c;color:#66736c;font-size:12px}</style></head><body><main><p>MY ROAD — MY GLORY · Powered by VYNDI Ride Stories</p><h1>${title}</h1><span class="status">${status}</span><div class="card">${detail}</div><p>A valid receipt proves that the authenticity claim was signed by the canonical VYNDI Ride Stories service. It does not independently certify third-party printing quality or event affiliation.</p><footer>Vāyú Shastr Pvt Ltd · Official service: vmm.vayushastr.workers.dev</footer></main></body></html>`;
  return applySecurityHeaders(new Response(html,{status:verified?200:400,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}}),"text/html; charset=utf-8");
}


function json(body, status = 200) {
  const headers=buildSecurityHeaders("application/json; charset=utf-8");
  headers.set("content-type","application/json; charset=utf-8");
  headers.set("cache-control","no-store");
  return new Response(JSON.stringify(body),{status,headers});
}

function longitudeToTileX(longitude, zoom) {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function latitudeToTileY(latitude, zoom) {
  const radians = Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * 2 ** zoom);
}

function normalizedBounds(bounds) {
  const west = Number(bounds?.minLon), east = Number(bounds?.maxLon), south = Number(bounds?.minLat), north = Number(bounds?.maxLat);
  if (![west, east, south, north].every(Number.isFinite) || west >= east || south >= north) throw new Error("Valid min/max latitude and longitude bounds are required.");
  return { west, east, south, north };
}

function tileRangeForBounds(bounds, zoom) {
  const { west, east, south, north } = normalizedBounds(bounds);
  const minX = longitudeToTileX(west, zoom), maxX = longitudeToTileX(east, zoom);
  const minY = latitudeToTileY(north, zoom), maxY = latitudeToTileY(south, zoom);
  return { minX, maxX, minY, maxY, tileCount: (maxX - minX + 1) * (maxY - minY + 1) };
}

export function cartographyPlan(bounds, detail = "preview") {
  const preferredZoom = detail === "print" ? 10 : detail === "high" ? 9 : 8;
  const tileBudget = detail === "preview" ? 32 : 96;
  let zoom = preferredZoom;
  let range = tileRangeForBounds(bounds, zoom);
  while (range.tileCount > tileBudget && zoom > 4) {
    zoom -= 1;
    range = tileRangeForBounds(bounds, zoom);
  }
  if (range.tileCount > tileBudget) throw new Error(`Requested region needs ${range.tileCount} vector tiles even at zoom ${zoom}; split the route.`);
  return {
    zoom,
    tileRange: { minX: range.minX, maxX: range.maxX, minY: range.minY, maxY: range.maxY },
    tileCount: range.tileCount,
    encoding: "mvt",
    schema: "OpenMapTiles",
    layers: ["water", "waterway", "transportation", "building", "place", "boundary"],
    vectorTemplate: "/api/map/openfreemap/{z}/{x}/{y}.pbf",
    attribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"
  };
}

export function terrainPlan(bounds, detail = "preview") {
  const preferredZoom = detail === "print" ? 11 : detail === "high" ? 12 : 9;
  let zoom = preferredZoom;
  let range = tileRangeForBounds(bounds, zoom);
  while (range.tileCount > 96 && zoom > 6) {
    zoom -= 1;
    range = tileRangeForBounds(bounds, zoom);
  }
  if (range.tileCount > 96) throw new Error(`Requested region needs ${range.tileCount} terrain tiles even at zoom ${zoom}; split the route.`);
  const { minX, maxX, minY, maxY, tileCount } = range;
  return { zoom, preferredZoom, tileRange: { minX, maxX, minY, maxY }, tileCount, encoding: "terrarium", elevationFormula: "(R*256+G+B/256)-32768", terrainTemplate: "/api/terrain/terrarium/{z}/{x}/{y}.png" };
}


function isPrivateIpv4(hostname) {
  const parts=hostname.split(".").map(Number);
  if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
  return parts[0]===10
    || parts[0]===127
    || (parts[0]===169&&parts[1]===254)
    || (parts[0]===172&&parts[1]>=16&&parts[1]<=31)
    || (parts[0]===192&&parts[1]===168)
    || parts[0]===0;
}

export function isSafePublicWebUrl(value) {
  try{
    const url=new URL(String(value||""));
    if(!/^https?:$/.test(url.protocol))return false;
    if(url.username||url.password)return false;
    if(url.port&&!["80","443"].includes(url.port))return false;
    const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
    if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local"))return false;
    if(isPrivateIpv4(host))return false;
    if(host==="::1"||host.startsWith("fc")||host.startsWith("fd")||host.startsWith("fe80:"))return false;
    return true;
  }catch{return false}
}

async function cachedJsonFetch(requestUrl, context, ttlSeconds=86400) {
  const url=typeof requestUrl==="string"?requestUrl:requestUrl.toString();
  const cache=caches.default;
  const cacheKey=new Request(url,{method:"GET"});
  const cached=await cache.match(cacheKey);
  if(cached)return cached.json();
  const upstream=await fetch(url,{headers:{"user-agent":"VYNDI-Terrain-Merchandise/1.0 (+https://vayushastr.com)","accept":"application/json"}});
  if(!upstream.ok)throw new Error(`Public source returned ${upstream.status}.`);
  const data=await upstream.json();
  const response=new Response(JSON.stringify(data),{headers:{"content-type":"application/json","cache-control":`public, max-age=${ttlSeconds}`}});
  context.waitUntil(cache.put(cacheKey,response));
  return data;
}

async function searchWikidataEvents(query, context) {
  const url=new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action","wbsearchentities");
  url.searchParams.set("search",query);
  url.searchParams.set("language","en");
  url.searchParams.set("uselang","en");
  url.searchParams.set("limit","15");
  url.searchParams.set("format","json");
  url.searchParams.set("origin","*");
  const data=await cachedJsonFetch(url,context,21600);
  return (data.search||[]).map(item=>normalizeDiscoveryEvent({
    id:item.id,
    name:item.label,
    description:item.description,
    category:inferEventCategory(`${item.label||""} ${item.description||""}`),
    source:"Wikidata",
    sourceUrl:item.concepturi||`https://www.wikidata.org/wiki/${item.id}`
  }));
}

async function searchWikipediaEvents(query, context) {
  const url=new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action","query");
  url.searchParams.set("list","search");
  url.searchParams.set("srsearch",query);
  url.searchParams.set("srlimit","15");
  url.searchParams.set("format","json");
  url.searchParams.set("origin","*");
  const data=await cachedJsonFetch(url,context,21600);
  return (data.query?.search||[]).map(item=>normalizeDiscoveryEvent({
    id:`WP-${item.pageid}`,
    name:item.title,
    description:String(item.snippet||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(),
    category:inferEventCategory(`${item.title||""} ${item.snippet||""}`),
    source:"Wikipedia",
    sourceUrl:`https://en.wikipedia.org/?curid=${item.pageid}`
  }));
}

function eventResultScore(event, input) {
  const query=normalizeSearchText(expandEventSearchTerm(input.query));
  const tokens=query.split(/\s+/).filter(Boolean);
  const name=normalizeSearchText(event.name);
  const description=normalizeSearchText(event.description);
  let score=0;
  if(name===query)score+=60;
  if(name.startsWith(query))score+=25;
  if(name.includes(query))score+=20;
  for(const token of tokens)score+=name.includes(token)?7:description.includes(token)?3:0;
  if(input.category&&input.category!=="all"&&event.category===input.category)score+=18;
  return score;
}

function isLikelyEventCandidate(event,input){
  const query=normalizeSearchText(expandEventSearchTerm(input.query));
  const name=normalizeSearchText(event.name);
  const description=normalizeSearchText(event.description);
  if(!query||!name)return false;
  if(name===query||name.startsWith(query)||name.includes(query))return true;
  const queryTokens=[...new Set(query.split(" ").filter(token=>token.length>2))];
  const matched=queryTokens.filter(token=>name.includes(token));
  const coverage=queryTokens.length?matched.length/queryTokens.length:0;
  if(input.category&&input.category!=="all"&&event.category!==input.category)return false;
  if(queryTokens.length>=2&&coverage<.67)return false;
  if(queryTokens.length===1&&!name.includes(queryTokens[0]))return false;
  const obviousNonEvents=/\b(?:university|airport|metro|station|season|league|school|institute|liberation|person|cyclist|football club|fc)\b/;
  if(obviousNonEvents.test(name)&&!queryTokens.some(token=>name===token||name.startsWith(token+" ")))return false;
  const eventish=/\b(?:event|race|randon|brevet|marathon|triathlon|ultra|trail|tour|regatta|rally|championship|challenge|ride|run|cycling|swim|rowing|sailing|ski)\b/;
  return eventish.test(name)||eventish.test(description)||coverage===1;
}

async function searchGlobalEvents(input, context) {
  const fullSearch=buildEventSearchQuery(input);
  const base=expandEventSearchTerm(input.query);
  if(!fullSearch)throw new Error("Event name or search term is required.");
  const geography=[input.city,input.region,input.country,input.continent&&input.continent!=="Worldwide"?input.continent:""].filter(Boolean).join(" ");
  const category=input.category&&input.category!=="all"?input.category:"";
  const variants=[base,[base,category].filter(Boolean).join(" "),[base,geography].filter(Boolean).join(" "),fullSearch]
    .map(value=>value.replace(/\s+/g," ").trim())
    .filter((value,index,array)=>value&&array.indexOf(value)===index);
  const settled=await Promise.allSettled(variants.flatMap(term=>[searchWikidataEvents(term,context),searchWikipediaEvents(term,context)]));
  const merged=new Map();
  for(const result of settled){
    if(result.status!=="fulfilled")continue;
    for(const event of result.value){
      const key=event.name.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
      if(!merged.has(key)||event.provenance.source==="Wikidata")merged.set(key,event);
    }
  }
  return [...merged.values()]
    .filter(event=>isLikelyEventCandidate(event,input))
    .map(event=>({...event,_score:eventResultScore(event,input)}))
    .sort((a,b)=>b._score-a._score||a.name.localeCompare(b.name))
    .slice(0,12)
    .map(({_score,...event})=>event);
}

async function searchGeography(input, context) {
  const variants=buildGeographySearchQueries(input);
  if(!variants.length)throw new Error("Country, state/region, city, or place is required.");
  for(const query of variants){
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q",query);
    url.searchParams.set("format","jsonv2");
    url.searchParams.set("addressdetails","1");
    url.searchParams.set("limit","12");
    const data=await cachedJsonFetch(url,context,86400);
    const results=(data||[]).map(item=>({
      id:String(item.place_id),
      osmId:String(item.osm_id||""),
      osmType:String(item.osm_type||""),
      name:item.display_name,
      type:item.type||item.addresstype||"",
      category:item.category||"",
      lat:Number(item.lat),
      lon:Number(item.lon),
      bounds:normalizeGeoBounds(item.boundingbox),
      address:item.address||{},
      source:"OpenStreetMap / Nominatim",
      queryUsed:query
    })).filter(item=>item.bounds);
    if(results.length)return results;
  }
  return [];
}

function googleSpreadsheetCsvUrl(value=""){
  try{
    const url=new URL(value);
    if(url.hostname!=="docs.google.com"||!url.pathname.includes("/spreadsheets/d/"))return "";
    const match=url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if(!match)return "";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }catch{return ""}
}

function extractPublicResultLinks(html,baseUrl){
  const links=[];const pattern=/(?:href|src)=["']([^"']+)["']/gi;let match;
  while((match=pattern.exec(String(html||"")))!==null){
    try{
      const absolute=new URL(match[1],baseUrl).toString();
      if(googleSpreadsheetCsvUrl(absolute)||/\.csv(?:\?|$)/i.test(absolute))links.push(absolute);
    }catch{}
  }
  return [...new Set(links)].slice(0,4);
}

function participantFactsMeaningful(facts={}){
  return Boolean(facts.elapsed||facts.status||facts.placing||facts.start||facts.finish);
}

async function fetchPublicResultDocument(startUrl) {
  let current=new URL(startUrl);
  for(let redirectCount=0;redirectCount<4;redirectCount++){
    if(!isSafePublicWebUrl(current.toString()))throw new Error("Only public HTTP/HTTPS result pages are supported.");
    const response=await fetch(current.toString(),{
      redirect:"manual",
      headers:{"user-agent":"VYNDI-Terrain-Merchandise/1.0 (+https://vayushastr.com)","accept":"text/html,application/xhtml+xml,application/json,text/plain;q=0.8"}
    });
    if(response.status>=300&&response.status<400){
      const location=response.headers.get("location");
      if(!location)throw new Error("Result page redirect is missing its destination.");
      current=new URL(location,current);
      continue;
    }
    if(!response.ok)throw new Error(`Result page returned ${response.status}.`);
    const contentType=response.headers.get("content-type")||"";
    if(!/text\/html|application\/xhtml\+xml|application\/json|text\/plain|text\/csv|application\/csv/i.test(contentType))throw new Error("Result URL did not return readable public text.");
    const length=Number(response.headers.get("content-length")||0);
    if(length>2_000_000)throw new Error("Result page is too large to import safely.");
    const text=await response.text();
    if(text.length>2_000_000)throw new Error("Result page is too large to import safely.");
    return {text,url:current.toString(),contentType};
  }
  throw new Error("Too many redirects while loading the public result page.");
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if(url.pathname==="/verify"&&request.method==="GET")return authenticityVerificationPage(url,env.VYNDI_AUTH_SECRET);
    if(url.pathname.startsWith("/api/")&&!isTrustedBrowserRequest(request))return json({error:"Cross-site API access is not permitted."},403);
    if(url.pathname.startsWith("/api/")&&!await passRateLimit(env.API_RATE_LIMITER,rateLimitKey(request,url.pathname)))return json({error:"API rate limit exceeded."},429);
    if(url.pathname==="/api/authenticity/status"){
      if(request.method!=="GET")return json({error:"Method not allowed."},405);
      return json({configured:typeof env.VYNDI_AUTH_SECRET==="string"&&env.VYNDI_AUTH_SECRET.length>=32,version:1});
    }
    if(url.pathname==="/api/authenticity/issue"){
      if(request.method!=="POST")return json({error:"Method not allowed."},405);
      if(!await passRateLimit(env.AUTH_RATE_LIMITER,rateLimitKey(request,"authenticity-issue")))return json({error:"Authenticity signing rate limit exceeded."},429);
      if(typeof env.VYNDI_AUTH_SECRET!=="string"||env.VYNDI_AUTH_SECRET.length<32)return json({error:"Authenticity signing is not configured."},503);
      const contentLength=Number(request.headers.get("content-length")||0);
      if(contentLength>65536)return json({error:"Authenticity request is too large."},413);
      let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400)}
      try{
        const receipt=await issueAuthenticityReceipt(body?.manifest||body,env.VYNDI_AUTH_SECRET);
        const verificationUrl=`${url.origin}/verify?receipt=${encodeURIComponent(receipt.token)}`;
        return json({...receipt,verificationUrl});
      }catch(error){return json({error:error.message||"Authenticity receipt could not be issued."},400)}
    }
    if(url.pathname==="/api/authenticity/verify"){
      if(request.method!=="GET")return json({error:"Method not allowed."},405);
      const result=await verifyAuthenticityToken(url.searchParams.get("receipt")||"",env.VYNDI_AUTH_SECRET);
      return json(result,result.verified?200:400);
    }
    if(url.pathname==="/api/authenticity/verify-receipt"){
      if(request.method!=="POST")return json({error:"Method not allowed."},405);
      const contentLength=Number(request.headers.get("content-length")||0);
      if(contentLength>131072)return json({error:"Receipt is too large."},413);
      let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400)}
      const result=await verifyAuthenticityReceipt(body,env.VYNDI_AUTH_SECRET);
      return json(result,result.verified?200:400);
    }
    if(isRideStoriesRuntimeAsset(url.pathname) && (request.method==="GET"||request.method==="HEAD")){
      if(!env.ASSETS)return json({error:"Static assets unavailable."},503);
      const assetUrl=new URL(request.url);
      if(url.pathname==="/"||url.pathname==="/index.html")assetUrl.pathname="/index.html";
      const assetRequest=new Request(assetUrl.toString(),{method:request.method,headers:request.headers});
      const asset=await env.ASSETS.fetch(assetRequest);
      const headers=new Headers(asset.headers);
      headers.set("cache-control","no-cache, must-revalidate");
      return applySecurityHeaders(new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers}),asset.headers.get("content-type")||"");
    }
    if(isTerrainMedalRuntimeAsset(url.pathname) && (request.method==="GET"||request.method==="HEAD")){
      if(!env.ASSETS)return json({error:"Static assets unavailable."},503);
      const asset=await env.ASSETS.fetch(request);
      const headers=new Headers(asset.headers);
      headers.set("cache-control","no-cache, must-revalidate");
      return applySecurityHeaders(new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers}),asset.headers.get("content-type")||"");
    }
    if ((url.pathname === "/terrain-medal" || url.pathname === "/terrain-medal/") && (request.method === "GET" || request.method === "HEAD")) {
      if(!env.ASSETS)return json({error:"Static assets unavailable."},503);
      const assetUrl=new URL(request.url);
      assetUrl.pathname="/terrain-medal-v31.html";
      const assetRequest=new Request(assetUrl.toString(),{method:request.method,headers:request.headers});
      const asset=await env.ASSETS.fetch(assetRequest);
      const headers=new Headers(asset.headers);
      headers.set("cache-control","no-cache, must-revalidate");
      return applySecurityHeaders(new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers}),asset.headers.get("content-type")||"");
    }
    if (url.pathname === "/api/global/health") return json({ ok: true, service: "vyndi-global-discovery", geography: "OpenStreetMap / Nominatim", events: "Wikidata + Wikipedia", participantImport: "public result URL" });
    if (url.pathname === "/api/geo/search" && request.method === "GET") {
      try {
        const input={continent:url.searchParams.get("continent")||"",country:url.searchParams.get("country")||"",region:url.searchParams.get("region")||"",city:url.searchParams.get("city")||""};
        return json({results:await searchGeography(input,context),query:input});
      } catch(error) { return json({error:error.message},400); }
    }
    if(url.pathname==="/api/geo/outline"&&request.method==="GET"){
      try{
        const type={relation:"R",way:"W",node:"N"}[url.searchParams.get("type")],id=url.searchParams.get("id")||"";
        if(!type||!/^\d{1,14}$/.test(id))return json({error:"Select a valid geography search result first."},400);
        const source=new URL("https://nominatim.openstreetmap.org/lookup");
        source.searchParams.set("osm_ids",type+id);source.searchParams.set("format","jsonv2");source.searchParams.set("polygon_geojson","1");source.searchParams.set("polygon_threshold","0.002");
        const data=await cachedJsonFetch(source,context,86400),item=data?.[0];
        if(!["Polygon","MultiPolygon"].includes(item?.geojson?.type))return json({error:"This place has no polygon boundary. Choose a country, state or region with an outline."},422);
        if(JSON.stringify(item.geojson).length>1500000)return json({error:"This boundary exceeds the browser detail budget."},422);
        return json({geometry:item.geojson,name:item.display_name,source:"OpenStreetMap / Nominatim",osmId:id,osmType:url.searchParams.get("type")});
      }catch(error){return json({error:error.message},400)}
    }
    if (url.pathname === "/api/events/search" && request.method === "GET") {
      try {
        const input={query:url.searchParams.get("q")||"",category:url.searchParams.get("category")||"all",continent:url.searchParams.get("continent")||"Worldwide",country:url.searchParams.get("country")||"",region:url.searchParams.get("region")||"",city:url.searchParams.get("city")||url.searchParams.get("location")||""};
        return json({events:await searchGlobalEvents(input,context),query:input});
      } catch(error) { return json({error:error.message},400); }
    }
    if (url.pathname === "/api/events/import-result" && request.method === "POST") {
      try {
        const input=await request.json();
        if(!isSafePublicWebUrl(input.url))return json({error:"Only public HTTP/HTTPS result pages are supported."},400);
        const document=await fetchPublicResultDocument(input.url);
        let facts=extractPublicEventFacts(document.text,{participant:input.participant||"",bib:input.bib||"",sourceUrl:document.url});
        let candidates=[];
        const followed=[];
        if(participantFactsMeaningful(facts))candidates=[enrichKnownResultFacts(facts,{sourceUrl:document.url,eventName:input.eventName||""})];
        for(const link of extractPublicResultLinks(document.text,document.url)){
          const candidateUrl=googleSpreadsheetCsvUrl(link)||link;
          if(!isSafePublicWebUrl(candidateUrl))continue;
          try{
            const linked=await fetchPublicResultDocument(candidateUrl);
            followed.push(linked.url);
            const tabularCandidates=extractTabularParticipantCandidates(linked.text,{participant:input.participant||"",bib:input.bib||"",sourceUrl:linked.url})
              .map(candidate=>enrichKnownResultFacts(candidate,{sourceUrl:document.url,eventName:input.eventName||""}));
            if(tabularCandidates.length){candidates=tabularCandidates;facts=tabularCandidates[0];break}
            if(!participantFactsMeaningful(facts)){
              const tabular=extractTabularParticipantFacts(linked.text,{participant:input.participant||"",bib:input.bib||"",sourceUrl:linked.url});
              if(participantFactsMeaningful(tabular))facts={...facts,...tabular};
            }
          }catch{}
        }
        facts=enrichKnownResultFacts(facts,{sourceUrl:document.url,eventName:input.eventName||""});
        return json({facts,candidates,source:{url:document.url,contentType:document.contentType,followed}});
      } catch(error) { return json({error:error.message},400); }
    }
    if (url.pathname === "/api/terrain/health") return json({ ok: true, service: "vyndi-terrain", source: "AWS Terrain Tiles" });
    if (url.pathname === "/api/map/health") return json({ ok: true, service: "vyndi-cartography", source: "OpenFreeMap / OpenMapTiles / OpenStreetMap" });
    if (url.pathname === "/api/terrain/opentopography" && request.method === "POST") {
      try {
        const input=await request.json();
        const dataset=String(input.dataset||"COP30");
        const apiKey=String(input.apiKey||"").trim();
        const bounds=input.bounds||{};
        const south=Number(bounds.minLat),north=Number(bounds.maxLat),west=Number(bounds.minLon),east=Number(bounds.maxLon);
        if(!OPEN_TOPO_DATASETS.has(dataset))return json({error:"Unsupported OpenTopography dataset."},400);
        if(!apiKey)return json({error:"OpenTopography API key is required."},400);
        if(![south,north,west,east].every(Number.isFinite)||south>=north||west>=east)return json({error:"Valid geographic bounds are required."},400);
        const upstreamUrl=new URL("https://portal.opentopography.org/API/globaldem");
        upstreamUrl.searchParams.set("demtype",dataset);
        upstreamUrl.searchParams.set("south",String(south));
        upstreamUrl.searchParams.set("north",String(north));
        upstreamUrl.searchParams.set("west",String(west));
        upstreamUrl.searchParams.set("east",String(east));
        upstreamUrl.searchParams.set("outputFormat","AAIGrid");
        upstreamUrl.searchParams.set("API_Key",apiKey);
        const upstream=await fetch(upstreamUrl.toString(),{headers:{"user-agent":"VYNDI-Terrain-Merchandise/1.0 (+https://vayushastr.com)","accept":"text/plain,*/*"}});
        if(!upstream.ok)return json({error:`OpenTopography returned ${upstream.status}.`},502);
        const text=await upstream.text();
        if(text.length>12_000_000)return json({error:"OpenTopography grid is too large for browser processing."},413);
        return applySecurityHeaders(new Response(text,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store","x-terrain-source":`opentopography-${dataset}`}}),"text/plain; charset=utf-8");
      } catch(error) { return json({error:error.message},400); }
    }
    if (url.pathname === "/api/terrain/plan" && request.method === "POST") {
      try { const input = await request.json(); return json(terrainPlan(input.bounds, input.detail)); }
      catch (error) { return json({ error: error.message }, 400); }
    }
    if (url.pathname === "/api/map/plan" && request.method === "POST") {
      try { const input = await request.json(); return json(cartographyPlan(input.bounds, input.detail)); }
      catch (error) { return json({ error: error.message }, 400); }
    }
    const vectorMatch = url.pathname.match(/^\/api\/map\/openfreemap\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
    if (vectorMatch) {
      const [, z, x, y] = vectorMatch;
      if (Number(z) > 14) return json({ error: "Maximum supported vector zoom is 14." }, 400);
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      const cached = await cache.match(cacheKey);
      if (cached) return applySecurityHeaders(cached,cached.headers.get("content-type")||"");
      const upstream = await fetch(`${OPENFREEMAP_ORIGIN}/${z}/${x}/${y}.pbf`, { headers: { "user-agent": "VYNDI-Terrain-Merchandise/1.0", "accept": "application/vnd.mapbox-vector-tile,application/x-protobuf" } });
      if (!upstream.ok) return json({ error: `Vector map source returned ${upstream.status}.` }, 502);
      const response = applySecurityHeaders(new Response(upstream.body,{headers:{"content-type":"application/vnd.mapbox-vector-tile","cache-control":"public, max-age=604800","x-map-source":"openfreemap-openmaptiles-osm"}}),"application/vnd.mapbox-vector-tile");
      context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
    const match = url.pathname.match(/^\/api\/terrain\/terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (match) {
      const [, z, x, y] = match;
      if (Number(z) > 12) return json({ error: "Maximum supported terrain zoom is 12." }, 400);
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      const cached = await cache.match(cacheKey);
      if (cached) return applySecurityHeaders(cached,cached.headers.get("content-type")||"");
      const upstream = await fetch(`${TERRARIUM_ORIGIN}/${z}/${x}/${y}.png`, { headers: { "user-agent": "VYNDI-Terrain-Merchandise/1.0" } });
      if (!upstream.ok) return json({ error: `Terrain source returned ${upstream.status}.` }, 502);
      const response = applySecurityHeaders(new Response(upstream.body,{headers:{"content-type":"image/png","cache-control":"public, max-age=604800","x-terrain-source":"aws-open-data"}}),"image/png");
      context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : json({ error: "Not found" }, 404);
  }
};
