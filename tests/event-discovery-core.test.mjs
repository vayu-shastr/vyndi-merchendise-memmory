import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTINENTS,
  buildEventSearchQuery,
  buildGeographySearchQueries,
  expandEventSearchTerm,
  enrichKnownResultFacts,
  buildMedalMetaLines,
  extractPublicEventFacts,
  extractTabularParticipantFacts,
  extractTabularParticipantCandidates,
  normalizeDiscoveryEvent,
  normalizeGeoBounds,
  normalizeSearchText,
  inferEventCategory
} from "../dist/event-discovery-core.mjs";

test("global geography exposes all continent choices plus worldwide",()=>{
  assert.ok(CONTINENTS.includes("Worldwide"));
  for(const name of ["Africa","Asia","Europe","North America","South America","Oceania","Antarctica"]) assert.ok(CONTINENTS.includes(name));
});

test("event search query combines event, geography and category without empty noise",()=>{
  assert.equal(buildEventSearchQuery({query:"Paris Brest Paris",category:"cycling",continent:"Europe",country:"France",region:"Brittany",city:"Brest"}),"Paris-Brest-Paris cycling Brest Brittany France Europe");
  assert.equal(buildEventSearchQuery({query:"UTMB",continent:"Worldwide"}),"Ultra-Trail du Mont-Blanc");
});

test("geographic result bounds normalize south north west east order",()=>{
  assert.deepEqual(normalizeGeoBounds(["48.0","49.0","-5.0","3.0"]),{minLat:48,maxLat:49,minLon:-5,maxLon:3});
  assert.equal(normalizeGeoBounds(["49","48","-5","3"]),null);
});

test("discovered event records retain factual source provenance",()=>{
  const record=normalizeDiscoveryEvent({id:"Q1",name:"Test 600",description:"Cycling brevet",source:"Wikidata",sourceUrl:"https://www.wikidata.org/wiki/Q1",location:"France",editionDate:"2026-08-01",distance:"600 km"});
  assert.equal(record.name,"Test 600");
  assert.equal(record.category,"cycling");
  assert.equal(record.provenance.source,"Wikidata");
  assert.equal(record.provenance.sourceUrl,"https://www.wikidata.org/wiki/Q1");
});

test("public result extraction reads event JSON-LD and nearby participant facts when present",()=>{
  const html=`<html><head><script type="application/ld+json">{"@type":"SportsEvent","name":"Mountain 600","startDate":"2026-05-02T06:00:00+05:30","endDate":"2026-05-03T11:30:00+05:30","location":{"name":"Ooty","address":{"addressRegion":"Tamil Nadu","addressCountry":"India"}}}</script></head><body><table><tr><td>Shyam Sundhar</td><td>Bib AIR 17306</td><td>Status Finished</td><td>Elapsed 29:30:00</td><td>Overall 14</td><td>Start 06:02</td><td>Finish 11:32</td></tr></table></body></html>`;
  const facts=extractPublicEventFacts(html,{participant:"Shyam Sundhar",bib:"AIR 17306",sourceUrl:"https://example.org/results"});
  assert.equal(facts.eventName,"Mountain 600");
  assert.match(facts.location,/Ooty/);
  assert.equal(facts.status,"Finished");
  assert.equal(facts.elapsed,"29:30:00");
  assert.equal(facts.placing,"14");
  assert.match(facts.start,/06:02/);
  assert.match(facts.finish,/11:32/);
  assert.equal(facts.sourceUrl,"https://example.org/results");
});

test("medal metadata compacts available rider and event facts into printable lines",()=>{
  const lines=buildMedalMetaLines({editionDate:"2026-08-16",location:"Brest, France",distance:"1,230 km",bib:"I277",startDetail:"05:18",finishDetail:"17:44",elapsedTime:"36:26:00",resultStatus:"Finished",placing:"214"});
  assert.deepEqual(lines,[
    "2026-08-16 · Brest, France",
    "1,230 km · BIB I277",
    "START 05:18 · FINISH 17:44",
    "36:26:00 · Finished · PLACE 214"
  ]);
});


test("global event taxonomy recognizes land, water, motor and winter events",()=>{
  assert.equal(inferEventCategory("Open Water Swimming Championship"),"swimming");
  assert.equal(inferEventCategory("Coastal Rowing Regatta"),"rowing");
  assert.equal(inferEventCategory("Offshore Sailing Regatta"),"sailing");
  assert.equal(inferEventCategory("Desert Rally Motorsport"),"motorsport");
  assert.equal(inferEventCategory("Ski Mountaineering Winter Race"),"winter");
  assert.equal(inferEventCategory("Mountain Adventure Trek Orienteering"),"adventure");
});


test("geography search progressively broadens without appending continent to a precise place query",()=>{
  assert.deepEqual(buildGeographySearchQueries({continent:"Asia",country:"India",region:"Tamil Nadu",city:"Ooty"}),[
    "Ooty, Tamil Nadu, India",
    "Ooty, India",
    "Tamil Nadu, India",
    "India",
    "Asia"
  ]);
  assert.deepEqual(buildGeographySearchQueries({continent:"Europe"}),["Europe"]);
});

test("event text normalization makes hyphen and en-dash event names comparable",()=>{
  assert.equal(normalizeSearchText("Paris-Brest-Paris"),"paris brest paris");
  assert.equal(normalizeSearchText("Paris–Brest–Paris"),"paris brest paris");
  assert.equal(normalizeSearchText("  UTMB®  Mont-Blanc "),"utmb mont blanc");
});


test("tabular participant extraction reads public PBP-style spreadsheet rows by bib and name",()=>{
  const csv=[
    "Année,Temps,Plaque,Nom-Prénom,Nat.,Sexe,Mach,Club",
    "2023,87:20,I277,SUNDHAR Shyam,IN,M,VE,BHUBANESWAR CYCLING AND ADVENTURE CLUB"
  ].join("\n");
  const facts=extractTabularParticipantFacts(csv,{participant:"Shyam Sundhar",bib:"I277",sourceUrl:"https://docs.google.com/spreadsheets/d/example/export?format=csv"});
  assert.equal(facts.bib,"I277");
  assert.equal(facts.participant,"SUNDHAR Shyam");
  assert.equal(facts.elapsed,"87:20");
  assert.equal(facts.status,"Finished");
  assert.equal(facts.editionYear,"2023");
  assert.equal(facts.confidence,"participant-row");
});

test("tabular participant extraction understands H-style elapsed durations and ACP non-finish codes",()=>{
  const csv=["Année;Temps;Plaque;Nom-Prénom","2023;87H20;I277;SUNDHAR Shyam"].join("\n");
  const finished=extractTabularParticipantFacts(csv,{bib:"I277"});
  assert.equal(finished.elapsed,"87:20");
  assert.equal(finished.status,"Finished");
  const dnf=extractTabularParticipantFacts("Année;Temps;Plaque;Nom-Prénom\n2023;AB;I277;SUNDHAR Shyam",{bib:"I277"});
  assert.equal(dnf.status,"DNF");
  assert.equal(dnf.elapsed,"");
});


test("short PBP alias expands to the canonical event instead of generic acronym search",()=>{
  assert.equal(expandEventSearchTerm("pbp"),"Paris-Brest-Paris");
  assert.equal(expandEventSearchTerm("Paris Brest Paris"),"Paris-Brest-Paris");
});

test("known PBP result source enriches a participant row with event date, wave start and computed finish",()=>{
  const facts=enrichKnownResultFacts({
    participant:"SUNDHAR Shyam",
    bib:"I277",
    elapsed:"87:20",
    status:"Finished",
    editionYear:"2023",
    sourceUrl:"https://docs.google.com/spreadsheets/d/example/export?format=csv"
  },{
    sourceUrl:"https://www.audax-club-parisien.com/palmares-du-paris-brest-paris/palmares-paris-brest-paris-randonneur-2023/"
  });
  assert.equal(facts.eventPreset,"pbp2023");
  assert.equal(facts.eventName,"Paris–Brest–Paris 2023");
  assert.equal(facts.editionDate,"2023-08-20");
  assert.equal(facts.location,"Rambouillet, Île-de-France, France");
  assert.equal(facts.distance,"1,219 km");
  assert.equal(facts.start,"20 Aug 2023 18:00");
  assert.equal(facts.finish,"24 Aug 2023 09:20");
  assert.equal(facts.elapsed,"87:20");
  assert.equal(facts.placing,"");
});


test("participant candidate search returns selectable PBP riders without mutating the query",()=>{
  const csv=[
    "Année,Temps,Plaque,Nom-Prénom,Nat.,Sexe,Mach,Club",
    "2023,72:17,+130,ABELS Aljoscha,DE,M,VE,TEST CLUB",
    "2023,87:20,I277,SUNDHAR Shyam,IN,M,VE,BHUBANESWAR CYCLING AND ADVENTURE CLUB",
    "2023,85:42,I278,SUNDHAR Ravi,IN,M,VE,OTHER CLUB"
  ].join("\n");
  const byName=extractTabularParticipantCandidates(csv,{participant:"sundhar",sourceUrl:"https://example.org/results.csv"});
  assert.equal(byName.length,2);
  assert.deepEqual(byName.map(item=>item.bib).sort(),["I277","I278"]);
  const byBib=extractTabularParticipantCandidates(csv,{bib:"I277",sourceUrl:"https://example.org/results.csv"});
  assert.equal(byBib.length,1);
  assert.equal(byBib[0].participant,"SUNDHAR Shyam");
  assert.equal(byBib[0].elapsed,"87:20");
});

test("participant candidate search requires at least a meaningful name or bib fragment",()=>{
  const csv="Année,Temps,Plaque,Nom-Prénom\n2023,72:17,+130,ABELS Aljoscha";
  assert.deepEqual(extractTabularParticipantCandidates(csv,{participant:"a"}),[]);
  assert.deepEqual(extractTabularParticipantCandidates(csv,{bib:""}),[]);
});
