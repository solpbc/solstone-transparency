trust.about.body = sol pbc రిలీజ్ పారదర్శకత — { $url }{ $nl }{ $nl }ఈ ఉపరితలం ఏమి ధృవీకరిస్తుంది:{ $nl }- sol pbc ఏమి రిలీజ్ చేసింది: ప్రతి ప్రాడక్ట్ రిలీజ్‌కు, సంతకం చేసిన లెడ్జర్ ఎంట్రీ{ $nl }  ఖచ్చితమైన ఆర్టిఫ్యాక్ట్‌లను, వాటి పరిమాణాలను, వాటి SHA-256 డైజెస్ట్‌లను పేర్కొంటుంది{ $nl }  మరియు దానితో పాటు రిలీజ్ మానిఫెస్ట్‌లు, ఇన్‌స్టాల్/స్మోక్ రుజువు పత్రాలు.{ $nl }- అది మార్చలేనిది: రిలీజ్ ఎంట్రీలు మరియు కీలు create-only కింద,{ $nl }  నిరవధికంగా ఉంచే ఆబ్జెక్ట్ పాత్‌లలో ఉంటాయి; releases/{ $tok }/v/{ $nl }  లేదా releases/keys/ కింద ఏదీ ఎప్పుడూ తిరిగి రాయబడదు, తొలగించబడదు.{ $nl }- చరిత్రను బహిరంగంగా తిరిగి నిర్మించవచ్చు: ఎంట్రీలు హాష్ గొలుసులో ఉన్నాయి,{ $nl }  కింద ఉన్న కీతో సంతకం అయ్యాయి, స్వతంత్రంగా విట్నెస్ చేయబడ్డాయి; ఎవరైనా{ $nl }  ఈ ఉపరితలం నుండి మాత్రమే పూర్తి గొలుసును మళ్ళీ రాబట్టి ధృవీకరించవచ్చు.{ $nl }{ $nl }ఈ ఉపరితలం ఏమి వాదించదు:{ $nl }- రిలీజ్ అయిన బైనరీలు తమ మూలంతో రుజువుగా సరిపోతాయని అది వాదించదు ({ $nl }  reproducible-build వాదన లేదు). హామీ ఏమిటంటే చరిత్రను తర్వాత తిరిగి రాస్తే{ $nl }  అది కనిపిస్తుంది, అసలు ధృవీకరణ తప్పులేనిదని కాదు.{ $nl }{ $nl }సంతకం కీ: releases/keys/solpbc-transparency-1.pub (minisign). రొటేషన్{ $nl }అదే డైరెక్టరీలో{ $nl }  ముందు కీ క్రాస్-సైన్ చేసిన తర్వాతి కీని ప్రచురిస్తుంది.{ $nl }{ $nl }అందించే ఉపరితలాలు (ధృవీకరించిన బైట్లు నిజంగా ఎక్కడ ఇవ్వబడతాయి):{ $nl }- solstone-journal: { $url2 } (అదే ఇండెక్స్‌లో{ $nl }  solstone, solstone-core, solstone-journal-cuda, మరియు{ $nl }  solstone-journal-models ప్యాకేజీలతో){ $nl }- solstone-windows: { $url3 }{ $nl }- solstone-linux: { $url4 }{ $nl }{ $nl }గమనిక: లెడ్జర్ ఎంట్రీల లోపల "schema" URL‌లు వెర్షన్ గుర్తింపులు,{ $nl }తెరిచి చూడగల పత్రాలు కావు.

trust.axis.asserteduntilwhen = { $when } వరకు అసర్ట్

trust.axis.detail = వివరం

trust.axis.freshuntilwhen = { $when } వరకు తాజా

trust.axis.howthiswaschecked = ఇది ఎలా సరిచూడబడింది

trust.axis.item = అంశం

trust.axis.key = కీ

trust.axis.notesha256digestbyteslength = { $length ->
    [one] { $note } { $tok } { $digest } బైట్లు { $length }
    *[other] { $note } { $tok } { $digest } బైట్లు { $length }
    }

trust.axis.raw = ముడి

trust.axis.signed = సంతకం అయింది

trust.axis.signedwhen = సంతకం { $when }

trust.axis.stamp = గడువు అయిపోయింది { $when }

trust.axis.verified = ధృవీకరించబడింది

trust.axis.verifiedwhen = ధృవీకరించబడింది { $when }

trust.chrome.backto = తిరిగి { $product } వద్దకు

trust.claims.doesnotprove = { $claim }

trust.claims.doesprove = { $claim }

trust.copy.amanifestbindingthev1releaserecordsintothev = v1 రిలీజ్ నమోదులను v2 రూట్‌లోకి బంధించే మానిఫెస్ట్ ఈ పేజీని బిల్డ్ చేసినప్పుడు సరిపడలేదు ({ $reason }); సరిచూపు అక్కడ ఆగింది, అది ఏ v1 నమోదుపై తీర్పు కాదు; ప్రతి నమోదు సొంత సరిచూపు దాని పేజీలో ఉంది.

trust.copy.arecordofproductversionwasexpectedbasisandi = { $product } { $version } నమోదు ఉంటుందని భావించాము ({ $basis }), ఈ రిజిస్టర్‌లో అది లేదు. అది రిజిస్టర్‌లో లోటు, రిలీజ్ గురించిన ఆధారం కాదు.

trust.copy.asignedvaliditywindowonthisregisterhadpassed = ఈ రిజిస్టర్‌లో సంతకం చేసిన చెల్లుబాటు కాలం { $date } నాటికి దాటిపోయింది; ఆ తేదీ దాటి నమోదులను మళ్ళీ సరిచూడలేదు. అది sol pbc అసర్ట్ ఎంత పాతదో అనే మాట, ఏ నమోదు సంతకం గురించీ కాదు.

trust.copy.eachproductbelowshowswhetherithasasignedrec = కింద ఉన్న ప్రతి ప్రాడక్ట్ ఈ రిజిస్టర్‌లో సంతకం చేసిన నమోదు ఉందో లేదో చూపిస్తుంది, v1 లేదా v2, ప్రతి నమోదు అది వర్తించే ఖచ్చితమైన ఫైల్‌లను పేర్కొంటుంది. యాప్ స్టోర్‌ల ద్వారా అందిన యాప్‌లకు (ios, android) sol pbc ఆర్టిఫ్యాక్ట్ url లేదు, ఇక్కడ నమోదు లేదు; అది ఆ బిల్డ్‌లు ఎలా అందుతాయో అనే వాస్తవం, వాటి గురించిన మాట కాదు. పట్టికలో లేని ప్రాడక్ట్, లేదా నమోదు లేని వెర్షన్, ఏదీ రిలీజ్ కాలేదనే ఆధారం కాదు. ఈ రిజిస్టర్‌లో దానికి నమోదు లేదని అర్థం.

trust.copy.everyrecordonthissiteissignedandyoucanchec = ఈ సైట్‌లోని ప్రతి నమోదూ సంతకం అయింది, మేము దానితో పాటు ప్రచురించే బహిరంగ కీతో ఆ సంతకాన్ని మీరు సరిచూడవచ్చు. చెల్లుబాటు అయ్యే సంతకం, మేము సంతకం చేసిన తర్వాత నమోదు మారలేదని మీకు చెబుతుంది; సాఫ్ట్‌వేర్ సురక్షితమా, చెప్పినట్లు ప్రవర్తిస్తుందా అనే దాని గురించి అది మీకు ఏమీ చెప్పదు.

trust.copy.newestrecordedreleaseversionsigneddate = అతి కొత్త నమోదు అయిన రిలీజ్ { $version } (సంతకం { $date })

trust.copy.nonepublishedyet = ఇంకా ఏదీ ప్రచురించబడలేదు

trust.copy.publicationtothisregisterispausedrightnowby = ఈ రిజిస్టర్‌కు ప్రచురణను మేము ఇప్పుడు ఆపి ఉంచాము, ఉద్దేశపూర్వక నిర్ణయం వల్ల, ఏ సంఘటన వల్లో సేవ ఆగిపోవడం వల్లో కాదు. మేము ప్రతి solstone ఉపరితలంపై ఒక సమన్వయ రిలీజ్‌ను అందించే వరకు sol pbc కొత్త సంతకం చేసిన నమోదులను ఉంచుతుంది, ఆ సమయంలో ప్రచురణను మేము మళ్ళీ సమీక్షిస్తాము. ఇక్కడ ఇప్పటికే ప్రచురించిన ప్రతి నమోదూ ప్రచురణలోనే ఉంటుంది, మారదు, ఉన్నది ఉన్నట్లే ధృవీకరించగలం.

trust.copy.publishingrecords = నమోదుల ప్రచురణ

trust.copy.solpbchascreateditsv2signingrootandboundth1 = sol pbc v2 సంతకం రూట్‌ను సృష్టించింది, v1 రిలీజ్ నమోదులను దానిలో బంధించింది. దాని కింద ఇంకా ఏ రిలీజ్ నమోదూ ప్రచురించబడలేదు. ప్రతి v1 నమోదూ ప్రచురణలోనే ఉంటుంది, మారదు, v1 కీతో ఉన్నది ఉన్నట్లే ధృవీకరించగలం.

trust.copy.solpbchascreateditsv2signingrootandboundth2 = sol pbc v2 సంతకం రూట్‌ను సృష్టించింది, { $products } యొక్క v1 రిలీజ్ నమోదులను దానిలో బంధించింది; మిగిలిన v1 రిలీజ్ నమోదులు ఇంకా బంధించబడలేదు. దాని కింద ఇంకా ఏ రిలీజ్ నమోదూ ప్రచురించబడలేదు. ప్రతి v1 నమోదూ ప్రచురణలోనే ఉంటుంది, మారదు, v1 కీతో ఉన్నది ఉన్నట్లే ధృవీకరించగలం.

trust.copy.solpbchascreateditsv2signingrooteveryv1rec = sol pbc v2 సంతకం రూట్‌ను సృష్టించింది. ప్రతి v1 నమోదూ ప్రచురణలోనే ఉంటుంది, మారదు, v1 కీతో ఉన్నది ఉన్నట్లే ధృవీకరించగలం.

trust.copy.solpbchascreateditsv2signingrootnoreleaser = sol pbc v2 సంతకం రూట్‌ను సృష్టించింది. దాని కింద ఇంకా ఏ రిలీజ్ నమోదూ ప్రచురించబడలేదు. ప్రతి v1 నమోదూ ప్రచురణలోనే ఉంటుంది, మారదు, v1 కీతో ఉన్నది ఉన్నట్లే ధృవీకరించగలం.

trust.copy.solpbchaspublishedsignedrecordsforsomeofits = sol pbc తన సాఫ్ట్‌వేర్‌లో కొంతకు సంతకం చేసిన నమోదులను ప్రచురించింది, తప్పనిసరిగా అంతటికీ కాదు.

trust.copy.solpbcpublishesreleaserecordsunderitsv2signi = sol pbc తన v2 సంతకం రూట్ కింద రిలీజ్ నమోదులను ప్రచురిస్తుంది. మొదటిది { $product } { $version }. సాఫ్ట్‌వేర్ పేజీ ఇక్కడ ఏ ప్రాడక్ట్‌లకు నమోదులు ఉన్నాయో పేర్కొంటుంది.

trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa = linux కోసం solstone మరియు windows కోసం solstone జర్నల్‌కు వేరుగా ఉన్నాయి; ఈ రిజిస్టర్ వాటి గురించి చూపించేది ఆ యాప్‌ల గురించి మాత్రమే.

trust.copy.solstoneisatrademarkofsolpbc = solstone sol pbc యొక్క ట్రేడ్‌మార్క్.

trust.copy.thatourregistercurrentlyhasnosignedrecordfor = windows రిలీజ్‌కు మా రిజిస్టర్‌లో ఇప్పుడు సంతకం చేసిన నమోదు లేదని.

trust.copy.thatsolpbcsignedarecordnamingtheseexactarti = sol pbc ఈ ఖచ్చితమైన ఆర్టిఫ్యాక్ట్‌లను, వాటి డైజెస్ట్‌లను, వాటి రిలీజ్ తేదీని పేర్కొనే నమోదుపై సంతకం చేసిందని, గొలుసులో ప్రతి ఎంట్రీ దాని ముందు దానికి సరిగా లింక్ అయి ఉందని.

trust.copy.thatsolpbcsignedarecordnamingthisreleasesex = sol pbc ఈ రిలీజ్ యొక్క ఖచ్చితమైన ఆర్టిఫ్యాక్ట్‌లను, డైజెస్ట్‌లను, రిలీజ్ తేదీని పేర్కొనే నమోదుపై సంతకం చేసిందని.

trust.copy.thatsolpbcssigningkeyattestedtheseexactartif = నమోదులో పేరుతో, పరిమాణంతో, హాష్‌తో ఉన్న ఈ ఖచ్చితమైన ఆర్టిఫ్యాక్ట్‌లను చెప్పిన సమయంలో sol pbc సంతకం కీ ధృవీకరించిందని, ఈ ఎంట్రీ గొలుసులో దాని ముందు దానికి సరిగా లింక్ అయి ఉందని.

trust.copy.thatsolstonehasneverbeenreleasedforwindows = windows కోసం solstone ఎప్పుడూ రిలీజ్ కాలేదని.

trust.copy.thattheseareallthejournalversionsweverelease = మేము రిలీజ్ చేసిన జర్నల్ వెర్షన్‌లు ఇవే అని, లేదా నమోదు అయిన వెర్షన్ మీరు ఇప్పుడు నడుపుతున్నదే అని.

trust.copy.thatthesourcecodewepointtoproducedtheseexac = మేము చూపించే మూల కోడ్ ఈ ఖచ్చితమైన బైట్లను ఇచ్చిందని (అది మేము చేయని reproducible-build వాదన), లేదా ఇది ఇప్పుడు ఇన్‌స్టాల్ అయి ఉన్న, లేదా డౌన్‌లోడ్ చేసుకోవడానికి అందుబాటులో ఉన్న, వెర్షన్ అని.

trust.copy.thatthisistheonlylinuxreleasewevemadeortha = మేము చేసిన linux రిలీజ్ ఇదొక్కటే అని, లేదా మీరు ఇప్పుడు నడుపుతున్నది ఇదే అని.

trust.copy.thecommandexited2becauseitcouldntreaditsinp = ఇన్‌పుట్‌లను, చాలా సార్లు పిన్ చేసిన రూట్ ఫైల్‌ను, చదవడం సాధ్యం కాలేదు కాబట్టి కమాండ్ 2తో నిష్క్రమించింది; సరిచూపు జరగలేదు, అది విఫలమైన సరిచూపుకు వేరు, నమోదు గురించిన ఆధారం కాదు.

trust.copy.thecommandexited2becausethepinnedrootcouldnt = పిన్ చేసిన రూట్‌ను చదవడం సాధ్యం కాలేదు కాబట్టి కమాండ్ 2తో నిష్క్రమించింది; సరిచూపు జరగలేదు, అది విఫలమైన సరిచూపుకు వేరు, రిజిస్టర్ గురించిన ఆధారం కాదు.

trust.copy.thedistributedfilesthemselvesarenthostedonthi = పంపిణీ ఫైల్‌లు ఈ ఆధార ఉపరితలంపై హోస్ట్ చేయబడలేదు. వాటి పేర్లు మరియు డైజెస్ట్‌లు పైన ఉన్న సంతకం చేసిన నమోదులో పేర్కొనబడ్డాయి. మీ దగ్గర ఉన్న ఫైల్‌ను హాష్ చేసి ఇక్కడి డైజెస్ట్‌తో పోల్చి సరిచూడండి, లింక్‌ను అనుసరించి కాదు.

trust.copy.theproductsbelowaretheoneswevepublishedatle = కింద ఉన్న ప్రాడక్ట్‌లకు మేము కనీసం ఒక సంతకం చేసిన నమోదును ప్రచురించాము. పట్టికలో లేని ప్రాడక్ట్, లేదా నమోదు అయిన రెండు వెర్షన్‌ల మధ్య లోటు, ఏదీ రిలీజ్ కాలేదనే ఆధారం కాదు. మా రిజిస్టర్‌లో దానికి నమోదు లేదని అర్థం, అది మా రిజిస్టర్ గురించిన వాస్తవం, మేము ఏమి అందించాము అనే దాని గురించి కాదు.

trust.copy.therearethreewaystocheckwhatisherev1record = ఇక్కడ ఉన్నదాన్ని సరిచూడడానికి మూడు మార్గాలు ఉన్నాయి. v1 నమోదులు minisign మరియు v1 కీతో సరిచూడబడతాయి; v2 రిజిస్టర్ మొత్తం, పిన్ చేసిన v2 రూట్‌కు ఎదురుగా, verify-v2 ద్వారా సరిచూడబడుతుంది; ఒక v2 నమోదు verify-release ద్వారా సరిచూడబడుతుంది, అది నమోదు సొంత సంతకాన్ని కూడా తెరుస్తుంది, అది పేర్కొన్న ఫైల్‌లను తెస్తుంది. ప్రతి నమోదు పేజీ అది ఏ గొలుసుకు చెందుతుందో చెబుతుంది.

trust.copy.therecordforversiondidnotverifyreasonsonoth = { $version } నమోదు సరిపడలేదు ({ $reason }), కాబట్టి అది వాదించేది ఏదీ ఇక్కడ చూపించడం లేదు.

trust.copy.therecordstateswhatitdoesanddoesnotprovebo = నమోదు ఏమి రుజువు చేస్తుందో, ఏమి రుజువు చేయదో చెబుతుంది; కింద ఉన్న రెండు జాబితాలూ సంతకం చేసిన నమోదు నుండి, ఉన్న మాటలు ఉన్నట్లే.

trust.copy.theregistermovesfromthev1tipprevtothefirst = రిజిస్టర్ v1 కొన { $prev } నుండి మొదటి v2 నమోదు { $next } వరకు కదులుతుంది. ఈ రెండింటి మధ్య వెర్షన్‌లకు ఇక్కడ నమోదు లేదు; అది ఈ రిజిస్టర్ గురించిన వాస్తవం, ఏమి రిలీజ్ అయిందో అనే దాని గురించి కాదు.

trust.copy.theresnorecordhereforthatversionthatisntevi = ఆ వెర్షన్‌కు ఇక్కడ నమోదు లేదు. అది రిలీజ్ కాలేదనే ఆధారం కాదు, మా రిజిస్టర్‌లో దానికి సంతకం చేసిన ఎంట్రీ లేదని మాత్రమే.

trust.copy.theresnorecordhereforversionthechainrunsfro = { $version } కోసం ఇక్కడ నమోదు లేదు; గొలుసు { $prev } నుండి { $next } వరకు దాని లేకుండా సాగుతుంది, ఈ రిజిస్టర్‌లోని లోటు { $version } ఎప్పుడూ రిలీజ్ కాలేదనే ఆధారం కాదు.

trust.copy.theresnothingatthisaddressheadbacktothetrus = ఈ చిరునామా వద్ద ఏమీ లేదు. ట్రస్ట్ పోర్టల్ హోమ్‌కు తిరిగి వెళ్ళండి, లేదా ఒక ప్రాడక్ట్ కోసం సాఫ్ట్‌వేర్ రిజిస్టర్‌ను సరిచూడండి.

trust.copy.theselinesarepublishedatmorethanonelocation = ఈ పంక్తులు, కింద పేర్కొన్నట్లు, sol pbc నియంత్రించే ఒకటి కంటే ఎక్కువ చోట్ల ప్రచురించబడ్డాయి; మీరు ఇప్పటికే పిన్ చేసిన రూట్‌కు ఇవి అదనపు సరిచూపు, అవి తామే ట్రస్ట్ రూట్ కావు. విట్నెస్ లాగ్‌లో ప్రతి రూట్ వెర్షన్ ఒక sha256 పంక్తిని చేరుస్తుంది, కీ id పంక్తి దాని కింద ఉన్న ప్రతి sha256 పంక్తినీ కప్పుతుంది, కీ సెట్ మారినప్పుడు మాత్రమే మళ్ళీ కనిపిస్తుంది.

trust.copy.thesignaturechecksoutthisexactrecordmatchesw = సంతకం సరిపడింది. ఈ ఖచ్చితమైన నమోదు మేము సంతకం చేసినదానితో సరిపోతుంది, మారలేదు.

trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy = సంతకం సరిపడలేదు. ఈ కాపీని నమ్మవద్దు, దీన్ని మీరు ఎలా పొందారో మాకు తెలియజేయండి.

trust.copy.thev1chainofproductclosedatversionitishist = { $product } యొక్క v1 గొలుసు { $version } వద్ద ముగిసింది. అది చరిత్ర, ఇంకా సంతకం ఉంది, v1 కీతో ఇంకా ధృవీకరించగలం; దానిలో ఏదీ మళ్ళీ సంతకం కాలేదు, తరలలేదు.

trust.copy.thev1chainrecordednoreleaseofsolstoneforwin = v1 గొలుసు windows కోసం solstone రిలీజ్‌ను నమోదు చేయలేదు, అది ముగిసింది, కాబట్టి ఎప్పటికీ నమోదు చేయదు. windows కోసం solstone నమోదు ఏదైనా v2 రూట్ కింద కనిపిస్తుంది, ఈ పేజీ దాన్ని చూపిస్తుంది.

trust.copy.thev1releaserecordscountobjectsareboundinto = { $count ->
    [one] v1 రిలీజ్ నమోదులు ({ $count } ఆబ్జెక్ట్‌లు) సంతకం చేసిన మానిఫెస్ట్‌ల ద్వారా v2 రూట్‌లోకి బంధించబడ్డాయి, ఈ పేజీని బిల్డ్ చేసినప్పుడు వాటిలో ప్రతిదీ సరిపడింది.
    *[other] v1 రిలీజ్ నమోదులు ({ $count } ఆబ్జెక్ట్‌లు) సంతకం చేసిన మానిఫెస్ట్‌ల ద్వారా v2 రూట్‌లోకి బంధించబడ్డాయి, ఈ పేజీని బిల్డ్ చేసినప్పుడు వాటిలో ప్రతిదీ సరిపడింది.
    }

trust.copy.thev1releaserecordsofproductscountobjectsare = { $count ->
    [one] { $products } యొక్క v1 రిలీజ్ నమోదులు ({ $count } ఆబ్జెక్ట్‌లు) సంతకం చేసిన మానిఫెస్ట్‌ల ద్వారా v2 రూట్‌లోకి బంధించబడ్డాయి, ఆ మానిఫెస్ట్‌లు ఈ పేజీని బిల్డ్ చేసినప్పుడు సరిపడ్డాయి; మిగిలిన v1 రిలీజ్ నమోదులు ఇంకా బంధించబడలేదు.
    *[other] { $products } యొక్క v1 రిలీజ్ నమోదులు ({ $count } ఆబ్జెక్ట్‌లు) సంతకం చేసిన మానిఫెస్ట్‌ల ద్వారా v2 రూట్‌లోకి బంధించబడ్డాయి, ఆ మానిఫెస్ట్‌లు ఈ పేజీని బిల్డ్ చేసినప్పుడు సరిపడ్డాయి; మిగిలిన v1 రిలీజ్ నమోదులు ఇంకా బంధించబడలేదు.
    }

trust.copy.thev2registerdidnotverifywhenthispagewasbu = ఈ పేజీని బిల్డ్ చేసినప్పుడు v2 రిజిస్టర్ సరిపడలేదు ({ $reason }), కాబట్టి దాని నుండి ఏదీ ఇక్కడ చూపించడం లేదు. ఇది ఈ సరిచూపు గురించిన మాట, ఏ నమోదు గురించీ కాదు.

trust.copy.thisfiledescribesthev1chaininthev1chainsow = ఈ ఫైల్ v1 గొలుసును, v1 గొలుసు సొంత మాటల్లో, ప్రచురించినట్లే చూపిస్తుంది.

trust.copy.thisisthesignedrecordofproductversionpublish1 = ఇది { $product } { $version } సంతకం చేసిన నమోదు, ప్రచురణ { $published_utc }. { $valid_until } వరకు చెల్లుతుందని sol pbc సంతకం చేసింది; ఆ కాలం ఇప్పుడు దాటిపోయింది, ఈ నమోదు చెందిన v1 గొలుసు ముగిసింది, కాబట్టి తర్వాతి v1 నమోదు ఏదీ దాన్ని రెన్యూ చేయదు. నమోదు మరియు దాని సంతకం ప్రచురించినట్లే ఉన్నాయి, ఈ రోజూ ధృవీకరించగలం.

trust.copy.thisisthesignedrecordofproductversionpublish2 = ఇది { $product } { $version } సంతకం చేసిన నమోదు, ప్రచురణ { $published_utc }. { $valid_until } వరకు చెల్లుతుందని sol pbc సంతకం చేసింది; ఆ కాలం ఇప్పుడు దాటిపోయింది, అది మా ప్రచురణ ఆపును చూపిస్తుంది, నమోదులో సమస్య కాదు. నమోదు మరియు దాని సంతకం ప్రచురించినట్లే ఉన్నాయి, ఈ రోజూ ధృవీకరించగలం.

trust.copy.thisisthev2releaserecordofproductversionsig = ఇది { $product } { $version } యొక్క v2 రిలీజ్ నమోదు, సంతకం { $issued_at }. ఈ రిలీజ్‌గా sol pbc నమోదు అయిన ఖచ్చితమైన చివరి బైట్లను అది పేర్కొంటుంది: ప్రతి ఫైల్‌కు url, పొడవు, { $tok }. రిజిస్టర్ తాజాదనం { $asserted_until } వరకు అసర్ట్ చేయబడింది.

trust.copy.thiskeyverifieseverysignedrecordpublishedint = ఈ కీ ఈ రిజిస్టర్‌లో ప్రచురించిన ప్రతి సంతకం చేసిన నమోదును ధృవీకరిస్తుంది.

trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing = ఈ కీ v1 గొలుసును మాత్రమే ధృవీకరిస్తుంది; అది కొత్తదానిపై సంతకం చేయదు.

trust.copy.thispageisaboutproductthesolstoneappthejour = ఈ పేజీ { $product } గురించి, solstone యాప్. జర్నల్ వేరు ప్రాడక్ట్, దాని సొంత నమోదులు ఉన్నాయి.

trust.copy.thisregisteralsoholdsrecordsforproductsthisp = ఈ రిజిస్టర్ { $products } కోసం నమోదులను కూడా ఉంచుతుంది; ఈ పోర్టల్‌కు వాటి పేజీ ఇంకా లేదు, కాబట్టి ముడి నమోదుల లింక్‌ను ఇస్తుంది.

trust.copy.thisregisterhasnosignedrecordsforawindowsre = ఈ రిజిస్టర్‌లో windows రిలీజ్‌కు సంతకం చేసిన నమోదులు లేవు. అది ఈ రిజిస్టర్‌కు మేము ఏమి ప్రచురించాము అనే వాస్తవం, solstone windows‌లో నడుస్తుందా అనే వాదన కాదు. ఇక్కడ సున్నా నమోదులు అంటే మేము ఇంకా ఒకదాన్ని నమోదు చేయలేదు, నమోదు చేయడానికి ఏదీ లేదని కాదు.

trust.copy.thisregisterholdsav2releaserecordofproductv1 = ఈ రిజిస్టర్ { $product } { $version } యొక్క v2 రిలీజ్ నమోదును ఉంచుతుంది, సంతకం చేసినది { $issued_at }.

trust.copy.thisregisterholdsav2releaserecordofproductv2 = ఈ రిజిస్టర్ { $product } { $version } యొక్క v2 రిలీజ్ నమోదును ఉంచుతుంది, సంతకం చేసినది { $issued_at }. { $product } యొక్క v1 చరిత్ర కిందే ఉంటుంది, మారకుండా, v1 కీతో ఇంకా సరిచూడవచ్చు.

trust.copy.thisregisterholdscountsignedrecordforsolstone = { $count ->
    [one] ఈ రిజిస్టర్ solstone యొక్క linux రిలీజ్‌కు { $count } సంతకం చేసిన నమోదును ఉంచుతుంది, వెర్షన్ { $version }, సంతకం చేసినది { $date }.
    *[other] ఈ రిజిస్టర్ solstone యొక్క linux రిలీజ్‌కు { $count } సంతకం చేసిన నమోదును ఉంచుతుంది, వెర్షన్ { $version }, సంతకం చేసినది { $date }.
    }

trust.copy.thisregisterholdsnosignedrecordsforsolstones = ఈ రిజిస్టర్ solstone యొక్క windows రిలీజ్‌కు సంతకం చేసిన నమోదులను ఏవీ ఉంచదు.

trust.copy.trustsolstoneappiswheresolpbcexplainsinplai = trust.solstone.app అనేది, మా సొంత సాఫ్ట్‌వేర్ గురించి మేము ప్రచురించినదాన్ని sol pbc సామాన్య భాషలో వివరించే చోటు. అసలు సంతకం చేసిన నమోదులు transparency.solstone.app వద్ద ఉన్నాయి; ఈ సైట్ వాటిని దశలవారీగా చూపిస్తూ అసలు వాటికి నేరుగా తిరిగి లింక్ చేస్తుంది. ఇక్కడ ఏదైనా transparency.solstone.app వద్ద ఉన్న నమోదుతో ఎప్పుడైనా విభేదిస్తే, నమ్మాల్సింది ఆ నమోదే.

trust.copy.v1chainclosedatversionnov2recordinthisregi = v1 గొలుసు { $version } వద్ద మూసివేయబడింది · ఈ రిజిస్టర్‌లో v2 నమోదు లేదు

trust.copy.v1chainclosedatversionv2registernotchecked = v1 గొలుసు { $version } వద్ద మూసివేయబడింది · v2 రిజిస్టర్ సరిచూడలేదు

trust.copy.v1onlynonewsignatures = v1 మాత్రమే, కొత్త సంతకాలు లేవు

trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe = v2 నమోదులు verify-v2 పరిధిలో ఉంటాయి. అది మొత్తం రిజిస్టర్‌ను sol pbc యొక్క v2 సంతకం రూట్ యొక్క పిన్ చేసిన కాపీతో సరిచూస్తుంది. సరిపడిన సరిచూపు మీకు చెబుతుంది: మీరు తెచ్చుకున్న రిజిస్టర్, మీ పిన్ చేసిన రూట్ అధికారం ఇచ్చే కీలు సంతకం చేసినదానితో సరిపోతుంది; ప్రతి నమోదు యొక్క బైట్లు వాటి సంతకం చేసిన వివరణతో సరిపోతాయి; మీరు దాన్ని నడిపినప్పుడు sol pbc సంతకం చేసిన చెల్లుబాటు కాలాలు ఏవీ గడువు అయిపోయి ఉండలేదు. అది నమోదు యొక్క సొంత సంతకాన్ని తెరవదు; అది కింద ఉన్న పద్ధతి 3. మీరు పిన్ చేసిన రూట్ సరైనదని అది చెప్పదు; కీల పేజీలో జాబితా చేసిన విట్నెస్ లాగ్ పంక్తులతో దాన్ని మీరే పోల్చుకోండి. మరియు అది రిజిస్టర్‌కే వర్తిస్తుంది, నమోదులు పేర్కొనే సాఫ్ట్‌వేర్‌కు కాదు.

trust.copy.verifyreleasechecksonev2recorditwalksfromyo = verify-release ఒక v2 నమోదును సరిచూస్తుంది. అది మీ పిన్ చేసిన రూట్ నుండి రిజిస్టర్ గుండా ఆ నమోదు వరకు నడుస్తుంది, రిజిస్టర్ అధికారం ఇచ్చే సంతకం కీలతో నమోదు యొక్క సొంత సంతకాన్ని సరిచూస్తుంది, ఆపై నమోదు పేర్కొనే ప్రతి ఫైల్‌ను దాని నమోదు అయిన url నుండి తెచ్చుకుంటుంది, అందుకున్న బైట్లను నమోదు అయిన పొడవుతోనూ sha256‌తోనూ పోలుస్తుంది. సరిపడిన సరిచూపు మీకు చెబుతుంది: ఆ క్షణంలో మీకు అందించిన ఆ ఫైల్‌లు, ఆ రిలీజ్‌గా sol pbc నమోదు చేసిన బైట్లే. సాఫ్ట్‌వేర్ సురక్షితమని, లేదా మీ దగ్గర ఇప్పటికే ఉన్న బిల్డ్ ఈ బైట్లేనని, అది చెప్పదు; మీ సొంత కాపీ యొక్క sha256‌ను నమోదు యొక్క దానితో మీరే పోల్చుకోండి.

trust.copy.wecouldntcompletethecheckusuallyanetworkora = మేము సరిచూపును పూర్తి చేయడం సాధ్యం కాలేదు, సాధారణంగా మా వైపు నెట్‌వర్క్ లేదా అందుబాటు సమస్య; అది సరిపడని సరిచూపు కాదు, నమోదు తప్పు అనడానికి ఆధారం కూడా కాదు.

trust.diag.operatordecision2026081218 = నిర్వాహక నిర్ణయం, 2026-08-12/18

trust.diag.operatordecision2026081218publicationisdelib = నిర్వాహక నిర్ణయం, 2026-08-12/18: ప్రచురణ ఉద్దేశపూర్వకంగా నిలిపివేయబడింది

trust.evidence.linkcount = { $count ->
    [one] { $count } ఖచ్చితమైన లింక్‌లు కింద
    *[other] { $count } ఖచ్చితమైన లింక్‌లు కింద
    }

trust.home.registerrow = { $state ->
    *[empty] ప్రచురణ నిలిపివేయబడింది · ఈ రిజిస్టర్‌లో నమోదులు లేవు
    [hasrecord] ప్రచురణ నిలిపివేయబడింది · చివరిగా నమోదు అయిన రిలీజ్ { $version } (సంతకం { $date })
    }

trust.home.verifylead = { $lead ->
    *[v1] నమోదును మీరే ఎలా సరిచూడాలి
    [v2] ఇక్కడ ఉన్నదాన్ని మీరే ఎలా సరిచూడాలి
    }

trust.keys.linklabel = { $label ->
    *[v1] బహిరంగ కీ
    [v2] సంతకం కీలు
    }

trust.keys.namedasexpectedatbuildtime = బిల్డ్ సమయంలో ఊహించినట్లు పేరు పెట్టబడింది

trust.keys.rootintro = { $key_count ->
    [one] ఇది sol pbc యొక్క v2 సంతకం రూట్, వెర్షన్ { $root_version }: ఒక కీ id, అది ఒంటరిగా సంతకం చేస్తుంది. ఇది ప్రతి ఏడాది రెన్యూ చేయబడుతుంది, రెన్యూ అయినప్పుడు గత విట్నెస్ లాగ్ పంక్తులన్నీ ప్రచురణలోనే ఉంటాయి.
    *[other] ఇది sol pbc యొక్క v2 సంతకం రూట్, వెర్షన్ { $root_version }: { $key_count } కీ id‌లు, వాటిలో { $threshold } సంతకం చేయాలి. ఇది ప్రతి ఏడాది రెన్యూ చేయబడుతుంది, రెన్యూ అయినప్పుడు గత విట్నెస్ లాగ్ పంక్తులన్నీ ప్రచురణలోనే ఉంటాయి.
    }

trust.keys.thepinnedrootinthepublicverifierrepository = బహిరంగ వెరిఫైయర్ రిపాజిటరీలో పిన్ చేసిన రూట్

trust.keys.thewitnesslogonsolpbcorg = solpbc.org వద్ద విట్నెస్ లాగ్

trust.page.aboutthisregister = ఈ రిజిస్టర్ గురించి

trust.page.aboutthisregistertrustsolstoneapp = ఈ రిజిస్టర్ గురించి — trust.solstone.app

trust.page.active = యాక్టివ్

trust.page.algorithm = అల్గారిథమ్

trust.page.authorizationpolicy = అధికార విధానం

trust.page.backtothesoftwareregister = తిరిగి సాఫ్ట్‌వేర్ రిజిస్టర్‌కు

trust.page.breadcrumb = మార్గక్రమం

trust.page.buildandverificationreportid = బిల్డ్ మరియు సరిచూపు నివేదిక, { $id }

trust.page.chainledgerderived = గొలుసు లెడ్జర్ (ఉత్పన్నం)

trust.page.chainposition = గొలుసు స్థానం

trust.page.confidentialprocessingappliance = కాన్ఫిడెన్షియల్ ప్రాసెసింగ్ అప్లయన్స్

trust.page.confidentialprocessingappliancerecord1630bf4pub = కాన్ఫిడెన్షియల్ ప్రాసెసింగ్ అప్లయన్స్ నమోదు, 1630bf4: ప్రచురించబడింది

trust.page.confidentialprocessingappliancerecord8e4291dpub = కాన్ఫిడెన్షియల్ ప్రాసెసింగ్ అప్లయన్స్ నమోదు, 8e4291d: ప్రచురించబడింది

trust.page.confidentialprocessingappliancerecord9968c21pub = కాన్ఫిడెన్షియల్ ప్రాసెసింగ్ అప్లయన్స్ నమోదు, 9968c21: ప్రచురించబడింది

trust.page.confidentialprocessingwhitepaper = solstone‌లో కాన్ఫిడెన్షియల్ ప్రాసెసింగ్: పంపడానికి ముందు మీ జర్నల్ సేవను ఎలా సరిచూస్తుంది (భద్రత వైట్‌పేపర్, PDF)

trust.page.couldnotrunexit2 = నడపడం సాధ్యం కాలేదు, exit 2

trust.page.curlorfetchfails = curl లేదా fetch విఫలమైంది

trust.page.ed25519 = ed25519

trust.page.entrysha256 = ఎంట్రీ sha256

trust.page.entrysignature = ఎంట్రీ సంతకం

trust.page.expectedrecordmissing = ఉండాల్సిన నమోదు లేదు

trust.page.fingerprint = ఫింగర్‌ప్రింట్

trust.page.footer = ఫుటర్

trust.page.freshnessassertion = తాజాదన నిర్ధారణ

trust.page.fullpublickeytext = పూర్తి బహిరంగ కీ వచనం

trust.page.godeeper = లోతుగా వెళ్లండి

trust.page.home = హోమ్

trust.page.immutableentry = మార్చలేని ఎంట్రీ

trust.page.issuedat = జారీ అయినది

trust.page.issuetime = జారీ సమయం

trust.page.keys = కీలు

trust.page.keystrustsolstoneapp = కీలు — trust.solstone.app

trust.page.labelcount = { $label } (×{ $count })

trust.page.latestrecorded = చివరిగా నమోదు అయినది

trust.page.latestrecordedrelease = చివరిగా నమోదు అయిన రిలీజ్

trust.page.linux = linux

trust.page.mac = mac

trust.page.mainnavigation = ప్రధాన నావిగేషన్

trust.page.minisignsignatureovertheentry = ఎంట్రీ పైన minisign సంతకం

trust.page.minisignsignatureoverthepointer = పాయింటర్ పైన minisign సంతకం

trust.page.mutablelatestpointer = మార్చగలిగే చివరి పాయింటర్

trust.page.namesand = { $items }

trust.page.nativeproofreceipts = స్థానిక రుజువు రసీదులు

trust.page.nopublishdate = ప్రచురణ తేదీ లేదు

trust.page.norecord = నమోదు లేదు

trust.page.norecordatthisversion = ఈ వెర్షన్‌లో నమోదు లేదు

trust.page.norecordatthisversiontrustsolstoneapp = ఈ వెర్షన్‌లో నమోదు లేదు — trust.solstone.app

trust.page.norecordsinthisregister = ఈ రిజిస్టర్‌లో నమోదులు లేవు

trust.page.notarawlink = ముడి లింక్ కాదు

trust.page.notfoundtrustsolstoneapp = కనబడలేదు — trust.solstone.app

trust.page.outcome = ఫలితం

trust.page.pinnedroot = పిన్ చేసిన రూట్

trust.page.pointersignature = పాయింటర్ సంతకం

trust.page.policysha256 = విధానం sha256

trust.page.product = ఉత్పత్తి

trust.page.products = ఉత్పత్తులు

trust.page.producttrustsolstoneapp = { $product } — { $tok }

trust.page.productversiontrustsolstoneapp = { $product } { $version } — { $tok }

trust.page.rawevidence = ముడి ఆధారం

trust.page.rawkeyfile = ముడి కీ ఫైల్

trust.page.rawrootfile = ముడి రూట్ ఫైల్

trust.page.readingtheresult = ఫలితాన్ని చదవడం

trust.page.record = నమోదు

trust.page.recordedbytes = నమోదు అయిన బైట్లు

trust.page.recordproduct = నమోదు ఉత్పత్తి

trust.page.releasemanifests = రిలీజ్ మానిఫెస్ట్‌లు

trust.page.releaserecord = రిలీజ్ నమోదు

trust.page.rootfilesha256 = రూట్ ఫైల్ sha256

trust.page.rootkeyids = రూట్ కీ ఐడీలు

trust.page.rootversion = రూట్ వెర్షన్

trust.page.seqseqgenesis = { $tok } { $seq } జెనెసిస్

trust.page.seqseqpreviousversion = { $tok } { $seq } మునుపటి { $version }

trust.page.sha256digestlengthbytes = { $length ->
    [one] { $tok } { $digest } · { $length } బైట్లు
    *[other] { $tok } { $digest } · { $length } బైట్లు
    }

trust.page.signaturefailstoverify = సంతకం సరిపడలేదు

trust.page.signatureverifies = సంతకం సరిపడింది

trust.page.signedledgerentry = సంతకం చేసిన లెడ్జర్ ఎంట్రీ

trust.page.signedpointer = సంతకం చేసిన పాయింటర్

trust.page.signedrecorddsseenvelopeinside = సంతకం చేసిన నమోదు (DSSE ఎన్వలప్ లోపల)

trust.page.signerkeyids = సంతకదారు కీ ఐడీలు

trust.page.signingkey = సంతకం కీ

trust.page.signingkeyset = సంతకం కీల సమితి

trust.page.signingthreshold = సంతకం థ్రెషోల్డ్

trust.page.skiptocontent = కంటెంట్‌కు దాటండి

trust.page.software = సాఫ్ట్‌వేర్

trust.page.softwarepublicationregistersummary = సాఫ్ట్‌వేర్ ప్రచురణ రిజిస్టర్ సారాంశం

trust.page.softwareregister = సాఫ్ట్‌వేర్ రిజిస్టర్

trust.page.softwaretrustsolstoneapp = సాఫ్ట్‌వేర్ — trust.solstone.app

trust.page.status = స్థితి

trust.page.subject = విషయం

trust.page.targetpath = లక్ష్యం పాత్

trust.page.targetsha256 = లక్ష్యం sha256

trust.page.technicalfields = సాంకేతిక ఫీల్డ్‌లు

trust.page.thecommand = కమాండ్

trust.page.thederivedchainledger = ఉత్పన్న చైన్ లెడ్జర్

trust.page.thejournalsrecords = జర్నల్ యొక్క నమోదులు

trust.page.theregisterataglance = రిజిస్టర్, ఒక్క చూపులో

trust.page.thesoftwareregister = సాఫ్ట్‌వేర్ రిజిస్టర్

trust.page.thisisnotastatementaboutanyrecordtherawevi = ఇది ఏ నమోదు గురించి అయినా వాఖ్య కాదు. ముడి ఆధారం transparency.solstone.app వద్ద ఉంటుంది.

trust.page.thisportalcannotpresentcollidingrecords = ఈ పోర్టల్ ఢీకొనే నమోదులను చూపడం సాధ్యం కాదు

trust.page.thisportalcannotpresentcollidingrecordstrusts = ఈ పోర్టల్ ఢీకొనే నమోదులను చూపడం సాధ్యం కాదు — trust.solstone.app

trust.page.thisportalcannotpresenttheregisterrightnow = ఈ పోర్టల్ ఇప్పుడు రిజిస్టర్‌ను చూపడం సాధ్యం కాదు

trust.page.thisrecordcouldnotbeconstructednofieldsfrom = ఈ నమోదును నిర్మించడం సాధ్యం కాలేదు. విఫలమైన వచనంలోని ఫీల్డ్‌లు ఏవీ చూపబడవు.

trust.page.thresholdofkeycount = { $key_count } లో { $threshold }

trust.page.timestamprole = టైమ్‌స్టాంప్ పాత్ర

trust.page.trustportalhome = ట్రస్ట్ పోర్టల్ హోమ్

trust.page.trustsolstoneapp = trust.solstone.app

trust.page.tworecordsresolvedtothesamerouteleftleftver = రెండు నమోదులు ఒకే మార్గానికి తేలాయి { $left } { $left_version } మరియు { $right } { $right_version}. ఏదీ చూపబడదు.

trust.page.unavailable = అందుబాటులో లేదు

trust.page.unavailablereason = అందుబాటులో లేదు { $reason }

trust.page.unavailabletrustsolstoneapp = అందుబాటులో లేదు — trust.solstone.app

trust.page.v1tiptofirstv2record = v1 టిప్ నుండి మొదటి v2 నమోదు

trust.page.valid = సరైన

trust.page.verify = ధృవీకరించండి

trust.page.verifyarecordyourself = నమోదును మీరే సరిచూడండి

trust.page.verifythisrecordyourself = ఈ నమోదును మీరే సరిచూడండి

trust.page.verifytrustsolstoneapp = సరిచూడండి — trust.solstone.app

trust.page.verifywhatishereyourself = ఇక్కడ ఉన్నదాన్ని మీరే సరిచూడండి

trust.page.versionversion = వెర్షన్ { $version }

trust.page.viewproduct = చూడండి { $product }

trust.page.wedonthaveapageatthataddress = ఆ చిరునామా వద్ద మాకు పేజీ లేదు

trust.page.whatitmeans = దీని అర్థం

trust.page.whatthisdoesnotprove = ఇది ఏమి రుజువు చేయదు

trust.page.whatthisproves = ఇది ఏమి రుజువు చేస్తుంది

trust.page.whycoverageisstatednotimplied = ఎందుకు పరిధి పేర్కొనబడింది, సూచించబడలేదు

trust.page.windows = windows

trust.product.summaryjournalcount = { $count ->
    [one] ఈ రిజిస్టర్‌లో solstone జర్నల్ రిలీజ్ కోసం { $count } సంతకమైన నమోదులు ఉన్నాయి, ఇటీవలిది వెర్షన్ { $version }, { $date } న సంతకం అయింది.
    *[other] ఈ రిజిస్టర్‌లో solstone జర్నల్ రిలీజ్ కోసం { $count } సంతకమైన నమోదులు ఉన్నాయి, ఇటీవలిది వెర్షన్ { $version }, { $date } న సంతకం అయింది.
    }

trust.software.journalplatforms = జర్నల్‌లోని అత్యంత కొత్త నమోదు, { $version }, { $platforms } కోసం ఫైళ్ళను పేర్కొంటుంది.

trust.vocab.afiledidnotmatchitssigneddescription = ఒక ఫైల్ దాని సంతకమైన వివరణకు సరిపోలలేదు

trust.vocab.afiledidnotparse = ఒక ఫైల్ పార్స్ అవ్వలేదు

trust.vocab.anolderversionwasservedthanonealreadyseen = ఇప్పటికే చూసిన దానికంటే పాత వెర్షన్ అందించబడింది

trust.vocab.asignaturedidnotcheckout = ఒక సంతకం సరిపడలేదు

trust.vocab.asserteduntil = అసర్ట్ చేసిన వరకు

trust.vocab.av1objectdidnotmatchthemanifest = ఒక v1 ఆబ్జెక్ట్ మానిఫెస్ట్‌కు సరిపోలలేదు

trust.vocab.couldnotbechecked = సరిచూడటం సాధ్యం కాలేదు

trust.vocab.didnotverify = ధృవీకరించలేదు

trust.vocab.evidencefreshness = ఆధారం తాజాదనం

trust.vocab.expired = గడువు అయింది

trust.vocab.fromanyreleasesrawevidencetabledownloadledger = ఏదైనా రిలీజ్ యొక్క ముడి ఆధార పట్టిక నుండి, ledger-entry.json, ledger-entry.json.minisig, మరియు /keys/ పై పేర్కొన్న పిన్ చేసిన కీ ఫైల్‌ను డౌన్‌లోడ్ చేయండి. ఆపై నడపండి:

trust.vocab.itssigningkeyismarkedcompromisedinthepolicy = దాని సంతకం కీ విధానంలో రాజీ అయినదిగా గుర్తించబడింది

trust.vocab.method1av1recordwithminisign = పద్ధతి 1: ఒక v1 నమోదు, minisign‌తో

trust.vocab.method2thev2registerwithverifyv2 = పద్ధతి 2: v2 రిజిస్టర్, verify-v2‌తో

trust.vocab.method3onev2recordwithverifyrelease = పద్ధతి 3: ఒక v2 నమోదు, verify-release‌తో

trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren = { $cmd }{ $filename }{ $cmd2 }

trust.vocab.norecordyet = ఇంకా నమోదు లేదు

trust.vocab.notattempted = ప్రయత్నించలేదు

trust.vocab.nottimebound = కాలపరిమితి లేదు

trust.vocab.oneofitssignedvaliditywindowshadpassed = దాని సంతకమైన చెల్లుబాటు వ్యవధులలో ఒకటి గడిచిపోయింది

trust.vocab.partoftheregistercouldnotbefetchedorchecked = రిజిస్టర్‌లోని భాగాన్ని తేవడం లేదా సరిచూడటం సాధ్యం కాలేదు

trust.vocab.paused = పాజ్ అయి ఉంది

trust.vocab.publication = ప్రచురణ

trust.vocab.rebuild = పునర్నిర్మాణం

trust.vocab.register = ▤ రిజిస్టర్

trust.vocab.savetherawrootfilelinkedonkeysastufrootjs = /keys/ పై లింక్ అయిన ముడి రూట్ ఫైల్‌ను tuf-root.json‌గా, బైటు బైటుకు సేవ్ చేయండి; ఆ సేవ్ చేసిన కాపీ మీ పిన్. దాన్ని వాడకముందు, విట్నెస్ లాగ్‌తో సరిచూడండి: మీ కాపీ యొక్క signed.version‌ను పేర్కొనే sha256 పంక్తిని కనుక్కోండి, దాని డైజెస్ట్‌ను మీ కాపీ బైట్ల sha256‌తో సరిపోల్చండి; మీ కాపీ తన రూట్ పాత్రకు పేర్కొనే key id‌లను దాని పైన ఉన్న దగ్గరి key id పంక్తితో సరిపోల్చండి; ఆపై ఇంతకంటే ఎక్కువ వెర్షన్ పంక్తి కనిపించదని నిర్ధారించండి, ఎందుకంటే లాగ్ ప్రతి మునుపటి వెర్షన్ పంక్తిని ఉంచుతుంది, కాగా పిన్ ఒక్కదాన్ని మాత్రమే ఉంచుతుంది. ఆపై నడపండి:

trust.vocab.signaturedidnotverify = సంతకం ధృవీకరించలేదు

trust.vocab.signed = ✓ సంతకం అయింది

trust.vocab.signingkeys = సంతకం కీలు

trust.vocab.solpbcsays = ◆ sol pbc చెబుతుంది

trust.vocab.solstoneforlinux = linux కోసం solstone

trust.vocab.solstoneformacos = macos కోసం solstone

trust.vocab.solstonefortmux = tmux కోసం solstone

trust.vocab.solstoneforwindows = windows కోసం solstone

trust.vocab.solstonetransparencyverifyreleaseroottufrootj1 = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.solstonetransparencyverifyreleaseroottufrootj2 = { $cmd }{ $product }{ $cmd2 }{ $version }{ $cmd3 }{ $metadata }{ $cmd4 }{ $targets }

trust.vocab.solstonetransparencyverifyv2roottufrootjsonm = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.thecheckersownsavedstatedidnotreadback = సరిచూసే దాని సొంత సేవ్ చేసిన స్థితి తిరిగి చదవబడలేదు

trust.vocab.thejournal = జర్నల్

trust.vocab.therecorddoesnotnamewhatitwaspublishedas = నమోదు తాను ఏ పేరుతో ప్రచురించబడిందో పేర్కొనదు

trust.vocab.therootsrolesetupdidnotcheckout = రూట్ పాత్ర అమరిక సరిపడలేదు

trust.vocab.thesigningkeywasnotauthorizedforthisrecord = ఈ నమోదుకు సంతకం కీకు అధికారం ఇవ్వబడలేదు

trust.vocab.thev1signingkey = v1 సంతకం కీ

trust.vocab.thev2signingroot = v2 సంతకం రూట్

trust.vocab.thewitnessloglinesforthisroot = ఈ రూట్ కోసం విట్నెస్ లాగ్ పంక్తులు

trust.vocab.thisisthesignedrecordofproductversionpublish1 = ఇది { $product } { $version } యొక్క సంతకమైన నమోదు, { $published_utc } న ప్రచురించబడింది. ఇది v1 గొలుసులో చివరి ఎంట్రీ కాదు, కాబట్టి దీనికి సొంత తాజాదన వ్యవధి లేదు; గొలుసులోని చివరి ఎంట్రీకి మాత్రమే ఉంటుంది. దాని సంతకం ప్రచురించిన విధంగానే ఉంది, ఈ రోజు ధృవీకరించవచ్చు.

trust.vocab.thisisthesignedrecordofproductversionpublish2 = ఇది { $product } { $version } యొక్క సంతకమైన నమోదు, { $published_utc } న ప్రచురించబడింది. ఇలాంటి భర్తీ అయిన ఎంట్రీలకు సొంత తాజాదన వ్యవధి ఇవ్వబడదు — గొలుసు యొక్క ప్రస్తుత కొన మాత్రమే విడిగా సంతకమైన తాజాదన అసర్షన్‌ను కలిగి ఉంటుంది. ఈ ఎంట్రీ సొంత సంతకం ప్రచురించిన విధంగానే ఉంది, ఈ రోజు స్వతంత్రంగా ధృవీకరించవచ్చు.

trust.vocab.thisisthesignedrecordofproductversionpublish3 = ఇది { $product } { $version } యొక్క సంతకమైన నమోదు, { $published_utc } న ప్రచురించబడింది. ఇది గొలుసు యొక్క ప్రస్తుత కొన, కానీ దాని విడిగా సంతకమైన తాజాదన సూచికను సరిచూడటం సాధ్యం కాలేదు ({ $reason }); ఇది ఈ సరిచూపు గురించిన మాట, ఎంట్రీ సొంత సంతకం గురించి కాదు, ఆ సంతకం ప్రచురించిన విధంగానే ఉంది, ఈ రోజు స్వతంత్రంగా ధృవీకరించవచ్చు.

trust.vocab.thispageshowsonefactratherthanfourseparatea = ఈ పేజీ నాలుగు వేర్వేరు అక్షాలకు బదులు ఒక వాస్తవాన్ని చూపుతుంది: నమోదులు లేకపోతే, తాజాదన వ్యవధి లేదు, ధృవీకరించడానికి ఏమీ లేదు, పునర్నిర్మించడానికి ఏమీ లేదు.

trust.vocab.thisportalisforallofsolstonenotonlythejour = ఈ పోర్టల్ solstone అంతటి కోసం, జర్నల్ కోసం మాత్రమే కాదు. ఉత్పత్తుల రిలీజ్ నమోదులను sol pbc ప్రచురించే కొద్దీ ఆ ఉత్పత్తులు ఇక్కడ పేర్కొనబడతాయి, నమోదులు లేని పేర్కొన్న ఉత్పత్తి నమోదులు లేవని చెబుతుంది.

trust.vocab.v1record = v1 నమోదు

trust.vocab.v1releasetimelineclosedchain = v1 రిలీజ్ కాలరేఖ (ముగిసిన గొలుసు)

trust.vocab.v2record = v2 నమోదు

trust.vocab.v2registernotchecked = v2 రిజిస్టర్ సరిచూడబడలేదు

trust.vocab.v2releaserecords = v2 రిలీజ్ నమోదులు

trust.vocab.verification = ధృవీకరణ

trust.vocab.verifier = ⟳ ధృవీకర్త

trust.vocab.whattherecordsaysitproves = నమోదు తాను ఏమి రుజువు చేస్తుందో చెప్పేది

trust.vocab.whatthev1recordsdonotprove = v1 నమోదులు ఏమి రుజువు చేయవు

trust.vocab.whatthev1recordsprove = v1 నమోదులు ఏమి రుజువు చేస్తాయి

trust.vocab.withthesamepinnedtufrootjsonnametherecordb = అదే పిన్ చేసిన tuf-root.json‌తో, నమోదు మార్గంలో కనిపించే ఉత్పత్తి id మరియు వెర్షన్‌తో నమోదుకు పేరు పెట్టండి, software/PRODUCT/VERSION, కనిపించే పేరుతో కాదు, ఆపై నడపండి:
