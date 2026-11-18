// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { FluentBundle, FluentResource } from "../vendor/fluent-bundle/index.js";
import { CATALOGS } from "./catalogs.mjs";

export function cardinal(val) { return { type: "cardinal", value: val }; }
export function integer(val) { return { type: "integer", value: val }; }

const LOCALES = {
  "en-US": { bundleLocale: "en-US", cardinal: "en" },
};

const CATEGORIES = {
  "en": (n) => (n == 1) ? "one" : "other",
};

const MESSAGES = {
  "trust.about.body": {
    resourceKey: "m74727573742e61626f75742e626f6479",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.asserteduntilwhen": {
    resourceKey: "m74727573742e617869732e6173736572746564756e74696c7768656e",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.axis.detail": {
    resourceKey: "m74727573742e617869732e64657461696c",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.freshuntilwhen": {
    resourceKey: "m74727573742e617869732e6672657368756e74696c7768656e",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.axis.howthiswaschecked": {
    resourceKey: "m74727573742e617869732e686f7774686973776173636865636b6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.item": {
    resourceKey: "m74727573742e617869732e6974656d",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.key": {
    resourceKey: "m74727573742e617869732e6b6579",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.notesha256digestbyteslength": {
    resourceKey: "m74727573742e617869732e6e6f746573686132353664696765737462797465736c656e677468",
    formatIntent: "cardinal",
    selectorVar: "length",
    arguments: [
      { name: "length", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "digest", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "note", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.axis.raw": {
    resourceKey: "m74727573742e617869732e726177",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.signed": {
    resourceKey: "m74727573742e617869732e7369676e6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.signedwhen": {
    resourceKey: "m74727573742e617869732e7369676e65647768656e",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.axis.stamp": {
    resourceKey: "m74727573742e617869732e7374616d70",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.axis.verified": {
    resourceKey: "m74727573742e617869732e7665726966696564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.axis.verifiedwhen": {
    resourceKey: "m74727573742e617869732e76657269666965647768656e",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.chrome.backto": {
    resourceKey: "m74727573742e6368726f6d652e6261636b746f",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.claims.doesnotprove": {
    resourceKey: "m74727573742e636c61696d732e646f65736e6f7470726f7665",
    formatIntent: "text",
    arguments: [
      { name: "claim", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.claims.doesprove": {
    resourceKey: "m74727573742e636c61696d732e646f657370726f7665",
    formatIntent: "text",
    arguments: [
      { name: "claim", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.amanifestbindingthev1releaserecordsintothev": {
    resourceKey: "m74727573742e636f70792e616d616e696665737462696e64696e67746865763172656c656173657265636f726473696e746f74686576",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.arecordofproductversionwasexpectedbasisandi": {
    resourceKey: "m74727573742e636f70792e617265636f72646f6670726f6475637476657273696f6e77617365787065637465646261736973616e6469",
    formatIntent: "text",
    arguments: [
      { name: "basis", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.asignedvaliditywindowonthisregisterhadpassed": {
    resourceKey: "m74727573742e636f70792e617369676e656476616c696469747977696e646f776f6e746869737265676973746572686164706173736564",
    formatIntent: "text",
    arguments: [
      { name: "date", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.eachproductbelowshowswhetherithasasignedrec": {
    resourceKey: "m74727573742e636f70792e6561636870726f6475637462656c6f7773686f7773776865746865726974686173617369676e6564726563",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.everyrecordonthissiteissignedandyoucanchec": {
    resourceKey: "m74727573742e636f70792e65766572797265636f72646f6e746869737369746569737369676e6564616e64796f7563616e63686563",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.newestrecordedreleaseversionsigneddate": {
    resourceKey: "m74727573742e636f70792e6e65776573747265636f7264656472656c6561736576657273696f6e7369676e656464617465",
    formatIntent: "text",
    arguments: [
      { name: "date", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.nonepublishedyet": {
    resourceKey: "m74727573742e636f70792e6e6f6e657075626c6973686564796574",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.publicationtothisregisterispausedrightnowby": {
    resourceKey: "m74727573742e636f70792e7075626c69636174696f6e746f746869737265676973746572697370617573656472696768746e6f776279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.publishingrecords": {
    resourceKey: "m74727573742e636f70792e7075626c697368696e677265636f726473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solpbchascreateditsv2signingrootandboundth1": {
    resourceKey: "m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f74616e64626f756e64746831",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solpbchascreateditsv2signingrootandboundth2": {
    resourceKey: "m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f74616e64626f756e64746832",
    formatIntent: "text",
    arguments: [
      { name: "products", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.solpbchascreateditsv2signingrooteveryv1rec": {
    resourceKey: "m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f7465766572797631726563",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solpbchascreateditsv2signingrootnoreleaser": {
    resourceKey: "m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f746e6f72656c6561736572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solpbchaspublishedsignedrecordsforsomeofits": {
    resourceKey: "m74727573742e636f70792e736f6c7062636861737075626c69736865647369676e65647265636f726473666f72736f6d656f66697473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solpbcpublishesreleaserecordsunderitsv2signi": {
    resourceKey: "m74727573742e636f70792e736f6c7062637075626c697368657372656c656173657265636f726473756e64657269747376327369676e69",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa": {
    resourceKey: "m74727573742e636f70792e736f6c73746f6e65666f726c696e7578616e64736f6c73746f6e65666f7277696e646f777361726573657061",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.solstoneisatrademarkofsolpbc": {
    resourceKey: "m74727573742e636f70792e736f6c73746f6e6569736174726164656d61726b6f66736f6c706263",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatourregistercurrentlyhasnosignedrecordfor": {
    resourceKey: "m74727573742e636f70792e746861746f7572726567697374657263757272656e746c796861736e6f7369676e65647265636f7264666f72",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatsolpbcsignedarecordnamingtheseexactarti": {
    resourceKey: "m74727573742e636f70792e74686174736f6c7062637369676e6564617265636f72646e616d696e677468657365657861637461727469",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatsolpbcsignedarecordnamingthisreleasesex": {
    resourceKey: "m74727573742e636f70792e74686174736f6c7062637369676e6564617265636f72646e616d696e677468697372656c65617365736578",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatsolpbcssigningkeyattestedtheseexactartif": {
    resourceKey: "m74727573742e636f70792e74686174736f6c706263737369676e696e676b65796174746573746564746865736565786163746172746966",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatsolstonehasneverbeenreleasedforwindows": {
    resourceKey: "m74727573742e636f70792e74686174736f6c73746f6e656861736e657665726265656e72656c6561736564666f7277696e646f7773",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thattheseareallthejournalversionsweverelease": {
    resourceKey: "m74727573742e636f70792e746861747468657365617265616c6c7468656a6f75726e616c76657273696f6e737765766572656c65617365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatthesourcecodewepointtoproducedtheseexac": {
    resourceKey: "m74727573742e636f70792e74686174746865736f75726365636f64657765706f696e74746f70726f6475636564746865736565786163",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thatthisistheonlylinuxreleasewevemadeortha": {
    resourceKey: "m74727573742e636f70792e746861747468697369737468656f6e6c796c696e757872656c65617365776576656d6164656f72746861",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandexited2becauseitcouldntreaditsinp": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e6465786974656432626563617573656974636f756c646e7472656164697473696e70",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandexited2becausethepinnedrootcouldnt": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e64657869746564326265636175736574686570696e6e6564726f6f74636f756c646e74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandprintedacceptedandexited0theregist": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e647072696e7465646163636570746564616e6465786974656430746865726567697374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandprintedacceptedreleaserecordandexit": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e647072696e746564616363657074656472656c656173657265636f7264616e6465786974",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandprintedrejectedwithareasonandexite1": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e647072696e74656472656a65637465647769746861726561736f6e616e64657869746531",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thecommandprintedrejectedwithareasonandexite2": {
    resourceKey: "m74727573742e636f70792e746865636f6d6d616e647072696e74656472656a65637465647769746861726561736f6e616e64657869746532",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thedistributedfilesthemselvesarenthostedonthi": {
    resourceKey: "m74727573742e636f70792e746865646973747269627574656466696c65737468656d73656c7665736172656e74686f737465646f6e746869",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.theproductsbelowaretheoneswevepublishedatle": {
    resourceKey: "m74727573742e636f70792e74686570726f647563747362656c6f776172657468656f6e6573776576657075626c697368656461746c65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.therearethreewaystocheckwhatisherev1record": {
    resourceKey: "m74727573742e636f70792e7468657265617265746872656577617973746f636865636b7768617469736865726576317265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.therecordforversiondidnotverifyreasonsonoth": {
    resourceKey: "m74727573742e636f70792e7468657265636f7264666f7276657273696f6e6469646e6f74766572696679726561736f6e736f6e6f7468",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.therecordstateswhatitdoesanddoesnotprovebo": {
    resourceKey: "m74727573742e636f70792e7468657265636f7264737461746573776861746974646f6573616e64646f65736e6f7470726f7665626f",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.theregistermovesfromthev1tipprevtothefirst": {
    resourceKey: "m74727573742e636f70792e74686572656769737465726d6f76657366726f6d746865763174697070726576746f7468656669727374",
    formatIntent: "text",
    arguments: [
      { name: "next", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "prev", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.theresnorecordhereforthatversionthatisntevi": {
    resourceKey: "m74727573742e636f70792e7468657265736e6f7265636f726468657265666f727468617476657273696f6e7468617469736e74657669",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.theresnorecordhereforversionthechainrunsfro": {
    resourceKey: "m74727573742e636f70792e7468657265736e6f7265636f726468657265666f7276657273696f6e746865636861696e72756e7366726f",
    formatIntent: "text",
    arguments: [
      { name: "next", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "prev", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.theresnothingatthisaddressheadbacktothetrus": {
    resourceKey: "m74727573742e636f70792e7468657265736e6f7468696e6761747468697361646472657373686561646261636b746f74686574727573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.theselinesarepublishedatmorethanonelocation": {
    resourceKey: "m74727573742e636f70792e74686573656c696e65736172657075626c697368656461746d6f72657468616e6f6e656c6f636174696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thesignaturechecksoutthisexactrecordmatchesw": {
    resourceKey: "m74727573742e636f70792e7468657369676e6174757265636865636b736f75747468697365786163747265636f72646d61746368657377",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy": {
    resourceKey: "m74727573742e636f70792e7468657369676e6174757265646f65736e74636865636b6f7574646f6e74747275737474686973636f7079",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thev1chainofproductclosedatversionitishist": {
    resourceKey: "m74727573742e636f70792e7468657631636861696e6f6670726f64756374636c6f736564617476657273696f6e6974697368697374",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thev1chainrecordednoreleaseofsolstoneforwin": {
    resourceKey: "m74727573742e636f70792e7468657631636861696e7265636f726465646e6f72656c656173656f66736f6c73746f6e65666f7277696e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thev1releaserecordscountobjectsareboundinto": {
    resourceKey: "m74727573742e636f70792e746865763172656c656173657265636f726473636f756e746f626a65637473617265626f756e64696e746f",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thev1releaserecordsofproductscountobjectsare": {
    resourceKey: "m74727573742e636f70792e746865763172656c656173657265636f7264736f6670726f6475637473636f756e746f626a65637473617265",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "products", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thev2registerdidnotverifywhenthispagewasbu": {
    resourceKey: "m74727573742e636f70792e746865763272656769737465726469646e6f747665726966797768656e74686973706167657761736275",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisfiledescribesthev1chaininthev1chainsow": {
    resourceKey: "m74727573742e636f70792e7468697366696c656465736372696265737468657631636861696e696e7468657631636861696e736f77",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thisisthesignedrecordofproductversionpublish1": {
    resourceKey: "m74727573742e636f70792e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736831",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "published_utc", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "valid_until", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisisthesignedrecordofproductversionpublish2": {
    resourceKey: "m74727573742e636f70792e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736832",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "published_utc", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "valid_until", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisisthev2releaserecordofproductversionsig": {
    resourceKey: "m74727573742e636f70792e746869736973746865763272656c656173657265636f72646f6670726f6475637476657273696f6e736967",
    formatIntent: "text",
    arguments: [
      { name: "asserted_until", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "issued_at", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thiskeyverifieseverysignedrecordpublishedint": {
    resourceKey: "m74727573742e636f70792e746869736b6579766572696669657365766572797369676e65647265636f72647075626c6973686564696e74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing": {
    resourceKey: "m74727573742e636f70792e746869736b657976657269666965737468657631636861696e6f6e6c7969747369676e736e6f7468696e67",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thispageisaboutproductthesolstoneappthejour": {
    resourceKey: "m74727573742e636f70792e7468697370616765697361626f757470726f64756374746865736f6c73746f6e656170707468656a6f7572",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisregisteralsoholdsrecordsforproductsthisp": {
    resourceKey: "m74727573742e636f70792e746869737265676973746572616c736f686f6c64737265636f726473666f7270726f64756374737468697370",
    formatIntent: "text",
    arguments: [
      { name: "products", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisregisterhasnosignedrecordsforawindowsre": {
    resourceKey: "m74727573742e636f70792e7468697372656769737465726861736e6f7369676e65647265636f726473666f726177696e646f77737265",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.thisregisterholdsav2releaserecordofproductv1": {
    resourceKey: "m74727573742e636f70792e746869737265676973746572686f6c647361763272656c656173657265636f72646f6670726f647563747631",
    formatIntent: "text",
    arguments: [
      { name: "issued_at", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisregisterholdsav2releaserecordofproductv2": {
    resourceKey: "m74727573742e636f70792e746869737265676973746572686f6c647361763272656c656173657265636f72646f6670726f647563747632",
    formatIntent: "text",
    arguments: [
      { name: "issued_at", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisregisterholdscountsignedrecordforsolstone": {
    resourceKey: "m74727573742e636f70792e746869737265676973746572686f6c6473636f756e747369676e65647265636f7264666f72736f6c73746f6e65",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "date", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.thisregisterholdsnosignedrecordsforsolstones": {
    resourceKey: "m74727573742e636f70792e746869737265676973746572686f6c64736e6f7369676e65647265636f726473666f72736f6c73746f6e6573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.trustsolstoneappiswheresolpbcexplainsinplai": {
    resourceKey: "m74727573742e636f70792e7472757374736f6c73746f6e6561707069737768657265736f6c7062636578706c61696e73696e706c6169",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.v1chainclosedatversionnov2recordinthisregi": {
    resourceKey: "m74727573742e636f70792e7631636861696e636c6f736564617476657273696f6e6e6f76327265636f7264696e7468697372656769",
    formatIntent: "text",
    arguments: [
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.v1chainclosedatversionv2registernotchecked": {
    resourceKey: "m74727573742e636f70792e7631636861696e636c6f736564617476657273696f6e763272656769737465726e6f74636865636b6564",
    formatIntent: "text",
    arguments: [
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.copy.v1onlynonewsignatures": {
    resourceKey: "m74727573742e636f70792e76316f6e6c796e6f6e65777369676e617475726573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe": {
    resourceKey: "m74727573742e636f70792e76327265636f726473617265636f7665726564627976657269667976327768696368636865636b73746865",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.verifyreleasechecksonev2recorditwalksfromyo": {
    resourceKey: "m74727573742e636f70792e76657269667972656c65617365636865636b736f6e6576327265636f7264697477616c6b7366726f6d796f",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.copy.wecouldntcompletethecheckusuallyanetworkora": {
    resourceKey: "m74727573742e636f70792e7765636f756c646e74636f6d706c657465746865636865636b757375616c6c79616e6574776f726b6f7261",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.artifactsmanifestsproofsmusteachbearrays": {
    resourceKey: "m74727573742e646961672e6172746966616374736d616e69666573747370726f6f66736d757374656163686265617272617973",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.brokenchainlinkentrydeclaresprevsha256declare": {
    resourceKey: "m74727573742e646961672e62726f6b656e636861696e6c696e6b656e7472796465636c61726573707265767368613235366465636c617265",
    formatIntent: "text",
    arguments: [
      { name: "actual", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "declared", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.candidatewasnotalreadyinnormalizedformrefusin": {
    resourceKey: "m74727573742e646961672e63616e6469646174657761736e6f74616c7265616479696e6e6f726d616c697a6564666f726d7265667573696e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.couldnotfetchthepinnedpublickey": {
    resourceKey: "m74727573742e646961672e636f756c646e6f74666574636874686570696e6e65647075626c69636b6579",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.couldnotparseminisignkeyidfromthepublickey": {
    resourceKey: "m74727573742e646961672e636f756c646e6f7470617273656d696e697369676e6b6579696466726f6d7468657075626c69636b6579",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.couldnotruntheverifiererror": {
    resourceKey: "m74727573742e646961672e636f756c646e6f7472756e74686576657269666965726572726f72",
    formatIntent: "text",
    arguments: [
      { name: "error", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.credentialsnotallowedinarawlink": {
    resourceKey: "m74727573742e646961672e63726564656e7469616c736e6f74616c6c6f776564696e617261776c696e6b",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.degraded": {
    resourceKey: "m74727573742e646961672e6465677261646564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.entrybodyisnotvalidjson": {
    resourceKey: "m74727573742e646961672e656e747279626f647969736e6f7476616c69646a736f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.entryhasnoproductfield": {
    resourceKey: "m74727573742e646961672e656e7472796861736e6f70726f647563746669656c64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.entryhasnoversionfield": {
    resourceKey: "m74727573742e646961672e656e7472796861736e6f76657273696f6e6669656c64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.fragmentnotallowedinarawlink": {
    resourceKey: "m74727573742e646961672e667261676d656e746e6f74616c6c6f776564696e617261776c696e6b",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.hostmustbeexpectedgothost": {
    resourceKey: "m74727573742e646961672e686f73746d75737462656578706563746564676f74686f7374",
    formatIntent: "text",
    arguments: [
      { name: "expected", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "host", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.minisignverificationfailederror": {
    resourceKey: "m74727573742e646961672e6d696e697369676e766572696669636174696f6e6661696c65646572726f72",
    formatIntent: "text",
    arguments: [
      { name: "error", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.nocanonicalartifactrouteforproductproduct": {
    resourceKey: "m74727573742e646961672e6e6f63616e6f6e6963616c6172746966616374726f757465666f7270726f6475637470726f64756374",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.nonasciivalueatpath": {
    resourceKey: "m74727573742e646961672e6e6f6e617363696976616c7565617470617468",
    formatIntent: "text",
    arguments: [
      { name: "path", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.nondefaultportnotallowed": {
    resourceKey: "m74727573742e646961672e6e6f6e64656661756c74706f72746e6f74616c6c6f776564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.notaparseableurl": {
    resourceKey: "m74727573742e646961672e6e6f7461706172736561626c6575726c",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.operatordecision2026081218": {
    resourceKey: "m74727573742e646961672e6f70657261746f726465636973696f6e32303236303831323138",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.operatordecision2026081218publicationisdelib": {
    resourceKey: "m74727573742e646961672e6f70657261746f726465636973696f6e323032363038313231387075626c69636174696f6e697364656c6962",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.pathcontainsadoubledseparator": {
    resourceKey: "m74727573742e646961672e70617468636f6e7461696e7361646f75626c6564736570617261746f72",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.pathcontainsanencodedseparatorordotsegmentam": {
    resourceKey: "m74727573742e646961672e70617468636f6e7461696e73616e656e636f646564736570617261746f726f72646f747365676d656e74616d",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.pathmustnameonefiledirectlyunderprefix": {
    resourceKey: "m74727573742e646961672e706174686d7573746e616d656f6e6566696c656469726563746c79756e646572707265666978",
    formatIntent: "text",
    arguments: [
      { name: "prefix", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.pointerbodyisnotvalidjson": {
    resourceKey: "m74727573742e646961672e706f696e746572626f647969736e6f7476616c69646a736f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.pointerismissingarequiredfield": {
    resourceKey: "m74727573742e646961672e706f696e74657269736d697373696e676172657175697265646669656c64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.prevmismatchcommentcommentbodybody": {
    resourceKey: "m74727573742e646961672e707265766d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479",
    formatIntent: "text",
    arguments: [
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.prevsha256mustbeexactly64lowercasehexcharact": {
    resourceKey: "m74727573742e646961672e707265767368613235366d757374626565786163746c7936346c6f7765726361736568657863686172616374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.prevversionfieldmissinguseemptystringatgenes": {
    resourceKey: "m74727573742e646961672e7072657676657273696f6e6669656c646d697373696e67757365656d707479737472696e67617467656e6573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.productmismatchcommentcommentbodybody": {
    resourceKey: "m74727573742e646961672e70726f647563746d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479",
    formatIntent: "text",
    arguments: [
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.publishedutcmustbeexactlyyyyymmddthhmmsszg": {
    resourceKey: "m74727573742e646961672e7075626c69736865647574636d757374626565786163746c79797979796d6d64647468686d6d73737a67",
    formatIntent: "text",
    arguments: [
      { name: "value", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.querystringnotallowedinarawlink": {
    resourceKey: "m74727573742e646961672e7175657279737472696e676e6f74616c6c6f776564696e617261776c696e6b",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.schememustbehttpsgotscheme": {
    resourceKey: "m74727573742e646961672e736368656d656d75737462656874747073676f74736368656d65",
    formatIntent: "text",
    arguments: [
      { name: "scheme", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.seq1mustbegenesisprevsha256allzeroandprev": {
    resourceKey: "m74727573742e646961672e736571316d757374626567656e6573697370726576736861323536616c6c7a65726f616e6470726576",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.seqmismatchcommentcommentbodybody": {
    resourceKey: "m74727573742e646961672e7365716d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479",
    formatIntent: "text",
    arguments: [
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.seqmustbeapositiveintegergotvalue": {
    resourceKey: "m74727573742e646961672e7365716d757374626561706f736974697665696e7465676572676f7476616c7565",
    formatIntent: "text",
    arguments: [
      { name: "value", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.sha256mismatchcommentcommentbodybody": {
    resourceKey: "m74727573742e646961672e7368613235366d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479",
    formatIntent: "text",
    arguments: [
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.signatureverifiedbutnotrustedcommentwasreturn": {
    resourceKey: "m74727573742e646961672e7369676e617475726576657269666965646275746e6f74727573746564636f6d6d656e7477617372657475726e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.signedatvaliduntilmustbeexactlyyyyymmddthh": {
    resourceKey: "m74727573742e646961672e7369676e6564617476616c6964756e74696c6d757374626565786163746c79797979796d6d6464746868",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.thesignedfreshnesspointercouldnotbefetched": {
    resourceKey: "m74727573742e646961672e7468657369676e656466726573686e657373706f696e746572636f756c646e6f74626566657463686564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.diag.thesignedfreshnesspointerdidnotverifydetail": {
    resourceKey: "m74727573742e646961672e7468657369676e656466726573686e657373706f696e7465726469646e6f7476657269667964657461696c",
    formatIntent: "text",
    arguments: [
      { name: "detail", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.trustedcommentbindingfaileddetail": {
    resourceKey: "m74727573742e646961672e74727573746564636f6d6d656e7462696e64696e676661696c656464657461696c",
    formatIntent: "text",
    arguments: [
      { name: "detail", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.trustedcommentisnotav1entrycommentcomment": {
    resourceKey: "m74727573742e646961672e74727573746564636f6d6d656e7469736e6f74617631656e747279636f6d6d656e74636f6d6d656e74",
    formatIntent: "text",
    arguments: [
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.diag.versionmismatchcommentcommentbodybody": {
    resourceKey: "m74727573742e646961672e76657273696f6e6d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479",
    formatIntent: "text",
    arguments: [
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "comment", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.evidence.linkcount": {
    resourceKey: "m74727573742e65766964656e63652e6c696e6b636f756e74",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.home.registerrow": {
    resourceKey: "m74727573742e686f6d652e7265676973746572726f77",
    formatIntent: "enum",
    selectorVar: "state",
    enumValues: ["empty", "hasrecord"],
    enumDefault: "empty",
    variantKeys: {
      "empty": "m74727573742e686f6d652e7265676973746572726f77_v656d707479",
      "hasrecord": "m74727573742e686f6d652e7265676973746572726f77_v6861737265636f7264",
    },
    defaultKey: "m74727573742e686f6d652e7265676973746572726f77_v656d707479",
    arguments: [
      { name: "state", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "date", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.home.verifylead": {
    resourceKey: "m74727573742e686f6d652e7665726966796c656164",
    formatIntent: "enum",
    selectorVar: "lead",
    enumValues: ["v1", "v2"],
    enumDefault: "v1",
    variantKeys: {
      "v1": "m74727573742e686f6d652e7665726966796c656164_v7631",
      "v2": "m74727573742e686f6d652e7665726966796c656164_v7632",
    },
    defaultKey: "m74727573742e686f6d652e7665726966796c656164_v7631",
    arguments: [
      { name: "lead", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.keys.linklabel": {
    resourceKey: "m74727573742e6b6579732e6c696e6b6c6162656c",
    formatIntent: "enum",
    selectorVar: "label",
    enumValues: ["v1", "v2"],
    enumDefault: "v1",
    variantKeys: {
      "v1": "m74727573742e6b6579732e6c696e6b6c6162656c_v7631",
      "v2": "m74727573742e6b6579732e6c696e6b6c6162656c_v7632",
    },
    defaultKey: "m74727573742e6b6579732e6c696e6b6c6162656c_v7631",
    arguments: [
      { name: "label", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.keys.namedasexpectedatbuildtime": {
    resourceKey: "m74727573742e6b6579732e6e616d65646173657870656374656461746275696c6474696d65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.keys.rootintro": {
    resourceKey: "m74727573742e6b6579732e726f6f74696e74726f",
    formatIntent: "cardinal",
    selectorVar: "key_count",
    arguments: [
      { name: "key_count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "root_version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "threshold", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.keys.thepinnedrootinthepublicverifierrepository": {
    resourceKey: "m74727573742e6b6579732e74686570696e6e6564726f6f74696e7468657075626c696376657269666965727265706f7369746f7279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.keys.thewitnesslogonsolpbcorg": {
    resourceKey: "m74727573742e6b6579732e7468657769746e6573736c6f676f6e736f6c7062636f7267",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.aboutthisregister": {
    resourceKey: "m74727573742e706167652e61626f7574746869737265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.aboutthisregistertrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e61626f75747468697372656769737465727472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.acceptedexit0": {
    resourceKey: "m74727573742e706167652e61636365707465646578697430",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.acceptedreleaserecordexit0": {
    resourceKey: "m74727573742e706167652e616363657074656472656c656173657265636f72646578697430",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.active": {
    resourceKey: "m74727573742e706167652e616374697665",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.algorithm": {
    resourceKey: "m74727573742e706167652e616c676f726974686d",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.authorizationpolicy": {
    resourceKey: "m74727573742e706167652e617574686f72697a6174696f6e706f6c696379",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.backtothesoftwareregister": {
    resourceKey: "m74727573742e706167652e6261636b746f746865736f6674776172657265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.breadcrumb": {
    resourceKey: "m74727573742e706167652e62726561646372756d62",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.buildandverificationreportid": {
    resourceKey: "m74727573742e706167652e6275696c64616e64766572696669636174696f6e7265706f72746964",
    formatIntent: "text",
    arguments: [
      { name: "id", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.chainledgerderived": {
    resourceKey: "m74727573742e706167652e636861696e6c656467657264657269766564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.chainposition": {
    resourceKey: "m74727573742e706167652e636861696e706f736974696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.confidentialprocessingappliance": {
    resourceKey: "m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e6365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.confidentialprocessingappliancerecord1630bf4pub": {
    resourceKey: "m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726431363330626634707562",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.confidentialprocessingappliancerecord8e4291dpub": {
    resourceKey: "m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726438653432393164707562",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.confidentialprocessingappliancerecord9968c21pub": {
    resourceKey: "m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726439393638633231707562",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.couldnotrunexit2": {
    resourceKey: "m74727573742e706167652e636f756c646e6f7472756e6578697432",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.curlorfetchfails": {
    resourceKey: "m74727573742e706167652e6375726c6f7266657463686661696c73",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.degradedreason": {
    resourceKey: "m74727573742e706167652e6465677261646564726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.ed25519": {
    resourceKey: "m74727573742e706167652e65643235353139",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.entrysha256": {
    resourceKey: "m74727573742e706167652e656e747279736861323536",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.entrysignature": {
    resourceKey: "m74727573742e706167652e656e7472797369676e6174757265",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.expectedrecordmissing": {
    resourceKey: "m74727573742e706167652e65787065637465647265636f72646d697373696e67",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.fingerprint": {
    resourceKey: "m74727573742e706167652e66696e6765727072696e74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.footer": {
    resourceKey: "m74727573742e706167652e666f6f746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.freshnessassertion": {
    resourceKey: "m74727573742e706167652e66726573686e657373617373657274696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.fullpublickeytext": {
    resourceKey: "m74727573742e706167652e66756c6c7075626c69636b657974657874",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.godeeper": {
    resourceKey: "m74727573742e706167652e676f646565706572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.home": {
    resourceKey: "m74727573742e706167652e686f6d65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.immutableentry": {
    resourceKey: "m74727573742e706167652e696d6d757461626c65656e747279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.issuedat": {
    resourceKey: "m74727573742e706167652e6973737565646174",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.issuetime": {
    resourceKey: "m74727573742e706167652e697373756574696d65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.keys": {
    resourceKey: "m74727573742e706167652e6b657973",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.keystrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e6b6579737472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.labelcount": {
    resourceKey: "m74727573742e706167652e6c6162656c636f756e74",
    formatIntent: "text",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "label", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.latestrecorded": {
    resourceKey: "m74727573742e706167652e6c61746573747265636f72646564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.latestrecordedrelease": {
    resourceKey: "m74727573742e706167652e6c61746573747265636f7264656472656c65617365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.linux": {
    resourceKey: "m74727573742e706167652e6c696e7578",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.mac": {
    resourceKey: "m74727573742e706167652e6d6163",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.mainnavigation": {
    resourceKey: "m74727573742e706167652e6d61696e6e617669676174696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.minisignsignatureovertheentry": {
    resourceKey: "m74727573742e706167652e6d696e697369676e7369676e61747572656f766572746865656e747279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.minisignsignatureoverthepointer": {
    resourceKey: "m74727573742e706167652e6d696e697369676e7369676e61747572656f766572746865706f696e746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.missingsubject": {
    resourceKey: "m74727573742e706167652e6d697373696e677375626a656374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.mutablelatestpointer": {
    resourceKey: "m74727573742e706167652e6d757461626c656c6174657374706f696e746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.namesand": {
    resourceKey: "m74727573742e706167652e6e616d6573616e64",
    formatIntent: "text",
    arguments: [
      { name: "items", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.nativeproofreceipts": {
    resourceKey: "m74727573742e706167652e6e617469766570726f6f667265636569707473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.noevidenceobjectatname": {
    resourceKey: "m74727573742e706167652e6e6f65766964656e63656f626a65637461746e616d65",
    formatIntent: "text",
    arguments: [
      { name: "name", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.nopublishdate": {
    resourceKey: "m74727573742e706167652e6e6f7075626c69736864617465",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.norecord": {
    resourceKey: "m74727573742e706167652e6e6f7265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.norecordatthisversion": {
    resourceKey: "m74727573742e706167652e6e6f7265636f726461747468697376657273696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.norecordatthisversiontrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e6e6f7265636f726461747468697376657273696f6e7472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.norecordsinthisregister": {
    resourceKey: "m74727573742e706167652e6e6f7265636f726473696e746869737265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.norecordwasconstructedforthisproduct": {
    resourceKey: "m74727573742e706167652e6e6f7265636f7264776173636f6e7374727563746564666f727468697370726f64756374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.notarawlink": {
    resourceKey: "m74727573742e706167652e6e6f74617261776c696e6b",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.notcheckedbecausethetipentryitselfcouldnotb": {
    resourceKey: "m74727573742e706167652e6e6f74636865636b656462656361757365746865746970656e747279697473656c66636f756c646e6f7462",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.notfoundtrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e6e6f74666f756e647472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.outcome": {
    resourceKey: "m74727573742e706167652e6f7574636f6d65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.pinnedroot": {
    resourceKey: "m74727573742e706167652e70696e6e6564726f6f74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.pointersignature": {
    resourceKey: "m74727573742e706167652e706f696e7465727369676e6174757265",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.policysha256": {
    resourceKey: "m74727573742e706167652e706f6c696379736861323536",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.product": {
    resourceKey: "m74727573742e706167652e70726f64756374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.products": {
    resourceKey: "m74727573742e706167652e70726f6475637473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.producttrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e70726f647563747472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.productversiontrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e70726f6475637476657273696f6e7472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.rawevidence": {
    resourceKey: "m74727573742e706167652e72617765766964656e6365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rawkeyfile": {
    resourceKey: "m74727573742e706167652e7261776b657966696c65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rawrootfile": {
    resourceKey: "m74727573742e706167652e726177726f6f7466696c65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.readingtheresult": {
    resourceKey: "m74727573742e706167652e72656164696e67746865726573756c74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.record": {
    resourceKey: "m74727573742e706167652e7265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.recordedbytes": {
    resourceKey: "m74727573742e706167652e7265636f726465646279746573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.recordproduct": {
    resourceKey: "m74727573742e706167652e7265636f726470726f64756374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rejectedexit11": {
    resourceKey: "m74727573742e706167652e72656a6563746564657869743131",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rejectedexit12": {
    resourceKey: "m74727573742e706167652e72656a6563746564657869743132",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.releasemanifests": {
    resourceKey: "m74727573742e706167652e72656c656173656d616e696665737473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.releaserecord": {
    resourceKey: "m74727573742e706167652e72656c656173657265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rootfilesha256": {
    resourceKey: "m74727573742e706167652e726f6f7466696c65736861323536",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rootkeyids": {
    resourceKey: "m74727573742e706167652e726f6f746b6579696473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.rootversion": {
    resourceKey: "m74727573742e706167652e726f6f7476657273696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.seqseqgenesis": {
    resourceKey: "m74727573742e706167652e73657173657167656e65736973",
    formatIntent: "text",
    arguments: [
      { name: "seq", type: "integer", min: 0, max: 9007199254740990, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.seqseqpreviousversion": {
    resourceKey: "m74727573742e706167652e73657173657170726576696f757376657273696f6e",
    formatIntent: "text",
    arguments: [
      { name: "seq", type: "integer", min: 0, max: 9007199254740990, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.sha256digestlengthbytes": {
    resourceKey: "m74727573742e706167652e7368613235366469676573746c656e6774686279746573",
    formatIntent: "cardinal",
    selectorVar: "length",
    arguments: [
      { name: "length", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "digest", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.signaturefailstoverify": {
    resourceKey: "m74727573742e706167652e7369676e61747572656661696c73746f766572696679",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signatureverifies": {
    resourceKey: "m74727573742e706167652e7369676e61747572657665726966696573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signedledgerentry": {
    resourceKey: "m74727573742e706167652e7369676e65646c6564676572656e747279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signedpointer": {
    resourceKey: "m74727573742e706167652e7369676e6564706f696e746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signedrecorddsseenvelopeinside": {
    resourceKey: "m74727573742e706167652e7369676e65647265636f726464737365656e76656c6f7065696e73696465",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signerkeyids": {
    resourceKey: "m74727573742e706167652e7369676e65726b6579696473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signingkey": {
    resourceKey: "m74727573742e706167652e7369676e696e676b6579",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signingkeyset": {
    resourceKey: "m74727573742e706167652e7369676e696e676b6579736574",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.signingthreshold": {
    resourceKey: "m74727573742e706167652e7369676e696e677468726573686f6c64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.skiptocontent": {
    resourceKey: "m74727573742e706167652e736b6970746f636f6e74656e74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.software": {
    resourceKey: "m74727573742e706167652e736f667477617265",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.softwarepublicationregistersummary": {
    resourceKey: "m74727573742e706167652e736f6674776172657075626c69636174696f6e726567697374657273756d6d617279",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.softwareregister": {
    resourceKey: "m74727573742e706167652e736f6674776172657265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.softwaretrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e736f6674776172657472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.state": {
    resourceKey: "m74727573742e706167652e7374617465",
    formatIntent: "text",
    arguments: [
      { name: "state", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.status": {
    resourceKey: "m74727573742e706167652e737461747573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.subject": {
    resourceKey: "m74727573742e706167652e7375626a656374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.targetpath": {
    resourceKey: "m74727573742e706167652e74617267657470617468",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.targetsha256": {
    resourceKey: "m74727573742e706167652e746172676574736861323536",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.technicalfields": {
    resourceKey: "m74727573742e706167652e746563686e6963616c6669656c6473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thecommand": {
    resourceKey: "m74727573742e706167652e746865636f6d6d616e64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thederivedchainledger": {
    resourceKey: "m74727573742e706167652e74686564657269766564636861696e6c6564676572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thejournalsrecords": {
    resourceKey: "m74727573742e706167652e7468656a6f75726e616c737265636f726473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.theregisterataglance": {
    resourceKey: "m74727573742e706167652e7468657265676973746572617461676c616e6365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thesoftwareregister": {
    resourceKey: "m74727573742e706167652e746865736f6674776172657265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thisisnotastatementaboutanyrecordtherawevi": {
    resourceKey: "m74727573742e706167652e7468697369736e6f746173746174656d656e7461626f7574616e797265636f7264746865726177657669",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thisportalcannotpresentcollidingrecords": {
    resourceKey: "m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74636f6c6c6964696e677265636f726473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thisportalcannotpresentcollidingrecordstrusts": {
    resourceKey: "m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74636f6c6c6964696e677265636f726473747275737473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thisportalcannotpresenttheregisterrightnow": {
    resourceKey: "m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74746865726567697374657272696768746e6f77",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thisrecordcouldnotbeconstructednofieldsfrom": {
    resourceKey: "m74727573742e706167652e746869737265636f7264636f756c646e6f746265636f6e73747275637465646e6f6669656c647366726f6d",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.thresholdofkeycount": {
    resourceKey: "m74727573742e706167652e7468726573686f6c646f666b6579636f756e74",
    formatIntent: "text",
    arguments: [
      { name: "key_count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "threshold", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.timestamprole": {
    resourceKey: "m74727573742e706167652e74696d657374616d70726f6c65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.trustportalhome": {
    resourceKey: "m74727573742e706167652e7472757374706f7274616c686f6d65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.trustsolstoneapp": {
    resourceKey: "m74727573742e706167652e7472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.tworecordsresolvedtothesamerouteleftleftver": {
    resourceKey: "m74727573742e706167652e74776f7265636f7264737265736f6c766564746f74686573616d65726f7574656c6566746c656674766572",
    formatIntent: "text",
    arguments: [
      { name: "left", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "left_version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "right", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "right_version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.unavailable": {
    resourceKey: "m74727573742e706167652e756e617661696c61626c65",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.unavailablereason": {
    resourceKey: "m74727573742e706167652e756e617661696c61626c65726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.unavailabletrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e756e617661696c61626c657472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.v1tiptofirstv2record": {
    resourceKey: "m74727573742e706167652e7631746970746f666972737476327265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.valid": {
    resourceKey: "m74727573742e706167652e76616c6964",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.verify": {
    resourceKey: "m74727573742e706167652e766572696679",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.verifyarecordyourself": {
    resourceKey: "m74727573742e706167652e766572696679617265636f7264796f757273656c66",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.verifythisrecordyourself": {
    resourceKey: "m74727573742e706167652e766572696679746869737265636f7264796f757273656c66",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.verifytrustsolstoneapp": {
    resourceKey: "m74727573742e706167652e7665726966797472757374736f6c73746f6e65617070",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.verifywhatishereyourself": {
    resourceKey: "m74727573742e706167652e76657269667977686174697368657265796f757273656c66",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.versionversion": {
    resourceKey: "m74727573742e706167652e76657273696f6e76657273696f6e",
    formatIntent: "text",
    arguments: [
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.viewproduct": {
    resourceKey: "m74727573742e706167652e7669657770726f64756374",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.page.wedonthaveapageatthataddress": {
    resourceKey: "m74727573742e706167652e7765646f6e7468617665617061676561747468617461646472657373",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.whatitmeans": {
    resourceKey: "m74727573742e706167652e7768617469746d65616e73",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.whatthisdoesnotprove": {
    resourceKey: "m74727573742e706167652e7768617474686973646f65736e6f7470726f7665",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.whatthisproves": {
    resourceKey: "m74727573742e706167652e776861747468697370726f766573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.whycoverageisstatednotimplied": {
    resourceKey: "m74727573742e706167652e776879636f76657261676569737374617465646e6f74696d706c696564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.page.windows": {
    resourceKey: "m74727573742e706167652e77696e646f7773",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.product.summaryjournalcount": {
    resourceKey: "m74727573742e70726f647563742e73756d6d6172796a6f75726e616c636f756e74",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
      { name: "date", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.software.journalplatforms": {
    resourceKey: "m74727573742e736f6674776172652e6a6f75726e616c706c6174666f726d73",
    formatIntent: "text",
    arguments: [
      { name: "platforms", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.accepted": {
    resourceKey: "m74727573742e7665726966792e6163636570746564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.verify.acceptedreleaserecordproductversion": {
    resourceKey: "m74727573742e7665726966792e616363657074656472656c656173657265636f726470726f6475637476657273696f6e",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.advisoriesbody": {
    resourceKey: "m74727573742e7665726966792e61647669736f72696573626f6479",
    formatIntent: "enum",
    selectorVar: "kind",
    enumValues: ["none", "list"],
    enumDefault: "list",
    variantKeys: {
      "none": "m74727573742e7665726966792e61647669736f72696573626f6479_v6e6f6e65",
      "list": "m74727573742e7665726966792e61647669736f72696573626f6479_v6c697374",
    },
    defaultKey: "m74727573742e7665726966792e61647669736f72696573626f6479_v6c697374",
    arguments: [
      { name: "kind", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "body", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.detailline": {
    resourceKey: "m74727573742e7665726966792e64657461696c6c696e65",
    formatIntent: "text",
    arguments: [
      { name: "detail", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.evaluatedat": {
    resourceKey: "m74727573742e7665726966792e6576616c75617465646174",
    formatIntent: "text",
    arguments: [
      { name: "when", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.fetchedcountobjects": {
    resourceKey: "m74727573742e7665726966792e66657463686564636f756e746f626a65637473",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.fetchedcountobjectsbeforerejecting": {
    resourceKey: "m74727573742e7665726966792e66657463686564636f756e746f626a656374736265666f726572656a656374696e67",
    formatIntent: "cardinal",
    selectorVar: "count",
    arguments: [
      { name: "count", type: "cardinal", min: 0, max: 2147483647, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.fingerprintline": {
    resourceKey: "m74727573742e7665726966792e66696e6765727072696e746c696e65",
    formatIntent: "text",
    arguments: [
      { name: "fingerprint", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.rejectedlinkreason": {
    resourceKey: "m74727573742e7665726966792e72656a65637465646c696e6b726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "link", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.rejectedreason": {
    resourceKey: "m74727573742e7665726966792e72656a6563746564726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.rolefailedreason": {
    resourceKey: "m74727573742e7665726966792e726f6c656661696c6564726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "role", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.rolestate": {
    resourceKey: "m74727573742e7665726966792e726f6c657374617465",
    formatIntent: "text",
    arguments: [
      { name: "role", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "state", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.verify.rolestatevversion": {
    resourceKey: "m74727573742e7665726966792e726f6c6573746174657676657273696f6e",
    formatIntent: "text",
    arguments: [
      { name: "role", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "state", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.afiledidnotmatchitssigneddescription": {
    resourceKey: "m74727573742e766f6361622e6166696c656469646e6f746d617463686974737369676e65646465736372697074696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.afiledidnotparse": {
    resourceKey: "m74727573742e766f6361622e6166696c656469646e6f747061727365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.anolderversionwasservedthanonealreadyseen": {
    resourceKey: "m74727573742e766f6361622e616e6f6c64657276657273696f6e7761737365727665647468616e6f6e65616c72656164797365656e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.asignaturedidnotcheckout": {
    resourceKey: "m74727573742e766f6361622e617369676e61747572656469646e6f74636865636b6f7574",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.asserteduntil": {
    resourceKey: "m74727573742e766f6361622e6173736572746564756e74696c",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.av1objectdidnotmatchthemanifest": {
    resourceKey: "m74727573742e766f6361622e6176316f626a6563746469646e6f746d617463687468656d616e6966657374",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.couldnotbechecked": {
    resourceKey: "m74727573742e766f6361622e636f756c646e6f746265636865636b6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.didnotverify": {
    resourceKey: "m74727573742e766f6361622e6469646e6f74766572696679",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.evidencefreshness": {
    resourceKey: "m74727573742e766f6361622e65766964656e636566726573686e657373",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.expired": {
    resourceKey: "m74727573742e766f6361622e65787069726564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.fromanyreleasesrawevidencetabledownloadledger": {
    resourceKey: "m74727573742e766f6361622e66726f6d616e7972656c656173657372617765766964656e63657461626c65646f776e6c6f61646c6564676572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.itssigningkeyismarkedcompromisedinthepolicy": {
    resourceKey: "m74727573742e766f6361622e6974737369676e696e676b657969736d61726b6564636f6d70726f6d69736564696e746865706f6c696379",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.method1av1recordwithminisign": {
    resourceKey: "m74727573742e766f6361622e6d6574686f64316176317265636f7264776974686d696e697369676e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.method2thev2registerwithverifyv2": {
    resourceKey: "m74727573742e766f6361622e6d6574686f643274686576327265676973746572776974687665726966797632",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.method3onev2recordwithverifyrelease": {
    resourceKey: "m74727573742e766f6361622e6d6574686f64336f6e6576327265636f72647769746876657269667972656c65617365",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren": {
    resourceKey: "m74727573742e766f6361622e6d696e697369676e766d6c6564676572656e7472796a736f6e7066696c656e616d65786c6564676572656e",
    formatIntent: "text",
    arguments: [
      { name: "filename", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.norecordyet": {
    resourceKey: "m74727573742e766f6361622e6e6f7265636f7264796574",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.notattempted": {
    resourceKey: "m74727573742e766f6361622e6e6f74617474656d70746564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.nottimebound": {
    resourceKey: "m74727573742e766f6361622e6e6f7474696d65626f756e64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.oneofitssignedvaliditywindowshadpassed": {
    resourceKey: "m74727573742e766f6361622e6f6e656f666974737369676e656476616c696469747977696e646f7773686164706173736564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.partoftheregistercouldnotbefetchedorchecked": {
    resourceKey: "m74727573742e766f6361622e706172746f667468657265676973746572636f756c646e6f746265666574636865646f72636865636b6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.paused": {
    resourceKey: "m74727573742e766f6361622e706175736564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.publication": {
    resourceKey: "m74727573742e766f6361622e7075626c69636174696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.rebuild": {
    resourceKey: "m74727573742e766f6361622e72656275696c64",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.register": {
    resourceKey: "m74727573742e766f6361622e7265676973746572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.savetherawrootfilelinkedonkeysastufrootjs": {
    resourceKey: "m74727573742e766f6361622e73617665746865726177726f6f7466696c656c696e6b65646f6e6b6579736173747566726f6f746a73",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.signaturedidnotverify": {
    resourceKey: "m74727573742e766f6361622e7369676e61747572656469646e6f74766572696679",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.signed": {
    resourceKey: "m74727573742e766f6361622e7369676e6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.signingkeys": {
    resourceKey: "m74727573742e766f6361622e7369676e696e676b657973",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solpbcsays": {
    resourceKey: "m74727573742e766f6361622e736f6c70626373617973",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solstoneforlinux": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e65666f726c696e7578",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solstoneformacos": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e65666f726d61636f73",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solstonefortmux": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e65666f72746d7578",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solstoneforwindows": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e65666f7277696e646f7773",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.solstonetransparencyverifyreleaseroottufrootj1": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e637976657269667972656c65617365726f6f74747566726f6f746a31",
    formatIntent: "text",
    arguments: [
      { name: "metadata", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "targets", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.solstonetransparencyverifyreleaseroottufrootj2": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e637976657269667972656c65617365726f6f74747566726f6f746a32",
    formatIntent: "text",
    arguments: [
      { name: "metadata", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "targets", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.solstonetransparencyverifyv2roottufrootjsonm": {
    resourceKey: "m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e63797665726966797632726f6f74747566726f6f746a736f6e6d",
    formatIntent: "text",
    arguments: [
      { name: "metadata", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "targets", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.thecheckersownsavedstatedidnotreadback": {
    resourceKey: "m74727573742e766f6361622e746865636865636b6572736f776e736176656473746174656469646e6f74726561646261636b",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thecheckreportedreason": {
    resourceKey: "m74727573742e766f6361622e746865636865636b7265706f72746564726561736f6e",
    formatIntent: "text",
    arguments: [
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.thejournal": {
    resourceKey: "m74727573742e766f6361622e7468656a6f75726e616c",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.therecorddoesnotnamewhatitwaspublishedas": {
    resourceKey: "m74727573742e766f6361622e7468657265636f7264646f65736e6f746e616d657768617469747761737075626c69736865646173",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.therootsrolesetupdidnotcheckout": {
    resourceKey: "m74727573742e766f6361622e746865726f6f7473726f6c6573657475706469646e6f74636865636b6f7574",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thesigningkeywasnotauthorizedforthisrecord": {
    resourceKey: "m74727573742e766f6361622e7468657369676e696e676b65797761736e6f74617574686f72697a6564666f72746869737265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thev1signingkey": {
    resourceKey: "m74727573742e766f6361622e74686576317369676e696e676b6579",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thev2signingroot": {
    resourceKey: "m74727573742e766f6361622e74686576327369676e696e67726f6f74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thewitnessloglinesforthisroot": {
    resourceKey: "m74727573742e766f6361622e7468657769746e6573736c6f676c696e6573666f7274686973726f6f74",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thisisthesignedrecordofproductversionpublish1": {
    resourceKey: "m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736831",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "published_utc", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.thisisthesignedrecordofproductversionpublish2": {
    resourceKey: "m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736832",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "published_utc", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.thisisthesignedrecordofproductversionpublish3": {
    resourceKey: "m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736833",
    formatIntent: "text",
    arguments: [
      { name: "product", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "published_utc", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "reason", type: "string", min: null, max: null, numericStyle: "ungrouped" },
      { name: "version", type: "string", min: null, max: null, numericStyle: "ungrouped" },
    ],
  },
  "trust.vocab.thispageshowsonefactratherthanfourseparatea": {
    resourceKey: "m74727573742e766f6361622e746869737061676573686f77736f6e65666163747261746865727468616e666f7572736570617261746561",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.thisportalisforallofsolstonenotonlythejour": {
    resourceKey: "m74727573742e766f6361622e74686973706f7274616c6973666f72616c6c6f66736f6c73746f6e656e6f746f6e6c797468656a6f7572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.v1record": {
    resourceKey: "m74727573742e766f6361622e76317265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.v1releasetimelineclosedchain": {
    resourceKey: "m74727573742e766f6361622e763172656c6561736574696d656c696e65636c6f736564636861696e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.v2record": {
    resourceKey: "m74727573742e766f6361622e76327265636f7264",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.v2registernotchecked": {
    resourceKey: "m74727573742e766f6361622e763272656769737465726e6f74636865636b6564",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.v2releaserecords": {
    resourceKey: "m74727573742e766f6361622e763272656c656173657265636f726473",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.verification": {
    resourceKey: "m74727573742e766f6361622e766572696669636174696f6e",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.verifier": {
    resourceKey: "m74727573742e766f6361622e7665726966696572",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.whattherecordsaysitproves": {
    resourceKey: "m74727573742e766f6361622e776861747468657265636f726473617973697470726f766573",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.whatthev1recordsdonotprove": {
    resourceKey: "m74727573742e766f6361622e7768617474686576317265636f726473646f6e6f7470726f7665",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.whatthev1recordsprove": {
    resourceKey: "m74727573742e766f6361622e7768617474686576317265636f72647370726f7665",
    formatIntent: "text",
    arguments: [
    ],
  },
  "trust.vocab.withthesamepinnedtufrootjsonnametherecordb": {
    resourceKey: "m74727573742e766f6361622e7769746874686573616d6570696e6e6564747566726f6f746a736f6e6e616d657468657265636f726462",
    formatIntent: "text",
    arguments: [
    ],
  },
};

const BUNDLES = new Map();

function getBundle(locale, useIsolating) {
  const cacheKey = `${locale}:${useIsolating}`;
  let bundle = BUNDLES.get(cacheKey);
  if (!bundle) {
    const locInfo = LOCALES[locale];
    if (!locInfo) throw new Error(`Unknown locale: ${locale}`);
    const ftlSource = CATALOGS[locale];
    if (ftlSource === undefined) throw new Error(`Unknown catalog: ${locale}`);
    const resource = new FluentResource(ftlSource);
    bundle = new FluentBundle(locInfo.bundleLocale, { useIsolating });
    const errors = bundle.addResource(resource);
    if (errors.length > 0) throw new Error(`FTL errors: ${errors.join(", ")}`);
    BUNDLES.set(cacheKey, bundle);
  }
  return bundle;
}

export function render(locale, messageId, args = [], { useIsolating = true } = {}) {
  if (typeof useIsolating !== "boolean") throw new Error("Expected boolean useIsolating");
  const locInfo = LOCALES[locale];
  if (!locInfo) throw new Error(`Unknown locale: ${locale}`);

  const msgInfo = MESSAGES[messageId];
  if (!msgInfo) throw new Error(`Unknown message: ${messageId}`);

  const seen = new Set();
  for (const [k] of args) {
    if (seen.has(k)) throw new Error(`Duplicate argument: ${k}`);
    seen.add(k);
  }

  const declaredMap = new Map(msgInfo.arguments.map(a => [a.name, a]));
  for (const [k] of args) {
    if (!declaredMap.has(k)) throw new Error(`Unknown argument: ${k}`);
  }
  for (const k of declaredMap.keys()) {
    if (!seen.has(k)) throw new Error(`Missing argument: ${k}`);
  }

  const fArgs = {};
  let selectedVariant = msgInfo.enumDefault || null;

  for (const [k, v] of args) {
    const spec = declaredMap.get(k);
    if (spec.type === "string") {
      if (typeof v !== "string") throw new Error(`Expected string for ${k}`);
      if (msgInfo.formatIntent === "enum" && msgInfo.selectorVar === k) {
        if (msgInfo.enumValues.includes(v)) {
          selectedVariant = v;
        } else {
          selectedVariant = msgInfo.enumDefault;
        }
      }
      fArgs[k] = v;
    } else if (spec.type === "boolean") {
      if (typeof v !== "boolean") throw new Error(`Expected boolean for ${k}`);
      fArgs[k] = v ? "true" : "false";
    } else if (spec.type === "integer") {
      if (v && typeof v === "object" && v.type === "cardinal") throw new Error(`Expected integer, got cardinal for ${k}`);
      const num = (v && typeof v === "object" && v.type === "integer") ? v.value : v;
      if (typeof num !== "number" && typeof num !== "bigint") throw new Error(`Expected number for ${k}`);
      if (typeof num === "number" && (!Number.isFinite(num) || !Number.isInteger(num))) throw new Error(`Expected integer number for ${k}`);
      const nVal = BigInt(num);
      const minVal = spec.min !== null ? BigInt(spec.min) : -9007199254740991n;
      const maxVal = spec.max !== null ? BigInt(spec.max) : 9007199254740991n;
      const effMin = minVal < -9007199254740991n ? -9007199254740991n : minVal;
      const effMax = maxVal > 9007199254740991n ? 9007199254740991n : maxVal;
      if (nVal < effMin || nVal > effMax) throw new Error(`Out of range for ${k}`);
      fArgs[k] = Number(nVal);
    } else if (spec.type === "cardinal") {
      if (v && typeof v === "object" && v.type === "integer") throw new Error(`Expected cardinal, got integer for ${k}`);
      const num = (v && typeof v === "object" && v.type === "cardinal") ? v.value : v;
      if (typeof num !== "number" && typeof num !== "bigint") throw new Error(`Expected number for ${k}`);
      if (typeof num === "number" && (!Number.isFinite(num) || !Number.isInteger(num))) throw new Error(`Expected integer number for ${k}`);
      const nVal = BigInt(num);
      const minVal = spec.min !== null ? BigInt(spec.min) : -2147483648n;
      const maxVal = spec.max !== null ? BigInt(spec.max) : 2147483647n;
      const effMin = minVal < -2147483648n ? -2147483648n : minVal;
      const effMax = maxVal > 2147483647n ? 2147483647n : maxVal;
      if (nVal < effMin || nVal > effMax) throw new Error(`Out of range for ${k}`);
      fArgs[k] = Number(nVal);
    }
  }

  if (msgInfo.formatIntent === "cardinal") {
    const select = CATEGORIES[locInfo.cardinal];
    fArgs.i18nCategory = select ? select(Math.abs(fArgs[msgInfo.selectorVar])) : "other";
  }

  const bundle = getBundle(locale, useIsolating);

  const targetKey = msgInfo.formatIntent === "enum" ? (msgInfo.variantKeys[selectedVariant] || msgInfo.defaultKey) : msgInfo.resourceKey;
  const message = bundle.getMessage(targetKey);
  if (!message || !message.value) throw new Error(`Message not found: ${targetKey}`);

  const formatErrors = [];
  const output = bundle.formatPattern(message.value, fArgs, formatErrors);
  if (formatErrors.length > 0) throw new Error(`Format error: ${formatErrors.join(", ")}`);
  return output;
}
