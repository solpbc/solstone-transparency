trust.about.body = trasparenza delle versioni di sol pbc — { $url }{ $nl }{ $nl }ciò che questa superficie attesta:{ $nl }- ciò che sol pbc ha rilasciato: per ogni versione di prodotto, un elemento firmato del registro{ $nl }  che nomina gli artefatti esatti, le loro dimensioni e i loro hash SHA-256, più{ $nl }  i manifest di versione di accompagnamento e le ricevute di prova di installazione e di smoke.{ $nl }- che è immutabile: gli elementi di versione e le chiavi stanno sotto create-only,{ $nl }  su percorsi degli oggetti conservati a tempo indefinito; niente sotto releases/{ $tok }/v/{ $nl }  o releases/keys/ viene mai sovrascritto o eliminato.{ $nl }- che la cronologia è ricostruibile pubblicamente: gli elementi sono concatenati per hash,{ $nl }  firmati con la chiave sotto e testimoniati in modo indipendente; chiunque può{ $nl }  ricavare di nuovo e verificare l'intera catena da questa sola superficie.{ $nl }{ $nl }ciò che questa superficie NON afferma:{ $nl }- non afferma che i binari rilasciati corrispondano in modo dimostrabile al loro sorgente (nessuna{ $nl }  affermazione di build riproducibile). la garanzia è che ogni riscrittura successiva della{ $nl }  cronologia è rilevabile, non che l'attestazione originale sia infallibile.{ $nl }{ $nl }chiave di firma: releases/keys/solpbc-transparency-1.pub (minisign). la rotazione{ $nl }pubblica una chiave successiva controfirmata dal suo predecessore nella stessa{ $nl }directory.{ $nl }{ $nl }superfici di consegna (dove i bytes attestati vengono effettivamente serviti):{ $nl }- solstone-journal: { $url2 } (con i{ $nl }  pacchetti solstone, solstone-core, solstone-journal-cuda e{ $nl }  solstone-journal-models sullo stesso indice){ $nl }- solstone-windows: { $url3 }{ $nl }- solstone-linux: { $url4 }{ $nl }{ $nl }nota: gli URL "schema" dentro gli elementi del registro sono identificatori di versione, non{ $nl }documenti dereferenziabili.

trust.axis.asserteduntilwhen = asserito fino a { $when }

trust.axis.detail = dettaglio

trust.axis.freshuntilwhen = fresco fino a { $when }

trust.axis.howthiswaschecked = come è stato controllato

trust.axis.item = elemento

trust.axis.key = chiave

trust.axis.notesha256digestbyteslength = { $length ->
    [one] { $note } { $tok } { $digest } bytes { $length }
    [many] { $note } { $tok } { $digest } bytes { $length }
   *[other] { $note } { $tok } { $digest } bytes { $length }
}

trust.axis.raw = grezzo

trust.axis.signed = firmato

trust.axis.signedwhen = firmato { $when }

trust.axis.stamp = scaduto { $when }

trust.axis.verified = verificato

trust.axis.verifiedwhen = verificato { $when }

trust.chrome.backto = torna a { $product }

trust.claims.doesnotprove = { $claim }

trust.claims.doesprove = { $claim }

trust.copy.amanifestbindingthev1releaserecordsintothev = un manifest che vincola i registri di versione v1 nella radice v2 non ha superato la verifica quando questa pagina è stata generata ({ $reason }); questo controllo si è fermato lì, e non è un verdetto su nessun registro v1; il controllo di ogni registro è sulla sua pagina.

trust.copy.arecordofproductversionwasexpectedbasisandi = un registro di { $product } { $version } era atteso ({ $basis }) e non è in questo albo. è una lacuna nell'albo, non una prova sulla versione.

trust.copy.asignedvaliditywindowonthisregisterhadpassed = una finestra di validità firmata su questo albo era scaduta entro { $date }; i registri non sono stati ricontrollati dopo quella data. è un'affermazione su quanto è vecchia l'asserzione di sol pbc, non sulla firma di alcun registro.

trust.copy.eachproductbelowshowswhetherithasasignedrec = ogni prodotto sotto mostra se ha un registro firmato in questo albo, v1 o v2, e ogni registro elenca i file esatti che copre. le app distribuite tramite store di app (ios, android) non hanno un url di artefatto di sol pbc e non hanno un registro qui; è un fatto su come quelle build vengono consegnate, non un'affermazione su di esse. un prodotto che non è elencato, o una versione senza registro, non è una prova che non sia stato rilasciato niente. vuol dire che questo albo non ne ha un registro.

trust.copy.everyrecordonthissiteissignedandyoucanchec = ogni registro su questo sito è firmato, e puoi controllare quella firma da te con la chiave pubblica che pubblichiamo accanto a esso. una firma valida ti dice che il registro non è stato alterato da quando l'abbiamo firmato; non ti dice niente sul fatto che il software stesso sia sicuro o si comporti come descritto.

trust.copy.newestrecordedreleaseversionsigneddate = versione più recente messa a registro { $version } (firmata il { $date })

trust.copy.nonepublishedyet = nessuno ancora pubblicato

trust.copy.publicationtothisregisterispausedrightnowby = la pubblicazione in questo albo è in pausa in questo momento, per una decisione deliberata, non per un incidente o un'interruzione. sol pbc trattiene i nuovi registri firmati finché non distribuiamo una versione coordinata su ogni superficie di solstone, e a quel punto rivaluteremo la pubblicazione. ogni registro già pubblicato qui resta pubblicato, invariato e verificabile esattamente com'è.

trust.copy.publishingrecords = pubblicazione dei registri

trust.copy.solpbchascreateditsv2signingrootandboundth1 = sol pbc ha creato la sua radice di firma v2 e ha vincolato in essa i registri di versione v1. sotto di essa non è ancora stato pubblicato nessun registro di versione. ogni registro v1 resta pubblicato, invariato e verificabile esattamente com'è, con la chiave v1.

trust.copy.solpbchascreateditsv2signingrootandboundth2 = sol pbc ha creato la sua radice di firma v2 e ha vincolato in essa i registri di versione v1 di { $products }; il resto dei registri di versione v1 non è ancora vincolato. sotto di essa non è ancora stato pubblicato nessun registro di versione. ogni registro v1 resta pubblicato, invariato e verificabile esattamente com'è, con la chiave v1.

trust.copy.solpbchascreateditsv2signingrooteveryv1rec = sol pbc ha creato la sua radice di firma v2. ogni registro v1 resta pubblicato, invariato e verificabile esattamente com'è, con la chiave v1.

trust.copy.solpbchascreateditsv2signingrootnoreleaser = sol pbc ha creato la sua radice di firma v2. sotto di essa non è ancora stato pubblicato nessun registro di versione. ogni registro v1 resta pubblicato, invariato e verificabile esattamente com'è, con la chiave v1.

trust.copy.solpbchaspublishedsignedrecordsforsomeofits = sol pbc ha pubblicato registri firmati per parte del suo software, non necessariamente per tutto.

trust.copy.solpbcpublishesreleaserecordsunderitsv2signi = sol pbc pubblica registri di versione sotto la sua radice di firma v2. il primo è { $product } { $version }. la pagina del software elenca quali prodotti hanno registri qui.

trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa = solstone per linux e solstone per windows sono separati dal diario; ciò che questo albo mostra per loro riguarda solo quelle app.

trust.copy.solstoneisatrademarkofsolpbc = solstone è un marchio di sol pbc.

trust.copy.thatourregistercurrentlyhasnosignedrecordfor = che il nostro albo non ha attualmente un registro firmato per una versione windows.

trust.copy.thatsolpbcsignedarecordnamingtheseexactarti = che sol pbc ha firmato un registro che nomina questi artefatti esatti, i loro hash e la loro data di versione, e che ogni elemento è collegato correttamente a quello precedente nella catena.

trust.copy.thatsolpbcsignedarecordnamingthisreleasesex = che sol pbc ha firmato un registro che nomina gli artefatti esatti di questa versione, gli hash e la data di versione.

trust.copy.thatsolpbcssigningkeyattestedtheseexactartif = che la chiave di firma di sol pbc ha attestato questi artefatti esatti, nominati, dimensionati e con hash nel registro, al momento indicato, e che questo elemento è collegato correttamente a quello precedente nella catena.

trust.copy.thatsolstonehasneverbeenreleasedforwindows = che solstone non è mai stato rilasciato per windows.

trust.copy.thattheseareallthejournalversionsweverelease = che queste sono tutte le versioni del diario che abbiamo rilasciato, o che la versione messa a registro è quella che stai eseguendo ora.

trust.copy.thatthesourcecodewepointtoproducedtheseexac = che il codice sorgente che indichiamo ha prodotto questi bytes esatti (è un'affermazione di build riproducibile che non facciamo), o che questa è la versione attualmente installata o disponibile da scaricare.

trust.copy.thatthisistheonlylinuxreleasewevemadeortha = che questa è l'unica versione linux che abbiamo fatto, o che è ciò che stai eseguendo ora.

trust.copy.thecommandexited2becauseitcouldntreaditsinp = il comando è uscito con 2 perché non è stato possibile leggerne gli input, il più delle volte il file della radice con pin; il controllo non è avvenuto, il che è diverso da un controllo non riuscito e non è una prova sul registro.

trust.copy.thecommandexited2becausethepinnedrootcouldnt = il comando è uscito con 2 perché non è stato possibile leggere la radice con pin; il controllo non è avvenuto, il che è diverso da un controllo non riuscito e non è una prova sull'albo.

trust.copy.thedistributedfilesthemselvesarenthostedonthi = i file distribuiti stessi non sono ospitati su questa superficie di prova. i loro nomi e hash sono dichiarati nel registro firmato sopra. verificali calcolando l'hash del file che hai e confrontandolo con l'hash qui, non seguendo un link.

trust.copy.theproductsbelowaretheoneswevepublishedatle = i prodotti sotto sono quelli per cui abbiamo pubblicato almeno un registro firmato. un prodotto che non è elencato, o una lacuna tra due versioni messe a registro di un prodotto che lo è, non è una prova che non sia stato rilasciato niente. vuol dire che il nostro albo non ne ha un registro, il che è un fatto sul nostro albo, non su ciò che abbiamo distribuito.

trust.copy.therearethreewaystocheckwhatisherev1record = ci sono tre modi per controllare ciò che c'è qui. i registri v1 si controllano con minisign e la chiave v1; l'albo v2 si controlla per intero con verify-v2 contro la radice v2 con pin; un registro v2 si controlla con verify-release, che apre anche la firma propria del registro e recupera i file che esso nomina. la pagina di ogni registro dice a quale catena appartiene.

trust.copy.therecordforversiondidnotverifyreasonsonoth = il registro di { $version } non ha superato la verifica ({ $reason }), quindi niente di ciò che esso afferma è mostrato qui.

trust.copy.therecordstateswhatitdoesanddoesnotprovebo = il registro dichiara ciò che prova e ciò che non prova; entrambi gli elenchi sotto sono riportati dal registro firmato, parola per parola.

trust.copy.theregistermovesfromthev1tipprevtothefirst = l'albo passa dalla punta v1, { $prev }, al primo registro v2, { $next }. le versioni tra i due non hanno un registro qui; è un fatto su questo albo, non su ciò che è stato rilasciato.

trust.copy.theresnorecordhereforthatversionthatisntevi = qui non c'è un registro per quella versione. non è una prova che non sia stata rilasciata, solo che il nostro albo non ha un elemento firmato per essa.

trust.copy.theresnorecordhereforversionthechainrunsfro = qui non c'è un registro per { $version }; la catena va da { $prev } a { $next } senza di essa, e una lacuna in questo albo non è una prova che { $version } non sia mai stata rilasciata.

trust.copy.theresnothingatthisaddressheadbacktothetrus = a questo indirizzo non c'è niente. torna all'inizio del portale trust, o controlla l'albo del software per un prodotto specifico.

trust.copy.theselinesarepublishedatmorethanonelocation = queste righe sono pubblicate in più di una posizione che sol pbc controlla, elencate sotto; sono un controllo incrociato per una radice di cui hai già il pin, e non sono esse stesse una radice di fiducia. nel registro dei testimoni, ogni versione della radice aggiunge una riga sha256, e la riga dell'id di chiave copre ogni riga sha256 sotto di essa, e riappare solo quando cambia l'insieme delle chiavi.

trust.copy.thesignaturechecksoutthisexactrecordmatchesw = la firma risulta valida. questo registro esatto corrisponde a ciò che abbiamo firmato e non è stato alterato.

trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy = la firma non risulta valida. non fidarti di questa copia, e facci sapere come l'hai ottenuta.

trust.copy.thev1chainofproductclosedatversionitishist = la catena v1 di { $product } è chiusa a { $version }. è storia, ancora firmata e ancora verificabile con la chiave v1; niente al suo interno è stato rifirmato o spostato.

trust.copy.thev1chainrecordednoreleaseofsolstoneforwin = la catena v1 non ha messo a registro alcuna versione di solstone per windows ed è chiusa, quindi non ne metterà mai una a registro. ogni registro di solstone per windows apparirà sotto la radice v2 e questa pagina lo mostrerà.

trust.copy.thev1releaserecordscountobjectsareboundinto = { $count ->
    [one] i registri di versione v1 ({ $count } oggetto) sono vincolati nella radice v2 da manifest firmati, e ognuno di essi è risultato valido quando questa pagina è stata generata.
    [many] i registri di versione v1 ({ $count } di oggetti) sono vincolati nella radice v2 da manifest firmati, e ognuno di essi è risultato valido quando questa pagina è stata generata.
   *[other] i registri di versione v1 ({ $count } oggetti) sono vincolati nella radice v2 da manifest firmati, e ognuno di essi è risultato valido quando questa pagina è stata generata.
}

trust.copy.thev1releaserecordsofproductscountobjectsare = { $count ->
    [one] i registri di versione v1 di { $products } ({ $count } oggetto) sono vincolati nella radice v2 da manifest firmati che sono risultati validi quando questa pagina è stata generata; il resto dei registri di versione v1 non è ancora vincolato.
    [many] i registri di versione v1 di { $products } ({ $count } di oggetti) sono vincolati nella radice v2 da manifest firmati che sono risultati validi quando questa pagina è stata generata; il resto dei registri di versione v1 non è ancora vincolato.
   *[other] i registri di versione v1 di { $products } ({ $count } oggetti) sono vincolati nella radice v2 da manifest firmati che sono risultati validi quando questa pagina è stata generata; il resto dei registri di versione v1 non è ancora vincolato.
}

trust.copy.thev2registerdidnotverifywhenthispagewasbu = l'albo v2 non ha superato la verifica quando questa pagina è stata generata ({ $reason }), quindi qui non è mostrato niente di esso. è un'affermazione su questo controllo, non su alcun registro.

trust.copy.thisfiledescribesthev1chaininthev1chainsow = questo file descrive la catena v1, con le parole proprie della catena v1, ed è mostrato esattamente come pubblicato.

trust.copy.thisisthesignedrecordofproductversionpublish1 = questo è il registro firmato di { $product } { $version }, pubblicato { $published_utc }. sol pbc l'ha firmato come valido fino a { $valid_until }; quella finestra è scaduta da allora, e la catena v1 a cui questo registro appartiene è chiusa, quindi nessun registro v1 successivo lo rinnova. il registro e la sua firma restano esattamente come pubblicati e restano verificabili oggi.

trust.copy.thisisthesignedrecordofproductversionpublish2 = questo è il registro firmato di { $product } { $version }, pubblicato { $published_utc }. sol pbc l'ha firmato come valido fino a { $valid_until }; quella finestra è scaduta da allora, il che riflette la nostra pausa della pubblicazione, non un problema del registro stesso. il registro e la sua firma restano esattamente come pubblicati e restano verificabili oggi.

trust.copy.thisisthev2releaserecordofproductversionsig = questo è il registro di versione v2 di { $product } { $version }, firmato { $issued_at }. nomina i bytes finali esatti che sol pbc ha messo a registro come questa versione: url, lunghezza e { $tok } di ogni file. la freschezza dell'albo è asserita fino a { $asserted_until }.

trust.copy.thiskeyverifieseverysignedrecordpublishedint = questa chiave verifica ogni registro firmato pubblicato in questo albo.

trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing = questa chiave verifica solo la catena v1; non firma niente di nuovo.

trust.copy.thispageisaboutproductthesolstoneappthejour = questa pagina riguarda { $product }, l'app di solstone. il diario è un prodotto separato, con i suoi registri.

trust.copy.thisregisteralsoholdsrecordsforproductsthisp = questo albo contiene anche registri per { $products }; questo portale non ha ancora una pagina per loro, quindi collega invece i registri grezzi.

trust.copy.thisregisterhasnosignedrecordsforawindowsre = questo albo non ha registri firmati per una versione windows. è un fatto su ciò che abbiamo pubblicato in questo albo, non un'affermazione sul fatto che solstone funziona su windows. zero registri qui vuol dire che non ne abbiamo ancora messo uno a registro, non che non ne esista uno da mettere a registro.

trust.copy.thisregisterholdsav2releaserecordofproductv1 = questo albo contiene un registro di versione v2 di { $product } { $version }, firmato { $issued_at }.

trust.copy.thisregisterholdsav2releaserecordofproductv2 = questo albo contiene un registro di versione v2 di { $product } { $version }, firmato { $issued_at }. la cronologia v1 di { $product } resta sotto, invariata e ancora verificabile con la chiave v1.

trust.copy.thisregisterholdscountsignedrecordforsolstone = { $count ->
    [one] questo albo contiene { $count } registro firmato per la versione linux di solstone, versione { $version }, firmato il { $date }.
    [many] questo albo contiene { $count } di registri firmati per la versione linux di solstone, versione { $version }, firmati il { $date }.
   *[other] questo albo contiene { $count } registri firmati per la versione linux di solstone, versione { $version }, firmati il { $date }.
}

trust.copy.thisregisterholdsnosignedrecordsforsolstones = questo albo non contiene registri firmati per la versione windows di solstone.

trust.copy.trustsolstoneappiswheresolpbcexplainsinplai = trust.solstone.app è dove sol pbc spiega, in linguaggio semplice, ciò che abbiamo pubblicato sul nostro software. i registri firmati effettivi stanno su transparency.solstone.app; questo sito li percorre e collega direttamente agli originali. se qualcosa qui non concorda mai con un registro su transparency.solstone.app, quel registro è quello da credere.

trust.copy.v1chainclosedatversionnov2recordinthisregi = catena v1 chiusa a { $version } · nessun registro v2 in questo albo

trust.copy.v1chainclosedatversionv2registernotchecked = catena v1 chiusa a { $version } · albo v2 non controllato

trust.copy.v1onlynonewsignatures = solo v1, nessuna firma nuova

trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe = i registri v2 sono coperti da verify-v2, che controlla l'intero albo contro una copia con pin della radice di firma v2 di sol pbc. un controllo che riesce ti dice che l'albo che hai recuperato corrisponde a ciò che è stato firmato dalle chiavi che la tua radice con pin autorizza, che i bytes di ogni registro corrispondono alla loro descrizione firmata, e che nessuna finestra di validità firmata di sol pbc era scaduta quando l'hai eseguito. non apre la firma propria di un registro; quello è il metodo 3 sotto. non ti dice che la radice che hai messo in pin sia quella giusta; la confronti tu con le righe del registro dei testimoni, elencate sulla pagina delle chiavi. e parla solo dell'albo, non del software che i registri nominano.

trust.copy.verifyreleasechecksonev2recorditwalksfromyo = verify-release controlla un registro v2. parte dalla tua radice con pin fino al registro attraverso l'albo, controlla la firma propria del registro contro le chiavi di firma che l'albo autorizza, e poi recupera ogni file che il registro nomina dal suo url messo a registro e confronta i bytes che riceve con la lunghezza messa a registro e lo sha256. un controllo che riesce ti dice che quei file, come ti sono stati serviti in quel momento, sono i bytes che sol pbc ha messo a registro come quella versione. non ti dice che il software sia sicuro, o che una build che hai già sia questi bytes; confronta tu lo sha256 della tua copia con quello del registro.

trust.copy.wecouldntcompletethecheckusuallyanetworkora = non è stato possibile completare il controllo, di solito un problema di rete o di disponibilità dalla nostra parte; è diverso da un controllo non riuscito e non è una prova che il registro sia sbagliato.

trust.diag.operatordecision2026081218 = decisione dell'operatore, 2026-08-12/18

trust.diag.operatordecision2026081218publicationisdelib = decisione dell'operatore, 2026-08-12/18: la pubblicazione è deliberatamente in pausa

trust.evidence.linkcount = { $count ->
    [one] { $count } link esatto sotto
    [many] { $count } di link esatti sotto
   *[other] { $count } link esatti sotto
}

trust.home.registerrow = { $state ->
    *[empty] pubblicazione in pausa · nessun registro in questo albo
     [hasrecord] pubblicazione in pausa · versione più recente messa a registro { $version } (firmata il { $date })
}

trust.home.verifylead = { $lead ->
    *[v1] come verificare un registro da te
     [v2] come verificare da te ciò che c'è qui
}

trust.keys.linklabel = { $label ->
    *[v1] la chiave pubblica
     [v2] le chiavi di firma
}

trust.keys.namedasexpectedatbuildtime = con il nome atteso al momento della build

trust.keys.rootintro = { $key_count ->
    [one] questa è la radice di firma v2 di sol pbc, versione { $root_version }: un id di chiave, che firma da solo. viene rinnovata ogni anno, e ogni riga precedente del registro dei testimoni resta pubblicata quando la radice viene rinnovata.
    [many] questa è la radice di firma v2 di sol pbc, versione { $root_version }: { $key_count } di id di chiave, di cui { $threshold } devono firmare. viene rinnovata ogni anno, e ogni riga precedente del registro dei testimoni resta pubblicata quando la radice viene rinnovata.
   *[other] questa è la radice di firma v2 di sol pbc, versione { $root_version }: { $key_count } id di chiave, di cui { $threshold } devono firmare. viene rinnovata ogni anno, e ogni riga precedente del registro dei testimoni resta pubblicata quando la radice viene rinnovata.
}

trust.keys.thepinnedrootinthepublicverifierrepository = la radice con pin nel repository pubblico del verificatore

trust.keys.thewitnesslogonsolpbcorg = il registro dei testimoni su solpbc.org

trust.page.aboutthisregister = informazioni su questo albo

trust.page.aboutthisregistertrustsolstoneapp = informazioni su questo albo — trust.solstone.app

trust.page.active = attivo

trust.page.algorithm = algoritmo

trust.page.authorizationpolicy = criterio di autorizzazione

trust.page.backtothesoftwareregister = torna all'albo del software

trust.page.breadcrumb = percorso di navigazione

trust.page.buildandverificationreportid = rapporto di build e di verifica, { $id }

trust.page.chainledgerderived = registro della catena (derivato)

trust.page.chainposition = posizione nella catena

trust.page.confidentialprocessingappliance = apparato di elaborazione confidenziale

trust.page.confidentialprocessingappliancerecord1630bf4pub = registro dell'apparato di elaborazione confidenziale, 1630bf4: pubblicato

trust.page.confidentialprocessingappliancerecord8e4291dpub = registro dell'apparato di elaborazione confidenziale, 8e4291d: pubblicato

trust.page.confidentialprocessingappliancerecord9968c21pub = registro dell'apparato di elaborazione confidenziale, 9968c21: pubblicato

trust.page.confidentialprocessingwhitepaper = elaborazione confidenziale in solstone: come il tuo diario controlla il servizio prima di inviare (whitepaper sulla sicurezza, PDF)

trust.page.couldnotrunexit2 = non è stato possibile eseguire, exit 2

trust.page.curlorfetchfails = curl o fetch fallisce

trust.page.ed25519 = ed25519

trust.page.entrysha256 = sha256 dell'elemento

trust.page.entrysignature = firma dell'elemento

trust.page.expectedrecordmissing = registro atteso mancante

trust.page.fingerprint = impronta

trust.page.footer = piè di pagina

trust.page.freshnessassertion = asserzione di freschezza

trust.page.fullpublickeytext = testo completo della chiave pubblica

trust.page.godeeper = vai più a fondo

trust.page.home = inizio

trust.page.immutableentry = elemento immutabile

trust.page.issuedat = emesso il

trust.page.issuetime = ora di emissione

trust.page.keys = chiavi

trust.page.keystrustsolstoneapp = chiavi — trust.solstone.app

trust.page.labelcount = { $label } (×{ $count })

trust.page.latestrecorded = ultimo messo a registro

trust.page.latestrecordedrelease = versione più recente messa a registro

trust.page.linux = linux

trust.page.mac = mac

trust.page.mainnavigation = navigazione principale

trust.page.minisignsignatureovertheentry = firma minisign sull'elemento

trust.page.minisignsignatureoverthepointer = firma minisign sul puntatore

trust.page.mutablelatestpointer = puntatore mutabile all'ultimo

trust.page.namesand = { $items }

trust.page.nativeproofreceipts = ricevute di prova native

trust.page.nopublishdate = nessuna data di pubblicazione

trust.page.norecord = nessun registro

trust.page.norecordatthisversion = nessun registro per questa versione

trust.page.norecordatthisversiontrustsolstoneapp = nessun registro per questa versione — trust.solstone.app

trust.page.norecordsinthisregister = nessun registro in questo albo

trust.page.notarawlink = non un link grezzo

trust.page.notfoundtrustsolstoneapp = non trovato — trust.solstone.app

trust.page.outcome = esito

trust.page.pinnedroot = radice fissata

trust.page.pointersignature = firma del puntatore

trust.page.policysha256 = sha256 della politica

trust.page.product = prodotto

trust.page.products = prodotti

trust.page.producttrustsolstoneapp = { $product } — { $tok }

trust.page.productversiontrustsolstoneapp = { $product } { $version } — { $tok }

trust.page.rawevidence = prova grezza

trust.page.rawkeyfile = file grezzo della chiave

trust.page.rawrootfile = file grezzo della radice

trust.page.readingtheresult = lettura del risultato

trust.page.record = registro

trust.page.recordedbytes = byte registrati

trust.page.recordproduct = prodotto del registro

trust.page.releasemanifests = manifest delle versioni

trust.page.releaserecord = registro di versione

trust.page.rootfilesha256 = sha256 del file della radice

trust.page.rootkeyids = id delle chiavi della radice

trust.page.rootversion = versione della radice

trust.page.seqseqgenesis = { $tok } { $seq } genesi

trust.page.seqseqpreviousversion = { $tok } { $seq } precedente { $version }

trust.page.sha256digestlengthbytes = { $length ->
    [one] { $tok } { $digest } · { $length } byte
    [many] { $tok } { $digest } · { $length } di byte
   *[other] { $tok } { $digest } · { $length } byte
}

trust.page.signaturefailstoverify = la firma non supera la verifica

trust.page.signatureverifies = la firma supera la verifica

trust.page.signedledgerentry = elemento firmato del registro

trust.page.signedpointer = puntatore firmato

trust.page.signedrecorddsseenvelopeinside = registro firmato (busta DSSE dentro)

trust.page.signerkeyids = id delle chiavi firmatarie

trust.page.signingkey = chiave di firma

trust.page.signingkeyset = insieme di chiavi di firma

trust.page.signingthreshold = soglia di firma

trust.page.skiptocontent = vai al contenuto

trust.page.software = software

trust.page.softwarepublicationregistersummary = riepilogo dell'albo di pubblicazione del software

trust.page.softwareregister = albo del software

trust.page.softwaretrustsolstoneapp = software — trust.solstone.app

trust.page.status = stato

trust.page.subject = soggetto

trust.page.targetpath = percorso del target

trust.page.targetsha256 = sha256 del target

trust.page.technicalfields = campi tecnici

trust.page.thecommand = il comando

trust.page.thederivedchainledger = il registro della catena derivata

trust.page.thejournalsrecords = i registri del diario

trust.page.theregisterataglance = l'albo, a colpo d'occhio

trust.page.thesoftwareregister = l'albo del software

trust.page.thisisnotastatementaboutanyrecordtherawevi = questa non è un'affermazione su nessun registro. la prova grezza resta su transparency.solstone.app.

trust.page.thisportalcannotpresentcollidingrecords = questo portale non può presentare registri in collisione

trust.page.thisportalcannotpresentcollidingrecordstrusts = questo portale non può presentare registri in collisione — trust.solstone.app

trust.page.thisportalcannotpresenttheregisterrightnow = questo portale non può presentare l'albo in questo momento

trust.page.thisrecordcouldnotbeconstructednofieldsfrom = non è stato possibile costruire questo registro. nessun campo del corpo fallito è mostrato.

trust.page.thresholdofkeycount = { $threshold } di { $key_count }

trust.page.timestamprole = ruolo timestamp

trust.page.trustportalhome = inizio del portale di fiducia

trust.page.trustsolstoneapp = trust.solstone.app

trust.page.tworecordsresolvedtothesamerouteleftleftver = due registri si sono risolti nello stesso percorso { $left } { $left_version } e { $right } { $right_version}. non se ne mostra nessuno.

trust.page.unavailable = non disponibile

trust.page.unavailablereason = non disponibile { $reason }

trust.page.unavailabletrustsolstoneapp = non disponibile — trust.solstone.app

trust.page.v1tiptofirstv2record = punta v1 al primo registro v2

trust.page.valid = valido

trust.page.verify = verifica

trust.page.verifyarecordyourself = verifica un registro per conto tuo

trust.page.verifythisrecordyourself = verifica questo registro per conto tuo

trust.page.verifytrustsolstoneapp = verifica — trust.solstone.app

trust.page.verifywhatishereyourself = verifica per conto tuo ciò che c'è qui

trust.page.versionversion = versione { $version }

trust.page.viewproduct = vedi { $product }

trust.page.wedonthaveapageatthataddress = non abbiamo una pagina a quell'indirizzo

trust.page.whatitmeans = cosa significa

trust.page.whatthisdoesnotprove = cosa non dimostra questo

trust.page.whatthisproves = cosa dimostra questo

trust.page.whycoverageisstatednotimplied = perché la copertura è dichiarata, non implicita

trust.page.windows = windows

trust.product.summaryjournalcount = { $count ->
    [one] questo albo contiene { $count } registro firmato per la versione del diario di solstone, più di recente la versione { $version }, firmato il { $date }.
    [many] questo albo contiene { $count } di registri firmati per la versione del diario di solstone, più di recente la versione { $version }, firmato il { $date }.
   *[other] questo albo contiene { $count } registri firmati per la versione del diario di solstone, più di recente la versione { $version }, firmato il { $date }.
}

trust.software.journalplatforms = il registro più recente del diario, { $version }, nomina i file per { $platforms }.

trust.vocab.afiledidnotmatchitssigneddescription = un file non corrispondeva alla sua descrizione firmata

trust.vocab.afiledidnotparse = un file non ha superato l'analisi

trust.vocab.anolderversionwasservedthanonealreadyseen = è stata servita una versione più vecchia di una già vista

trust.vocab.asignaturedidnotcheckout = una firma non ha superato il controllo

trust.vocab.asserteduntil = asserito fino a

trust.vocab.av1objectdidnotmatchthemanifest = un oggetto v1 non corrispondeva al manifest

trust.vocab.couldnotbechecked = non è stato possibile controllare

trust.vocab.didnotverify = non ha superato la verifica

trust.vocab.evidencefreshness = freschezza della prova

trust.vocab.expired = scaduto

trust.vocab.fromanyreleasesrawevidencetabledownloadledger = dalla tabella della prova grezza di qualsiasi versione, scarica ledger-entry.json, ledger-entry.json.minisig e il file della chiave fissato nominato su /keys/. poi esegui:

trust.vocab.itssigningkeyismarkedcompromisedinthepolicy = la sua chiave di firma è segnata come compromessa nella politica

trust.vocab.method1av1recordwithminisign = metodo 1: un registro v1, con minisign

trust.vocab.method2thev2registerwithverifyv2 = metodo 2: l'albo v2, con verify-v2

trust.vocab.method3onev2recordwithverifyrelease = metodo 3: un registro v2, con verify-release

trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren = { $cmd }{ $filename }{ $cmd2 }

trust.vocab.norecordyet = ancora nessun registro

trust.vocab.notattempted = nessun tentativo

trust.vocab.nottimebound = senza vincolo di tempo

trust.vocab.oneofitssignedvaliditywindowshadpassed = una delle sue finestre di validità firmate era passata

trust.vocab.partoftheregistercouldnotbefetchedorchecked = non è stato possibile recuperare o controllare parte dell'albo

trust.vocab.paused = in pausa

trust.vocab.publication = pubblicazione

trust.vocab.rebuild = ricostruzione

trust.vocab.register = ▤ albo

trust.vocab.savetherawrootfilelinkedonkeysastufrootjs = salva il file grezzo della radice collegato su /keys/ come tuf-root.json, byte per byte; quella copia salvata è il tuo pin. prima di usarla, controllala rispetto al registro dei testimoni: trova la riga sha256 che nomina il signed.version della tua copia e fai corrispondere il suo hash allo sha256 dei byte della tua copia; fai corrispondere gli id delle chiavi che la tua copia elenca per il suo ruolo root alla riga di id di chiave più vicina sopra quella; poi conferma che non compare nessuna riga di versione più alta, perché il registro dei testimoni conserva la riga di ogni versione precedente mentre il pin ne tiene una sola. poi esegui:

trust.vocab.signaturedidnotverify = la firma non ha superato la verifica

trust.vocab.signed = ✓ firmato

trust.vocab.signingkeys = chiavi di firma

trust.vocab.solpbcsays = ◆ sol pbc dice

trust.vocab.solstoneforlinux = solstone per linux

trust.vocab.solstoneformacos = solstone per macos

trust.vocab.solstonefortmux = solstone per tmux

trust.vocab.solstoneforwindows = solstone per windows

trust.vocab.solstonetransparencyverifyreleaseroottufrootj1 = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.solstonetransparencyverifyreleaseroottufrootj2 = { $cmd }{ $product }{ $cmd2 }{ $version }{ $cmd3 }{ $metadata }{ $cmd4 }{ $targets }

trust.vocab.solstonetransparencyverifyv2roottufrootjsonm = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.thecheckersownsavedstatedidnotreadback = la rilettura dello stato salvato del controllore stesso non è riuscita

trust.vocab.thejournal = il diario

trust.vocab.therecorddoesnotnamewhatitwaspublishedas = il registro non nomina come è stato pubblicato

trust.vocab.therootsrolesetupdidnotcheckout = la configurazione dei ruoli della radice non ha superato il controllo

trust.vocab.thesigningkeywasnotauthorizedforthisrecord = la chiave di firma non era autorizzata per questo registro

trust.vocab.thev1signingkey = la chiave di firma v1

trust.vocab.thev2signingroot = la radice di firma v2

trust.vocab.thewitnessloglinesforthisroot = le righe del registro dei testimoni per questa radice

trust.vocab.thisisthesignedrecordofproductversionpublish1 = questo è il registro firmato di { $product } { $version }, pubblicato il { $published_utc }. non è l'ultimo elemento della catena v1, quindi non porta una finestra di freschezza propria; la porta solo l'ultimo elemento della catena. la sua firma resta esattamente come è stata pubblicata ed è verificabile oggi.

trust.vocab.thisisthesignedrecordofproductversionpublish2 = questo è il registro firmato di { $product } { $version }, pubblicato il { $published_utc }. agli elementi superati come questo non viene assegnata una finestra di freschezza propria — solo la punta attuale della catena porta un'asserzione di freschezza firmata separatamente. la firma propria di questo elemento resta esattamente come è stata pubblicata ed è verificabile in modo indipendente oggi.

trust.vocab.thisisthesignedrecordofproductversionpublish3 = questo è il registro firmato di { $product } { $version }, pubblicato il { $published_utc }. questa è la punta attuale della catena, ma non è stato possibile controllare il suo puntatore di freschezza firmato separatamente ({ $reason }); è un'affermazione su questo controllo, non sulla firma propria dell'elemento, che resta esattamente come è stata pubblicata ed è verificabile in modo indipendente oggi.

trust.vocab.thispageshowsonefactratherthanfourseparatea = questa pagina mostra un fatto piuttosto che quattro assi separati: senza registri, non c'è una finestra di freschezza, niente da verificare e niente da ricostruire.

trust.vocab.thisportalisforallofsolstonenotonlythejour = questo portale è per tutto solstone, non solo per il diario. i prodotti sono elencati qui man mano che sol pbc pubblica registri di versione per loro, e un prodotto elencato senza registri lo dice.

trust.vocab.v1record = registro v1

trust.vocab.v1releasetimelineclosedchain = linea temporale delle versioni v1 (catena chiusa)

trust.vocab.v2record = registro v2

trust.vocab.v2registernotchecked = albo v2 non controllato

trust.vocab.v2releaserecords = registri di versione v2

trust.vocab.verification = verifica

trust.vocab.verifier = ⟳ verificatore

trust.vocab.whattherecordsaysitproves = cosa il registro dice di dimostrare

trust.vocab.whatthev1recordsdonotprove = cosa non dimostrano i registri v1

trust.vocab.whatthev1recordsprove = cosa dimostrano i registri v1

trust.vocab.withthesamepinnedtufrootjsonnametherecordb = con lo stesso tuf-root.json fissato, nomina il registro in base al suo id di prodotto e alla sua versione come compaiono nel percorso del registro, software/PRODUCT/VERSION, non in base al suo nome visibile, poi esegui:
