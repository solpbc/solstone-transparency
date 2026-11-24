trust.about.body = sol pbc Veröffentlichungs-Transparenz — { $url }{ $nl }{ $nl }was diese Oberfläche bezeugt:{ $nl }- was sol pbc veröffentlicht hat: für jede Produktveröffentlichung ein signierter Ledger-Eintrag,{ $nl }  der die genauen Artefakte, ihre Größen und ihre SHA-256-Digests nennt, sowie{ $nl }  die begleitenden Release-Manifeste und die Belege für Installation und Smoke-Prüfung.{ $nl }- dass sie unveränderlich ist: Veröffentlichungseinträge und Schlüssel liegen unter create-only,{ $nl }  auf unbefristet aufbewahrten Objektpfaden; nichts unter releases/{ $tok }/v/{ $nl }  oder releases/keys/ wird je überschrieben oder gelöscht.{ $nl }- dass sich der Verlauf öffentlich rekonstruieren lässt: die Einträge sind per Hash verkettet,{ $nl }  mit dem Schlüssel unten signiert und unabhängig bezeugt; jede Person kann{ $nl }  die ganze Kette allein von dieser Oberfläche neu ableiten und überprüfen.{ $nl }{ $nl }was diese Oberfläche NICHT behauptet:{ $nl }- sie behauptet nicht, dass die veröffentlichten Binärdateien nachweisbar zu ihrem Quelltext passen (keine{ $nl }  Behauptung eines reproduzierbaren Builds). die Garantie ist, dass jede spätere Umschreibung des{ $nl }  Verlaufs erkennbar ist, nicht dass die ursprüngliche Bezeugung unfehlbar ist.{ $nl }{ $nl }Signierschlüssel: releases/keys/solpbc-transparency-1.pub (minisign). eine Rotation{ $nl }veröffentlicht einen Nachfolgerschlüssel, den sein Vorgänger im selben{ $nl }Verzeichnis gegenzeichnet.{ $nl }{ $nl }Auslieferungsoberflächen (wo die bezeugten Bytes tatsächlich ausgeliefert werden):{ $nl }- solstone-journal: { $url2 } (mit den{ $nl }  Paketen solstone, solstone-core, solstone-journal-cuda und{ $nl }  solstone-journal-models auf demselben Index){ $nl }- solstone-windows: { $url3 }{ $nl }- solstone-linux: { $url4 }{ $nl }{ $nl }Hinweis: "schema"-URLs in Ledger-Einträgen sind Versionskennungen, keine{ $nl }aufrufbaren Dokumente.

trust.axis.asserteduntilwhen = zugesichert bis { $when }

trust.axis.detail = Detail

trust.axis.freshuntilwhen = frisch bis { $when }

trust.axis.howthiswaschecked = wie das geprüft wurde

trust.axis.item = Element

trust.axis.key = Schlüssel

trust.axis.notesha256digestbyteslength = { $length ->
    [one] { $note } { $tok } { $digest } · { $length } Byte
   *[other] { $note } { $tok } { $digest } · { $length } Bytes
}

trust.axis.raw = roh

trust.axis.signed = signiert

trust.axis.signedwhen = signiert { $when }

trust.axis.stamp = abgelaufen { $when }

trust.axis.verified = geprüft

trust.axis.verifiedwhen = geprüft { $when }

trust.chrome.backto = zurück zu { $product }

trust.claims.doesnotprove = { $claim }

trust.claims.doesprove = { $claim }

trust.copy.amanifestbindingthev1releaserecordsintothev = ein Manifest, das die v1-Veröffentlichungsdatensätze in die v2-Signierwurzel bindet, ließ sich nicht überprüfen, als diese Seite erzeugt wurde ({ $reason }); die Prüfung endete dort, und sie ist kein Urteil über irgendeinen v1-Datensatz; die eigene Prüfung jedes Datensatzes steht auf seiner Seite.

trust.copy.arecordofproductversionwasexpectedbasisandi = ein Datensatz von { $product } { $version } wurde erwartet ({ $basis }) und ist nicht in diesem Register. das ist eine Lücke im Register, kein Beleg über die Veröffentlichung.

trust.copy.asignedvaliditywindowonthisregisterhadpassed = ein signiertes Gültigkeitsfenster in diesem Register war am { $date } abgelaufen; Datensätze wurden über dieses Datum hinaus nicht neu geprüft. das ist eine Aussage darüber, wie alt die Zusicherung von sol pbc ist, nicht über die Signatur irgendeines Datensatzes.

trust.copy.eachproductbelowshowswhetherithasasignedrec = jedes Produkt unten zeigt, ob es einen signierten Datensatz in diesem Register hat, v1 oder v2, und jeder Datensatz nennt die genauen Dateien, die er abdeckt. Apps, die über App-Stores ausgeliefert werden (iOS, Android), haben keine Artefakt-URL von sol pbc und hier keinen Datensatz; das ist eine Tatsache darüber, wie diese Builds ausgeliefert werden, keine Aussage über sie. ein Produkt, das nicht aufgeführt ist, oder eine Version ohne Datensatz, ist kein Beleg dafür, dass nichts veröffentlicht wurde. es heißt, dass dieses Register keinen Datensatz dafür hat.

trust.copy.everyrecordonthissiteissignedandyoucanchec = jeder Datensatz auf dieser Website ist signiert, und du kannst diese Signatur selbst prüfen, mit dem öffentlichen Schlüssel, den wir daneben veröffentlichen. eine gültige Signatur sagt dir, dass der Datensatz seit unserer Signatur nicht verändert wurde; sie sagt dir nichts darüber, ob die Software selbst sicher ist oder sich so verhält, wie beschrieben.

trust.copy.newestrecordedreleaseversionsigneddate = zuletzt aufgezeichnete Veröffentlichung { $version } (signiert { $date })

trust.copy.nonepublishedyet = noch nichts veröffentlicht

trust.copy.publicationtothisregisterispausedrightnowby = die Veröffentlichung in dieses Register ist gerade pausiert, durch eine bewusste Entscheidung, nicht wegen eines Vorfalls oder eines Ausfalls. sol pbc hält neue signierte Datensätze zurück, bis wir eine abgestimmte Veröffentlichung über jede solstone-Oberfläche ausliefern, und an dem Punkt prüfen wir die Veröffentlichung neu. jeder Datensatz, der hier schon veröffentlicht ist, bleibt veröffentlicht, unverändert und genau so überprüfbar, wie er ist.

trust.copy.publishingrecords = Datensätze werden veröffentlicht

trust.copy.solpbchascreateditsv2signingrootandboundth1 = sol pbc hat seine v2-Signierwurzel angelegt und die v1-Veröffentlichungsdatensätze darin gebunden. darunter ist noch kein Veröffentlichungsdatensatz veröffentlicht. jeder v1-Datensatz bleibt veröffentlicht, unverändert und mit dem v1-Schlüssel genau so überprüfbar, wie er ist.

trust.copy.solpbchascreateditsv2signingrootandboundth2 = sol pbc hat seine v2-Signierwurzel angelegt und die v1-Veröffentlichungsdatensätze von { $products } darin gebunden; die übrigen v1-Veröffentlichungsdatensätze sind noch nicht gebunden. darunter ist noch kein Veröffentlichungsdatensatz veröffentlicht. jeder v1-Datensatz bleibt veröffentlicht, unverändert und mit dem v1-Schlüssel genau so überprüfbar, wie er ist.

trust.copy.solpbchascreateditsv2signingrooteveryv1rec = sol pbc hat seine v2-Signierwurzel angelegt. jeder v1-Datensatz bleibt veröffentlicht, unverändert und mit dem v1-Schlüssel genau so überprüfbar, wie er ist.

trust.copy.solpbchascreateditsv2signingrootnoreleaser = sol pbc hat seine v2-Signierwurzel angelegt. darunter ist noch kein Veröffentlichungsdatensatz veröffentlicht. jeder v1-Datensatz bleibt veröffentlicht, unverändert und mit dem v1-Schlüssel genau so überprüfbar, wie er ist.

trust.copy.solpbchaspublishedsignedrecordsforsomeofits = sol pbc hat signierte Datensätze für einen Teil seiner Software veröffentlicht, nicht unbedingt für die ganze.

trust.copy.solpbcpublishesreleaserecordsunderitsv2signi = sol pbc veröffentlicht Veröffentlichungsdatensätze unter seiner v2-Signierwurzel. der erste ist { $product } { $version }. die Software-Seite nennt, welche Produkte hier Datensätze haben.

trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa = solstone für Linux und solstone für Windows sind vom Journal getrennt; was dieses Register für sie zeigt, gilt nur für diese Apps.

trust.copy.solstoneisatrademarkofsolpbc = solstone ist eine Marke von sol pbc.

trust.copy.thatourregistercurrentlyhasnosignedrecordfor = dass unser Register gerade keinen signierten Datensatz für eine Windows-Veröffentlichung hat.

trust.copy.thatsolpbcsignedarecordnamingtheseexactarti = dass sol pbc einen Datensatz signiert hat, der diese genauen Artefakte, ihre Digests und ihr Veröffentlichungsdatum nennt, und dass jeder Eintrag richtig mit dem vorherigen in der Kette verknüpft ist.

trust.copy.thatsolpbcsignedarecordnamingthisreleasesex = dass sol pbc einen Datensatz signiert hat, der die genauen Artefakte dieser Veröffentlichung, ihre Digests und das Veröffentlichungsdatum nennt.

trust.copy.thatsolpbcssigningkeyattestedtheseexactartif = dass der Signierschlüssel von sol pbc diese genauen Artefakte bezeugt hat, benannt, bemessen und gehasht im Datensatz, zum genannten Zeitpunkt, und dass dieser Eintrag richtig mit dem vorherigen in der Kette verknüpft ist.

trust.copy.thatsolstonehasneverbeenreleasedforwindows = dass solstone nie für Windows veröffentlicht wurde.

trust.copy.thattheseareallthejournalversionsweverelease = dass das alle Journal-Versionen sind, die wir veröffentlicht haben, oder dass die aufgezeichnete Version die ist, die du gerade ausführst.

trust.copy.thatthesourcecodewepointtoproducedtheseexac = dass der Quelltext, auf den wir zeigen, diese genauen Bytes erzeugt hat (das ist eine Behauptung eines reproduzierbaren Builds, die wir nicht aufstellen), oder dass dies die Version ist, die gerade installiert oder zum Herunterladen verfügbar ist.

trust.copy.thatthisistheonlylinuxreleasewevemadeortha = dass das die einzige Linux-Veröffentlichung ist, die wir gemacht haben, oder dass es das ist, was du gerade ausführst.

trust.copy.thecommandexited2becauseitcouldntreaditsinp = der Befehl endete mit 2, weil seine Eingaben nicht gelesen werden konnten, meist die angeheftete Root-Datei; die Prüfung fand nicht statt, was etwas anderes ist als eine fehlgeschlagene Prüfung und kein Beleg über den Datensatz ist.

trust.copy.thecommandexited2becausethepinnedrootcouldnt = der Befehl endete mit 2, weil die angeheftete Root nicht gelesen werden konnte; die Prüfung fand nicht statt, was etwas anderes ist als eine fehlgeschlagene Prüfung und kein Beleg über das Register ist.

trust.copy.thedistributedfilesthemselvesarenthostedonthi = die verteilten Dateien selbst werden auf dieser Belegoberfläche nicht gehostet. ihre Namen und Digests stehen im signierten Datensatz oben. überprüfe sie, indem du die Datei, die du hast, hasht und sie mit dem Digest hier vergleichst, nicht indem du einem Link folgst.

trust.copy.theproductsbelowaretheoneswevepublishedatle = die Produkte unten sind die, für die wir mindestens einen signierten Datensatz veröffentlicht haben. ein Produkt, das nicht aufgeführt ist, oder eine Lücke zwischen zwei aufgezeichneten Versionen eines Produkts, das aufgeführt ist, ist kein Beleg dafür, dass nichts veröffentlicht wurde. es heißt, dass unser Register keinen Datensatz dafür hat, und das ist eine Tatsache über unser Register, nicht darüber, was wir ausgeliefert haben.

trust.copy.therearethreewaystocheckwhatisherev1record = es gibt drei Wege, das hier zu prüfen. v1-Datensätze werden mit minisign und dem v1-Schlüssel geprüft; das v2-Register wird im Ganzen mit verify-v2 gegen die angeheftete v2-Root geprüft; ein v2-Datensatz wird mit verify-release geprüft. verify-release öffnet dabei auch die eigene Signatur des Datensatzes und holt die Dateien, die er nennt. die Seite jedes Datensatzes sagt, zu welcher Kette er gehört.

trust.copy.therecordforversiondidnotverifyreasonsonoth = der Datensatz für { $version } ließ sich nicht überprüfen ({ $reason }), also wird hier nichts gezeigt, was er behauptet.

trust.copy.therecordstateswhatitdoesanddoesnotprovebo = der Datensatz sagt, was er beweist und was er nicht beweist; beide Listen unten werden wortwörtlich aus dem signierten Datensatz dargestellt.

trust.copy.theregistermovesfromthev1tipprevtothefirst = das Register geht von der v1-Spitze, { $prev }, zum ersten v2-Datensatz, { $next }. Versionen zwischen den beiden haben hier keinen Datensatz; das ist eine Tatsache über dieses Register, nicht darüber, was veröffentlicht wurde.

trust.copy.theresnorecordhereforthatversionthatisntevi = für diese Version gibt es hier keinen Datensatz. das ist kein Beleg dafür, dass sie nicht veröffentlicht wurde, nur dass unser Register keinen signierten Eintrag dafür hat.

trust.copy.theresnorecordhereforversionthechainrunsfro = für { $version } gibt es hier keinen Datensatz; die Kette läuft von { $prev } nach { $next } ohne { $version }, und eine Lücke in diesem Register ist kein Beleg dafür, dass { $version } nie veröffentlicht wurde.

trust.copy.theresnothingatthisaddressheadbacktothetrus = an dieser Adresse ist nichts. geh zurück zum Start des Trust-Portals, oder prüfe das Software-Register auf ein bestimmtes Produkt.

trust.copy.theselinesarepublishedatmorethanonelocation = diese Zeilen sind an mehr als einem Ort veröffentlicht, den sol pbc kontrolliert, unten aufgeführt; sie sind eine Gegenprüfung für eine Root, die du schon angeheftet hast, nicht selbst eine Vertrauenswurzel. im Zeugenprotokoll fügt jede Root-Version eine sha256-Zeile hinzu, und die Schlüssel-ID-Zeile deckt jede sha256-Zeile darunter ab und erscheint nur wieder, wenn sich der Schlüsselsatz ändert.

trust.copy.thesignaturechecksoutthisexactrecordmatchesw = die Signatur stimmt. dieser genaue Datensatz entspricht dem, was wir signiert haben, und wurde nicht verändert.

trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy = die Signatur stimmt nicht. vertraue dieser Kopie nicht, und sag uns, wie du sie bekommen hast.

trust.copy.thev1chainofproductclosedatversionitishist = die v1-Kette von { $product } wurde bei { $version } geschlossen. sie ist Historie, weiter signiert und mit dem v1-Schlüssel weiter überprüfbar; nichts darin wurde neu signiert oder verschoben.

trust.copy.thev1chainrecordednoreleaseofsolstoneforwin = die v1-Kette hat keine Veröffentlichung von solstone für Windows aufgezeichnet und ist geschlossen, also wird sie nie eine aufzeichnen. ein Datensatz von solstone für Windows erscheint unter der v2-Signierwurzel, und diese Seite zeigt ihn dann.

trust.copy.thev1releaserecordscountobjectsareboundinto = { $count ->
     [one] die v1-Veröffentlichungsdatensätze ({ $count } Objekt) sind durch signierte Manifeste in die v2-Signierwurzel gebunden, und jedes davon stimmte, als diese Seite erzeugt wurde.
    *[other] die v1-Veröffentlichungsdatensätze ({ $count } Objekte) sind durch signierte Manifeste in die v2-Signierwurzel gebunden, und jedes davon stimmte, als diese Seite erzeugt wurde.
}

trust.copy.thev1releaserecordsofproductscountobjectsare = { $count ->
     [one] die v1-Veröffentlichungsdatensätze von { $products } ({ $count } Objekt) sind durch signierte Manifeste in die v2-Signierwurzel gebunden, die stimmten, als diese Seite erzeugt wurde; die übrigen v1-Veröffentlichungsdatensätze sind noch nicht gebunden.
    *[other] die v1-Veröffentlichungsdatensätze von { $products } ({ $count } Objekte) sind durch signierte Manifeste in die v2-Signierwurzel gebunden, die stimmten, als diese Seite erzeugt wurde; die übrigen v1-Veröffentlichungsdatensätze sind noch nicht gebunden.
}

trust.copy.thev2registerdidnotverifywhenthispagewasbu = das v2-Register ließ sich nicht überprüfen, als diese Seite erzeugt wurde ({ $reason }), also wird hier nichts daraus gezeigt. das ist eine Aussage über diese Prüfung, nicht über irgendeinen Datensatz.

trust.copy.thisfiledescribesthev1chaininthev1chainsow = diese Datei beschreibt die v1-Kette, in den eigenen Worten der v1-Kette, und wird genau so gezeigt, wie sie veröffentlicht wurde.

trust.copy.thisisthesignedrecordofproductversionpublish1 = das ist der signierte Datensatz von { $product } { $version }, veröffentlicht { $published_utc }. sol pbc hat ihn als gültig bis { $valid_until } signiert; dieses Fenster ist seitdem abgelaufen, und die v1-Kette, zu der dieser Datensatz gehört, ist geschlossen, also erneuert ihn kein späterer v1-Datensatz. der Datensatz und seine Signatur bleiben genau so wie veröffentlicht und lassen sich heute noch überprüfen.

trust.copy.thisisthesignedrecordofproductversionpublish2 = das ist der signierte Datensatz von { $product } { $version }, veröffentlicht { $published_utc }. sol pbc hat ihn als gültig bis { $valid_until } signiert; dieses Fenster ist seitdem abgelaufen, was unsere Veröffentlichungspause widerspiegelt, nicht ein Problem des Datensatzes selbst. der Datensatz und seine Signatur bleiben genau so wie veröffentlicht und lassen sich heute noch überprüfen.

trust.copy.thisisthev2releaserecordofproductversionsig = das ist der v2-Veröffentlichungsdatensatz von { $product } { $version }, signiert { $issued_at }. er nennt die genauen endgültigen Bytes, die sol pbc als diese Veröffentlichung aufgezeichnet hat: url, Länge und { $tok } jeder Datei. die Frische des Registers ist bis { $asserted_until } zugesichert.

trust.copy.thiskeyverifieseverysignedrecordpublishedint = dieser Schlüssel überprüft jeden signierten Datensatz, der in diesem Register veröffentlicht ist.

trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing = dieser Schlüssel überprüft nur die v1-Kette; er signiert nichts Neues.

trust.copy.thispageisaboutproductthesolstoneappthejour = diese Seite handelt von { $product }, der solstone-App. das Journal ist ein eigenes Produkt, mit eigenen Datensätzen.

trust.copy.thisregisteralsoholdsrecordsforproductsthisp = dieses Register enthält auch Datensätze für { $products }; dieses Portal hat noch keine Seite für sie, also verlinkt es stattdessen die rohen Datensätze.

trust.copy.thisregisterhasnosignedrecordsforawindowsre = dieses Register hat keine signierten Datensätze für eine Windows-Veröffentlichung. das ist eine Tatsache darüber, was wir in diesem Register veröffentlicht haben, keine Behauptung darüber, ob solstone auf Windows läuft. null Datensätze hier heißt, dass wir noch keinen aufgezeichnet haben, nicht dass keiner zum Aufzeichnen existiert.

trust.copy.thisregisterholdsav2releaserecordofproductv1 = dieses Register enthält einen v2-Veröffentlichungsdatensatz von { $product } { $version }, signiert { $issued_at }.

trust.copy.thisregisterholdsav2releaserecordofproductv2 = dieses Register enthält einen v2-Veröffentlichungsdatensatz von { $product } { $version }, signiert { $issued_at }. der v1-Verlauf von { $product } bleibt unten, unverändert und mit dem v1-Schlüssel weiter überprüfbar.

trust.copy.thisregisterholdscountsignedrecordforsolstone = { $count ->
     [one] dieses Register enthält { $count } signierten Datensatz für die Linux-Veröffentlichung von solstone, Version { $version }, signiert { $date }.
    *[other] dieses Register enthält { $count } signierte Datensätze für die Linux-Veröffentlichung von solstone, Version { $version }, signiert { $date }.
}

trust.copy.thisregisterholdsnosignedrecordsforsolstones = dieses Register enthält keine signierten Datensätze für die Windows-Veröffentlichung von solstone.

trust.copy.trustsolstoneappiswheresolpbcexplainsinplai = trust.solstone.app ist der Ort, an dem sol pbc in einfacher Sprache erklärt, was wir über unsere eigene Software veröffentlicht haben. die eigentlichen signierten Datensätze liegen auf transparency.solstone.app; diese Website geht sie durch und verlinkt direkt zurück auf die Originale. wenn hier jemals etwas einem Datensatz auf transparency.solstone.app widerspricht, gilt dieser Datensatz.

trust.copy.v1chainclosedatversionnov2recordinthisregi = v1-Kette geschlossen bei { $version } · kein v2-Datensatz in diesem Register

trust.copy.v1chainclosedatversionv2registernotchecked = v1-Kette geschlossen bei { $version } · v2-Register nicht geprüft

trust.copy.v1onlynonewsignatures = nur v1, keine neuen Signaturen

trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe = v2-Datensätze deckt verify-v2 ab. verify-v2 prüft das ganze Register gegen eine angeheftete Kopie der v2-Signierwurzel von sol pbc. eine bestandene Prüfung sagt dir, dass das Register, das du geholt hast, dem entspricht, was die Schlüssel signiert haben, die deine angeheftete Root erlaubt, dass die Bytes jedes Datensatzes zu seiner signierten Beschreibung passen und dass keines der signierten Gültigkeitsfenster von sol pbc abgelaufen war, als du sie ausgeführt hast. verify-v2 öffnet nicht die eigene Signatur eines Datensatzes; das ist Methode 3 unten. es sagt dir nicht, dass die Root, die du angeheftet hast, die richtige ist; das vergleichst du selbst mit den Zeilen des Zeugenprotokolls, aufgeführt auf der Schlüssel-Seite. und es spricht nur über das Register, nicht über die Software, die die Datensätze nennen.

trust.copy.verifyreleasechecksonev2recorditwalksfromyo = verify-release prüft einen v2-Datensatz. der Weg führt von deiner angehefteten Root durch das Register zum Datensatz, die eigene Signatur des Datensatzes wird gegen die Signierschlüssel geprüft, die das Register erlaubt, und dann wird jede Datei, die der Datensatz nennt, von ihrer aufgezeichneten url geholt und die empfangenen Bytes werden mit der aufgezeichneten Länge und sha256 verglichen. eine bestandene Prüfung sagt dir, dass diese Dateien, so wie sie dir in dem Moment ausgeliefert werden, die Bytes sind, die sol pbc als diese Veröffentlichung aufgezeichnet hat. die Prüfung sagt dir nicht, dass die Software sicher ist, und auch nicht, dass ein Build, den du schon hast, diese Bytes sind; vergleiche die sha256 deiner eigenen Kopie selbst mit der des Datensatzes.

trust.copy.wecouldntcompletethecheckusuallyanetworkora = die Prüfung konnte nicht abgeschlossen werden, meist ein Netz- oder Verfügbarkeitsproblem bei uns; das ist etwas anderes als eine fehlgeschlagene Prüfung und kein Beleg dafür, dass der Datensatz falsch ist.

trust.diag.operatordecision2026081218 = Betreiberentscheidung, 2026-08-12/18

trust.diag.operatordecision2026081218publicationisdelib = Betreiberentscheidung, 2026-08-12/18: die Veröffentlichung ist bewusst pausiert

trust.evidence.linkcount = { $count ->
    [one] { $count } genauer Link unten
   *[other] { $count } genaue Links unten
}

trust.home.registerrow = { $state ->
    *[empty] Veröffentlichung pausiert · keine Datensätze in diesem Register
     [hasrecord] Veröffentlichung pausiert · zuletzt aufgezeichnete Veröffentlichung { $version } (signiert { $date })
}

trust.home.verifylead = { $lead ->
    *[v1] so überprüfst du einen Datensatz selbst
     [v2] so überprüfst du selbst, was hier steht
}

trust.keys.linklabel = { $label ->
    *[v1] der öffentliche Schlüssel
     [v2] die Signierschlüssel
}

trust.keys.namedasexpectedatbuildtime = beim Build so benannt wie erwartet

trust.keys.rootintro = { $key_count ->
    [one] das ist die v2-Signierwurzel von sol pbc, Version { $root_version }: eine Schlüssel-ID, die allein signiert. sie wird jährlich erneuert, und jede frühere Zeile des Zeugenprotokolls bleibt veröffentlicht, wenn das geschieht.
   *[other] das ist die v2-Signierwurzel von sol pbc, Version { $root_version }: { $key_count } Schlüssel-IDs, von denen { $threshold } signieren müssen. sie wird jährlich erneuert, und jede frühere Zeile des Zeugenprotokolls bleibt veröffentlicht, wenn das geschieht.
}

trust.keys.thepinnedrootinthepublicverifierrepository = die angeheftete Root im öffentlichen Prüfer-Repository

trust.keys.thewitnesslogonsolpbcorg = das Zeugenprotokoll auf solpbc.org

trust.page.aboutthisregister = über dieses Register

trust.page.aboutthisregistertrustsolstoneapp = über dieses Register — trust.solstone.app

trust.page.active = aktiv

trust.page.algorithm = Algorithmus

trust.page.authorizationpolicy = Autorisierungsrichtlinie

trust.page.backtothesoftwareregister = zurück zum Software-Register

trust.page.breadcrumb = Brotkrumen

trust.page.buildandverificationreportid = Build- und Prüfbericht, { $id }

trust.page.chainledgerderived = Ketten-Ledger (abgeleitet)

trust.page.chainposition = Position in der Kette

trust.page.confidentialprocessingappliance = Appliance für vertrauliche Verarbeitung

trust.page.confidentialprocessingappliancerecord1630bf4pub = Datensatz der Appliance für vertrauliche Verarbeitung, 1630bf4: veröffentlicht

trust.page.confidentialprocessingappliancerecord8e4291dpub = Datensatz der Appliance für vertrauliche Verarbeitung, 8e4291d: veröffentlicht

trust.page.confidentialprocessingappliancerecord9968c21pub = Datensatz der Appliance für vertrauliche Verarbeitung, 9968c21: veröffentlicht

trust.page.confidentialprocessingwhitepaper = vertrauliche Verarbeitung in solstone: wie dein Journal den Dienst prüft, bevor es sendet (Sicherheits-Whitepaper, PDF)

trust.page.couldnotrunexit2 = konnte nicht ausgeführt werden, Exit 2

trust.page.curlorfetchfails = curl oder fetch schlägt fehl

trust.page.ed25519 = ed25519

trust.page.entrysha256 = sha256 des Eintrags

trust.page.entrysignature = Signatur des Eintrags

trust.page.expectedrecordmissing = erwarteter Datensatz fehlt

trust.page.fingerprint = Fingerabdruck

trust.page.footer = Fußzeile

trust.page.freshnessassertion = Frischezusicherung

trust.page.fullpublickeytext = vollständiger Text des öffentlichen Schlüssels

trust.page.godeeper = tiefer gehen

trust.page.home = Start

trust.page.immutableentry = unveränderlicher Eintrag

trust.page.issuedat = ausgestellt am

trust.page.issuetime = Ausgabezeit

trust.page.keys = Schlüssel

trust.page.keystrustsolstoneapp = Schlüssel — trust.solstone.app

trust.page.labelcount = { $label } (×{ $count })

trust.page.latestrecorded = zuletzt aufgezeichnet

trust.page.latestrecordedrelease = zuletzt aufgezeichnete Veröffentlichung

trust.page.linux = Linux

trust.page.mac = Mac

trust.page.mainnavigation = Hauptnavigation

trust.page.minisignsignatureovertheentry = minisign-Signatur über den Eintrag

trust.page.minisignsignatureoverthepointer = minisign-Signatur über den Zeiger

trust.page.mutablelatestpointer = veränderlicher Zeiger auf das Neueste

trust.page.namesand = { $items }

trust.page.nativeproofreceipts = native Prüfbelege

trust.page.nopublishdate = kein Veröffentlichungsdatum

trust.page.norecord = kein Datensatz

trust.page.norecordatthisversion = kein Datensatz für diese Version

trust.page.norecordatthisversiontrustsolstoneapp = kein Datensatz für diese Version — trust.solstone.app

trust.page.norecordsinthisregister = keine Datensätze in diesem Register

trust.page.notarawlink = kein Rohlink

trust.page.notfoundtrustsolstoneapp = nicht gefunden — trust.solstone.app

trust.page.outcome = Ergebnis

trust.page.pinnedroot = angeheftete Root

trust.page.pointersignature = Zeigersignatur

trust.page.policysha256 = sha256 der Richtlinie

trust.page.product = Produkt

trust.page.products = Produkte

trust.page.producttrustsolstoneapp = { $product } — { $tok }

trust.page.productversiontrustsolstoneapp = { $product } { $version } — { $tok }

trust.page.rawevidence = Rohbelege

trust.page.rawkeyfile = rohe Schlüsseldatei

trust.page.rawrootfile = rohe Root-Datei

trust.page.readingtheresult = das Ergebnis lesen

trust.page.record = Datensatz

trust.page.recordedbytes = aufgezeichnete Bytes

trust.page.recordproduct = Produkt des Datensatzes

trust.page.releasemanifests = Release-Manifeste

trust.page.releaserecord = Veröffentlichungsdatensatz

trust.page.rootfilesha256 = sha256 der Root-Datei

trust.page.rootkeyids = Root-Schlüssel-IDs

trust.page.rootversion = Root-Version

trust.page.seqseqgenesis = { $tok } { $seq } Genesis

trust.page.seqseqpreviousversion = { $tok } { $seq } vorherige { $version }

trust.page.sha256digestlengthbytes = { $length ->
    [one] { $tok } { $digest } · { $length } Byte
   *[other] { $tok } { $digest } · { $length } Bytes
}

trust.page.signaturefailstoverify = Signatur lässt sich nicht überprüfen

trust.page.signatureverifies = Signatur stimmt

trust.page.signedledgerentry = signierter Ledger-Eintrag

trust.page.signedpointer = signierter Zeiger

trust.page.signedrecorddsseenvelopeinside = signierter Datensatz (DSSE-Umschlag darin)

trust.page.signerkeyids = IDs der Signierschlüssel

trust.page.signingkey = Signierschlüssel

trust.page.signingkeyset = Satz der Signierschlüssel

trust.page.signingthreshold = Signierschwelle

trust.page.skiptocontent = zum Inhalt springen

trust.page.software = Software

trust.page.softwarepublicationregistersummary = Zusammenfassung des Veröffentlichungsregisters

trust.page.softwareregister = Software-Register

trust.page.softwaretrustsolstoneapp = Software — trust.solstone.app

trust.page.status = Status

trust.page.subject = Betreff

trust.page.targetpath = Zielpfad

trust.page.targetsha256 = Ziel-sha256

trust.page.technicalfields = technische Felder

trust.page.thecommand = der Befehl

trust.page.thederivedchainledger = das abgeleitete Ketten-Ledger

trust.page.thejournalsrecords = die Datensätze des Journals

trust.page.theregisterataglance = das Register im Überblick

trust.page.thesoftwareregister = das Software-Register

trust.page.thisisnotastatementaboutanyrecordtherawevi = das ist keine Aussage über einen Datensatz. die Rohbelege bleiben auf transparency.solstone.app.

trust.page.thisportalcannotpresentcollidingrecords = dieses Portal kann kollidierende Datensätze nicht darstellen

trust.page.thisportalcannotpresentcollidingrecordstrusts = dieses Portal kann kollidierende Datensätze nicht darstellen — trust.solstone.app

trust.page.thisportalcannotpresenttheregisterrightnow = dieses Portal kann das Register gerade nicht darstellen

trust.page.thisrecordcouldnotbeconstructednofieldsfrom = dieser Datensatz ließ sich nicht aufbauen. aus dem fehlgeschlagenen Inhalt wird kein Feld gezeigt.

trust.page.thresholdofkeycount = { $threshold } von { $key_count }

trust.page.timestamprole = Zeitstempel-Rolle

trust.page.trustportalhome = Start des Trust-Portals

trust.page.trustsolstoneapp = trust.solstone.app

trust.page.tworecordsresolvedtothesamerouteleftleftver = zwei Datensätze führen auf denselben Weg { $left } { $left_version } und { $right } { $right_version}. keiner von beiden wird gezeigt.

trust.page.unavailable = nicht verfügbar

trust.page.unavailablereason = nicht verfügbar { $reason }

trust.page.unavailabletrustsolstoneapp = nicht verfügbar — trust.solstone.app

trust.page.v1tiptofirstv2record = v1-Spitze zum ersten v2-Datensatz

trust.page.valid = gültig

trust.page.verify = überprüfen

trust.page.verifyarecordyourself = einen Datensatz selbst überprüfen

trust.page.verifythisrecordyourself = diesen Datensatz selbst überprüfen

trust.page.verifytrustsolstoneapp = überprüfen — trust.solstone.app

trust.page.verifywhatishereyourself = das hier selbst überprüfen

trust.page.versionversion = Version { $version }

trust.page.viewproduct = { $product } anzeigen

trust.page.wedonthaveapageatthataddress = unter dieser Adresse gibt es keine Seite

trust.page.whatitmeans = was das bedeutet

trust.page.whatthisdoesnotprove = was das nicht beweist

trust.page.whatthisproves = was das beweist

trust.page.whycoverageisstatednotimplied = warum die Abdeckung gesagt und nicht mitgemeint ist

trust.page.windows = Windows

trust.product.summaryjournalcount = { $count ->
     [one] dieses Register enthält { $count } signierten Datensatz für die Journal-Veröffentlichung von solstone, zuletzt Version { $version }, signiert { $date }.
    *[other] dieses Register enthält { $count } signierte Datensätze für die Journal-Veröffentlichung von solstone, zuletzt Version { $version }, signiert { $date }.
}

trust.software.journalplatforms = der neueste Datensatz des Journals, { $version }, nennt Dateien für { $platforms }.

trust.vocab.afiledidnotmatchitssigneddescription = eine Datei passte nicht zu ihrer signierten Beschreibung

trust.vocab.afiledidnotparse = eine Datei ließ sich nicht lesen

trust.vocab.anolderversionwasservedthanonealreadyseen = es wurde eine ältere Version ausgeliefert als eine schon gesehene

trust.vocab.asignaturedidnotcheckout = eine Signatur stimmte nicht

trust.vocab.asserteduntil = zugesichert bis

trust.vocab.av1objectdidnotmatchthemanifest = ein v1-Objekt passte nicht zum Manifest

trust.vocab.couldnotbechecked = konnte nicht geprüft werden

trust.vocab.didnotverify = ließ sich nicht überprüfen

trust.vocab.evidencefreshness = Frische der Belege

trust.vocab.expired = abgelaufen

trust.vocab.fromanyreleasesrawevidencetabledownloadledger = lade aus der Rohbelege-Tabelle einer Veröffentlichung ledger-entry.json, ledger-entry.json.minisig und die angeheftete Schlüsseldatei von /keys/ herunter. dann ausführen:

trust.vocab.itssigningkeyismarkedcompromisedinthepolicy = sein Signierschlüssel ist in der Richtlinie als kompromittiert markiert

trust.vocab.method1av1recordwithminisign = Methode 1: ein v1-Datensatz, mit minisign

trust.vocab.method2thev2registerwithverifyv2 = Methode 2: das v2-Register, mit verify-v2

trust.vocab.method3onev2recordwithverifyrelease = Methode 3: ein v2-Datensatz, mit verify-release

trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren = { $cmd }{ $filename }{ $cmd2 }

trust.vocab.norecordyet = noch kein Datensatz

trust.vocab.notattempted = nicht versucht

trust.vocab.nottimebound = nicht zeitlich gebunden

trust.vocab.oneofitssignedvaliditywindowshadpassed = eines seiner signierten Gültigkeitsfenster war abgelaufen

trust.vocab.partoftheregistercouldnotbefetchedorchecked = ein Teil des Registers ließ sich nicht holen oder prüfen

trust.vocab.paused = pausiert

trust.vocab.publication = Veröffentlichung

trust.vocab.rebuild = Neuaufbau

trust.vocab.register = ▤ Register

trust.vocab.savetherawrootfilelinkedonkeysastufrootjs = speichere die rohe Root-Datei, die unter /keys/ verlinkt ist, Byte für Byte als tuf-root.json; diese gespeicherte Kopie ist dein Pin. bevor du sie benutzt, prüfe sie am Zeugenprotokoll: suche die sha256-Zeile, die die signed.version deiner Kopie nennt, und vergleiche ihren Digest mit dem sha256 der Bytes deiner Kopie; vergleiche die Schlüssel-IDs, die deine Kopie für ihre Root-Rolle aufführt, mit der nächsten Schlüssel-ID-Zeile darüber; bestätige dann, dass keine höhere Versionszeile erscheint, weil das Protokoll die Zeile jeder früheren Version aufbewahrt, während der Pin nur eine enthält. dann ausführen:

trust.vocab.signaturedidnotverify = Signatur ließ sich nicht überprüfen

trust.vocab.signed = ✓ signiert

trust.vocab.signingkeys = Signierschlüssel

trust.vocab.solpbcsays = ◆ sol pbc sagt

trust.vocab.solstoneforlinux = solstone für Linux

trust.vocab.solstoneformacos = solstone für macOS

trust.vocab.solstonefortmux = solstone für tmux

trust.vocab.solstoneforwindows = solstone für Windows

trust.vocab.solstonetransparencyverifyreleaseroottufrootj1 = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.solstonetransparencyverifyreleaseroottufrootj2 = { $cmd }{ $product }{ $cmd2 }{ $version }{ $cmd3 }{ $metadata }{ $cmd4 }{ $targets }

trust.vocab.solstonetransparencyverifyv2roottufrootjsonm = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.thecheckersownsavedstatedidnotreadback = der gespeicherte Zustand der Prüfung ließ sich nicht zurücklesen

trust.vocab.thejournal = das Journal

trust.vocab.therecorddoesnotnamewhatitwaspublishedas = der Datensatz nennt nicht, als was er veröffentlicht wurde

trust.vocab.therootsrolesetupdidnotcheckout = die Rollenanordnung der Root stimmte nicht

trust.vocab.thesigningkeywasnotauthorizedforthisrecord = der Signierschlüssel war für diesen Datensatz nicht autorisiert

trust.vocab.thev1signingkey = der v1-Signierschlüssel

trust.vocab.thev2signingroot = die v2-Signierwurzel

trust.vocab.thewitnessloglinesforthisroot = die Zeilen des Zeugenprotokolls für diese Root

trust.vocab.thisisthesignedrecordofproductversionpublish1 = das ist der signierte Datensatz von { $product } { $version }, veröffentlicht { $published_utc }. er ist nicht der letzte Eintrag in der v1-Kette, also trägt er kein eigenes Frischefenster; nur der letzte Eintrag der Kette tut das. seine Signatur bleibt genau so wie veröffentlicht und lässt sich heute überprüfen.

trust.vocab.thisisthesignedrecordofproductversionpublish2 = das ist der signierte Datensatz von { $product } { $version }, veröffentlicht { $published_utc }. abgelöste Einträge wie dieser bekommen kein eigenes Frischefenster — nur die aktuelle Spitze der Kette trägt eine getrennt signierte Frischezusicherung. die eigene Signatur dieses Eintrags bleibt genau so wie veröffentlicht und lässt sich heute unabhängig überprüfen.

trust.vocab.thisisthesignedrecordofproductversionpublish3 = das ist der signierte Datensatz von { $product } { $version }, veröffentlicht { $published_utc }. das ist die aktuelle Spitze der Kette, aber ihr getrennt signierter Frischezeiger konnte nicht geprüft werden ({ $reason }); das ist eine Aussage über diese Prüfung, nicht über die eigene Signatur des Eintrags, die genau so wie veröffentlicht bleibt und sich heute unabhängig überprüfen lässt.

trust.vocab.thispageshowsonefactratherthanfourseparatea = diese Seite zeigt eine Tatsache statt vier getrennter Achsen: ohne Datensätze gibt es kein Frischefenster, nichts zu überprüfen und nichts neu aufzubauen.

trust.vocab.thisportalisforallofsolstonenotonlythejour = dieses Portal ist für ganz solstone, nicht nur für das Journal. Produkte stehen hier, sobald sol pbc Veröffentlichungsdatensätze für sie veröffentlicht, und ein aufgeführtes Produkt ohne Datensätze sagt das.

trust.vocab.v1record = v1-Datensatz

trust.vocab.v1releasetimelineclosedchain = v1-Veröffentlichungszeitstrahl (geschlossene Kette)

trust.vocab.v2record = v2-Datensatz

trust.vocab.v2registernotchecked = v2-Register nicht geprüft

trust.vocab.v2releaserecords = v2-Veröffentlichungsdatensätze

trust.vocab.verification = Überprüfung

trust.vocab.verifier = ⟳ Prüfer

trust.vocab.whattherecordsaysitproves = was der Datensatz sagt, dass er beweist

trust.vocab.whatthev1recordsdonotprove = was die v1-Datensätze nicht beweisen

trust.vocab.whatthev1recordsprove = was die v1-Datensätze beweisen

trust.vocab.withthesamepinnedtufrootjsonnametherecordb = mit derselben angehefteten tuf-root.json benenne den Datensatz nach seiner Produkt-ID und seiner Version, so wie sie im Pfad des Datensatzes stehen, software/PRODUCT/VERSION, nicht nach seinem Anzeigenamen, und führe dann aus:
