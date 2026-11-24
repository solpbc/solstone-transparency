trust.about.body = transparencia de publicaciones de sol pbc — { $url }{ $nl }{ $nl }qué atestigua esta superficie:{ $nl }- qué publicó sol pbc: por cada publicación de un producto, una entrada firmada del libro{ $nl }  que nombra los artefactos exactos, sus tamaños y sus resúmenes SHA-256, más{ $nl }  los manifiestos de publicación que los acompañan y los recibos de prueba de instalación y de humo.{ $nl }- que es inmutable: las entradas de publicación y las claves viven bajo rutas de objetos de solo creación,{ $nl }  conservadas de forma indefinida; nada bajo releases/{ $tok }/v/{ $nl }  ni bajo releases/keys/ se sobrescribe ni se elimina jamás.{ $nl }- que la historia se puede reconstruir en público: las entradas están encadenadas por hash,{ $nl }  firmadas con la clave de abajo y atestiguadas de forma independiente; cualquiera puede{ $nl }  volver a derivar y verificar la cadena completa solo desde esta superficie.{ $nl }{ $nl }qué NO afirma esta superficie:{ $nl }- no afirma que los binarios publicados coincidan de forma demostrable con su código fuente (no{ $nl }  hay una afirmación de compilación reproducible). la garantía es que cualquier reescritura posterior de{ $nl }  la historia es detectable, no que la atestación original sea infalible.{ $nl }{ $nl }clave de firma: releases/keys/solpbc-transparency-1.pub (minisign). la rotación{ $nl }publica una clave sucesora contrafirmada por su predecesora en el mismo{ $nl }directorio.{ $nl }{ $nl }superficies de entrega (donde de verdad se sirven los bytes atestiguados):{ $nl }- solstone-journal: { $url2 } (con los{ $nl }  paquetes solstone, solstone-core, solstone-journal-cuda y{ $nl }  solstone-journal-models en el mismo índice){ $nl }- solstone-windows: { $url3 }{ $nl }- solstone-linux: { $url4 }{ $nl }{ $nl }nota: las URL "schema" dentro de las entradas del libro son identificadores de versión, no{ $nl }documentos dereferenciables.

trust.axis.asserteduntilwhen = afirmado hasta { $when }

trust.axis.detail = detalle

trust.axis.freshuntilwhen = vigente hasta { $when }

trust.axis.howthiswaschecked = cómo se revisó esto

trust.axis.item = ítem

trust.axis.key = clave

trust.axis.notesha256digestbyteslength = { $length ->
     [one] { $note } { $tok } { $digest } bytes { $length }
     [many] { $note } { $tok } { $digest } bytes { $length }
    *[other] { $note } { $tok } { $digest } bytes { $length }
}

trust.axis.raw = bruto

trust.axis.signed = firmado

trust.axis.signedwhen = firmado { $when }

trust.axis.stamp = vencido { $when }

trust.axis.verified = verificado

trust.axis.verifiedwhen = verificado { $when }

trust.chrome.backto = volver a { $product }

trust.claims.doesnotprove = { $claim }

trust.claims.doesprove = { $claim }

trust.copy.amanifestbindingthev1releaserecordsintothev = un manifiesto que liga los registros de publicación v1 a la raíz v2 no se verificó cuando se construyó esta página ({ $reason }); esta revisión se detuvo ahí, y no es un veredicto sobre ningún registro v1; la revisión de cada registro está en su página.

trust.copy.arecordofproductversionwasexpectedbasisandi = se esperaba un registro de { $product } { $version } ({ $basis }) y no está en este índice. eso es un hueco del índice, no evidencia sobre la publicación.

trust.copy.asignedvaliditywindowonthisregisterhadpassed = una ventana de validez firmada de este índice había vencido al { $date }; los registros no se han vuelto a revisar después de esa fecha. eso habla de qué tan antigua es la afirmación de sol pbc, no de la firma de ningún registro.

trust.copy.eachproductbelowshowswhetherithasasignedrec = cada producto de abajo muestra si tiene un registro firmado en este índice, v1 o v2, y cada registro lista los archivos exactos que cubre. las apps que se distribuyen por tiendas de apps (ios, android) no tienen url de artefacto de sol pbc ni registro aquí; eso es un hecho sobre cómo se entregan esas compilaciones, no una afirmación sobre ellas. un producto que no está en la lista, o una versión sin registro, no es evidencia de que no se haya publicado nada. significa que este índice no tiene un registro para eso.

trust.copy.everyrecordonthissiteissignedandyoucanchec = cada registro de este sitio está firmado, y puedes revisar esa firma por tu cuenta con la clave pública que publicamos junto a él. una firma válida te dice que el registro no se ha alterado desde que lo firmamos; no te dice nada sobre si el software en sí es seguro o se comporta como se describe.

trust.copy.newestrecordedreleaseversionsigneddate = publicación registrada más reciente { $version } (firmada el { $date })

trust.copy.nonepublishedyet = todavía sin publicar

trust.copy.publicationtothisregisterispausedrightnowby = la publicación en este índice está en pausa ahora, por una decisión deliberada, no por un incidente ni una interrupción. sol pbc guarda los registros firmados nuevos hasta que publiquemos una publicación coordinada en todas las superficies de solstone, y en ese momento volveremos a evaluar la publicación. cada registro que ya está publicado aquí sigue publicado, sin cambios, y se puede verificar exactamente como está.

trust.copy.publishingrecords = publicando registros

trust.copy.solpbchascreateditsv2signingrootandboundth1 = sol pbc ha creado su raíz de firma v2 y ha ligado en ella los registros de publicación v1. todavía no se ha publicado ningún registro de publicación bajo ella. cada registro v1 sigue publicado, sin cambios, y se puede verificar exactamente como está, con la clave v1.

trust.copy.solpbchascreateditsv2signingrootandboundth2 = sol pbc ha creado su raíz de firma v2 y ha ligado en ella los registros de publicación v1 de { $products }; el resto de los registros de publicación v1 todavía no está ligado. todavía no se ha publicado ningún registro de publicación bajo ella. cada registro v1 sigue publicado, sin cambios, y se puede verificar exactamente como está, con la clave v1.

trust.copy.solpbchascreateditsv2signingrooteveryv1rec = sol pbc ha creado su raíz de firma v2. cada registro v1 sigue publicado, sin cambios, y se puede verificar exactamente como está, con la clave v1.

trust.copy.solpbchascreateditsv2signingrootnoreleaser = sol pbc ha creado su raíz de firma v2. todavía no se ha publicado ningún registro de publicación bajo ella. cada registro v1 sigue publicado, sin cambios, y se puede verificar exactamente como está, con la clave v1.

trust.copy.solpbchaspublishedsignedrecordsforsomeofits = sol pbc ha publicado registros firmados de una parte de su software, no necesariamente de todo.

trust.copy.solpbcpublishesreleaserecordsunderitsv2signi = sol pbc publica registros de publicación bajo su raíz de firma v2. el primero es { $product } { $version }. la página de software lista qué productos tienen registros aquí.

trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa = solstone para linux y solstone para windows están aparte del diario; lo que este índice muestra de ellos trata solo de esas apps.

trust.copy.solstoneisatrademarkofsolpbc = solstone es una marca comercial de sol pbc.

trust.copy.thatourregistercurrentlyhasnosignedrecordfor = que nuestro índice no tiene en este momento un registro firmado de una publicación para windows.

trust.copy.thatsolpbcsignedarecordnamingtheseexactarti = que sol pbc firmó un registro que nombra estos artefactos exactos, sus resúmenes y su fecha de publicación, y que cada entrada está ligada correctamente a la anterior en la cadena.

trust.copy.thatsolpbcsignedarecordnamingthisreleasesex = que sol pbc firmó un registro que nombra los artefactos exactos de esta publicación, sus resúmenes y su fecha de publicación.

trust.copy.thatsolpbcssigningkeyattestedtheseexactartif = que la clave de firma de sol pbc atestiguó estos artefactos exactos, nombrados, con su tamaño y su hash en el registro, en el momento indicado, y que esta entrada está ligada correctamente a la anterior en la cadena.

trust.copy.thatsolstonehasneverbeenreleasedforwindows = que solstone nunca se ha publicado para windows.

trust.copy.thattheseareallthejournalversionsweverelease = que estas son todas las versiones del diario que hemos publicado, o que la versión registrada es la que estás ejecutando ahora.

trust.copy.thatthesourcecodewepointtoproducedtheseexac = que el código fuente al que apuntamos produjo estos bytes exactos (esa es una afirmación de compilación reproducible que no hacemos), o que esta es la versión instalada ahora o disponible para descargar.

trust.copy.thatthisistheonlylinuxreleasewevemadeortha = que esta es la única publicación para linux que hemos hecho, o que es lo que estás ejecutando ahora.

trust.copy.thecommandexited2becauseitcouldntreaditsinp = el comando salió con 2 porque no pudo leer sus entradas, casi siempre el archivo de la raíz anclada; la revisión no se hizo, lo que es distinto de una revisión fallida y no es evidencia sobre el registro.

trust.copy.thecommandexited2becausethepinnedrootcouldnt = el comando salió con 2 porque no se pudo leer la raíz anclada; la revisión no se hizo, lo que es distinto de una revisión fallida y no es evidencia sobre el índice.

trust.copy.thedistributedfilesthemselvesarenthostedonthi = los archivos distribuidos en sí no están alojados en esta superficie de evidencia. sus nombres y resúmenes se declaran en el registro firmado de arriba. verifícalos calculando el hash del archivo que tienes y comparándolo con el resumen de aquí, no siguiendo un enlace.

trust.copy.theproductsbelowaretheoneswevepublishedatle = los productos de abajo son aquellos de los que hemos publicado al menos un registro firmado. un producto que no está en la lista, o un hueco entre dos versiones registradas de un producto que sí está, no es evidencia de que no se haya publicado nada. significa que nuestro índice no tiene un registro para eso, lo cual es un hecho sobre nuestro índice, no sobre lo que distribuimos.

trust.copy.therearethreewaystocheckwhatisherev1record = hay tres maneras de revisar lo que hay aquí. los registros v1 se revisan con minisign y la clave v1; el índice v2 se revisa entero con verify-v2 contra la raíz v2 anclada; un registro v2 se revisa con verify-release, que también abre la firma propia del registro y obtiene los archivos que nombra. la página de cada registro dice a qué cadena pertenece.

trust.copy.therecordforversiondidnotverifyreasonsonoth = el registro de { $version } no se verificó ({ $reason }), así que aquí no se muestra nada de lo que afirma.

trust.copy.therecordstateswhatitdoesanddoesnotprovebo = el registro dice qué demuestra y qué no demuestra; las dos listas de abajo se muestran a partir del registro firmado, palabra por palabra.

trust.copy.theregistermovesfromthev1tipprevtothefirst = el índice pasa de la punta v1, { $prev }, al primer registro v2, { $next }. las versiones entre las dos no tienen registro aquí; eso es un hecho sobre este índice, no sobre lo que se publicó.

trust.copy.theresnorecordhereforthatversionthatisntevi = no hay un registro aquí para esa versión. eso no es evidencia de que no se haya publicado, solo de que nuestro índice no tiene una entrada firmada para ella.

trust.copy.theresnorecordhereforversionthechainrunsfro = no hay un registro aquí para { $version }; la cadena va de { $prev } a { $next } sin esa versión, y un hueco en este índice no es evidencia de que { $version } nunca se haya publicado.

trust.copy.theresnothingatthisaddressheadbacktothetrus = no hay nada en esta dirección. vuelve al inicio del portal de confianza, o revisa el índice de software para un producto específico.

trust.copy.theselinesarepublishedatmorethanonelocation = estas líneas están publicadas en más de un lugar que sol pbc controla, listadas abajo; son una revisión cruzada de una raíz que ya anclaste, no una raíz de confianza en sí. en el registro de testigos, cada versión de la raíz agrega una línea sha256, y la línea de id de clave cubre cada línea sha256 debajo de ella, y solo vuelve a aparecer cuando cambia el conjunto de claves.

trust.copy.thesignaturechecksoutthisexactrecordmatchesw = la firma pasa la revisión. este registro exacto coincide con lo que firmamos y no se ha alterado.

trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy = la firma no pasa la revisión. no confíes en esta copia, y avísanos cómo la obtuviste.

trust.copy.thev1chainofproductclosedatversionitishist = la cadena v1 de { $product } se cerró en { $version }. es historia, sigue firmada y se puede verificar con la clave v1; nada en ella se volvió a firmar ni se movió.

trust.copy.thev1chainrecordednoreleaseofsolstoneforwin = la cadena v1 no registró ninguna publicación de solstone para windows y está cerrada, así que nunca registrará una. cualquier registro de solstone para windows aparecerá bajo la raíz v2 y esta página lo mostrará.

trust.copy.thev1releaserecordscountobjectsareboundinto = { $count ->
     [one] los registros de publicación v1 ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados, y cada uno pasó la revisión cuando se construyó esta página.
     [many] los registros de publicación v1 ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados, y cada uno pasó la revisión cuando se construyó esta página.
    *[other] los registros de publicación v1 ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados, y cada uno pasó la revisión cuando se construyó esta página.
}

trust.copy.thev1releaserecordsofproductscountobjectsare = { $count ->
     [one] los registros de publicación v1 de { $products } ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados que pasaron la revisión cuando se construyó esta página; el resto de los registros de publicación v1 todavía no está ligado.
     [many] los registros de publicación v1 de { $products } ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados que pasaron la revisión cuando se construyó esta página; el resto de los registros de publicación v1 todavía no está ligado.
    *[other] los registros de publicación v1 de { $products } ({ $count } objetos) están ligados a la raíz v2 por manifiestos firmados que pasaron la revisión cuando se construyó esta página; el resto de los registros de publicación v1 todavía no está ligado.
}

trust.copy.thev2registerdidnotverifywhenthispagewasbu = el índice v2 no se verificó cuando se construyó esta página ({ $reason }), así que aquí no se muestra nada de él. eso es una declaración sobre esta revisión, no sobre ningún registro.

trust.copy.thisfiledescribesthev1chaininthev1chainsow = este archivo describe la cadena v1, con las palabras de la propia cadena v1, y se muestra exactamente como se publicó.

trust.copy.thisisthesignedrecordofproductversionpublish1 = este es el registro firmado de { $product } { $version }, publicado el { $published_utc }. sol pbc lo firmó como válido hasta { $valid_until }; esa ventana ya venció, y la cadena v1 a la que pertenece este registro está cerrada, así que ningún registro v1 posterior la renueva. el registro y su firma siguen exactamente como se publicaron y se pueden verificar hoy.

trust.copy.thisisthesignedrecordofproductversionpublish2 = este es el registro firmado de { $product } { $version }, publicado el { $published_utc }. sol pbc lo firmó como válido hasta { $valid_until }; esa ventana ya venció, lo que refleja nuestra pausa de publicación, no un problema del registro en sí. el registro y su firma siguen exactamente como se publicaron y se pueden verificar hoy.

trust.copy.thisisthev2releaserecordofproductversionsig = este es el registro de publicación v2 de { $product } { $version }, firmado el { $issued_at }. nombra los bytes finales exactos que sol pbc registró como esta publicación: la url, la longitud y { $tok } de cada archivo. la vigencia del índice está afirmada hasta { $asserted_until }.

trust.copy.thiskeyverifieseverysignedrecordpublishedint = esta clave verifica cada registro firmado publicado en este índice.

trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing = esta clave verifica solo la cadena v1; no firma nada nuevo.

trust.copy.thispageisaboutproductthesolstoneappthejour = esta página es sobre { $product }, la app de solstone. el diario es un producto aparte, con sus propios registros.

trust.copy.thisregisteralsoholdsrecordsforproductsthisp = este índice también guarda registros de { $products }; este portal todavía no tiene una página para ellos, así que enlaza los registros en bruto.

trust.copy.thisregisterhasnosignedrecordsforawindowsre = este índice no tiene registros firmados de una publicación para windows. eso es un hecho sobre lo que hemos publicado en este índice, no una afirmación sobre si solstone se ejecuta en windows. cero registros aquí significa que todavía no hemos registrado uno, no que no exista uno para registrar.

trust.copy.thisregisterholdsav2releaserecordofproductv1 = este índice guarda un registro de publicación v2 de { $product } { $version }, firmado el { $issued_at }.

trust.copy.thisregisterholdsav2releaserecordofproductv2 = este índice guarda un registro de publicación v2 de { $product } { $version }, firmado el { $issued_at }. la historia v1 de { $product } sigue abajo, sin cambios, y todavía se puede verificar con la clave v1.

trust.copy.thisregisterholdscountsignedrecordforsolstone = { $count ->
     [one] este índice guarda { $count } registro firmado de la publicación de solstone para linux, versión { $version }, firmado el { $date }.
     [many] este índice guarda { $count } registro firmado de la publicación de solstone para linux, versión { $version }, firmado el { $date }.
    *[other] este índice guarda { $count } registro firmado de la publicación de solstone para linux, versión { $version }, firmado el { $date }.
}

trust.copy.thisregisterholdsnosignedrecordsforsolstones = este índice no guarda registros firmados de la publicación de solstone para windows.

trust.copy.trustsolstoneappiswheresolpbcexplainsinplai = trust.solstone.app es donde sol pbc explica, en lenguaje claro, lo que hemos publicado sobre nuestro propio software. los registros firmados reales están en transparency.solstone.app; este sitio los recorre y enlaza directo de vuelta a los originales. si algo de aquí alguna vez no coincide con un registro en transparency.solstone.app, ese registro es el que hay que creer.

trust.copy.v1chainclosedatversionnov2recordinthisregi = cadena v1 cerrada en { $version } · no hay registro v2 en este índice

trust.copy.v1chainclosedatversionv2registernotchecked = cadena v1 cerrada en { $version } · índice v2 sin revisar

trust.copy.v1onlynonewsignatures = solo v1, sin firmas nuevas

trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe = los registros v2 están cubiertos por verify-v2, que revisa el índice entero contra una copia anclada de la raíz de firma v2 de sol pbc. una revisión que pasa te dice que el índice que obtuviste coincide con lo que firmaron las claves que autoriza tu raíz anclada, que los bytes de cada registro coinciden con su descripción firmada y que ninguna de las ventanas de validez firmadas de sol pbc había vencido cuando lo ejecutaste. no abre la firma propia de un registro; eso es el método 3, abajo. no te dice que la raíz que anclaste es la correcta; eso lo comparas por tu cuenta con las líneas del registro de testigos, listadas en la página de claves. y habla solo del índice, no del software que nombran los registros.

trust.copy.verifyreleasechecksonev2recorditwalksfromyo = verify-release revisa un registro v2. recorre desde tu raíz anclada hasta el registro a través del índice, revisa la firma propia del registro contra las claves de firma que el índice autoriza y después obtiene cada archivo que el registro nombra desde su url registrada y compara los bytes que recibe con la longitud registrada y el sha256. una revisión que pasa te dice que esos archivos, tal como se te sirvieron en ese momento, son los bytes que sol pbc registró como esa publicación. no te dice que el software es seguro, ni que una compilación que ya tienes son estos bytes; compara por tu cuenta el sha256 de tu propia copia con el del registro.

trust.copy.wecouldntcompletethecheckusuallyanetworkora = no se pudo completar la revisión, por lo general por un problema de red o de disponibilidad de nuestro lado; eso es distinto de una revisión fallida y no es evidencia de que el registro sea incorrecto.

trust.diag.operatordecision2026081218 = decisión del operador, 2026-08-12/18

trust.diag.operatordecision2026081218publicationisdelib = decisión del operador, 2026-08-12/18: la publicación está en pausa de forma deliberada

trust.evidence.linkcount = { $count ->
     [one] { $count } enlaces exactos abajo
     [many] { $count } enlaces exactos abajo
    *[other] { $count } enlaces exactos abajo
}

trust.home.registerrow = { $state ->
    *[empty] publicación en pausa · no hay registros en este índice
     [hasrecord] publicación en pausa · última publicación registrada { $version } (firmada el { $date })
}

trust.home.verifylead = { $lead ->
    *[v1] cómo verificar un registro por tu cuenta
     [v2] cómo verificar lo que hay aquí por tu cuenta
}

trust.keys.linklabel = { $label ->
    *[v1] la clave pública
     [v2] las claves de firma
}

trust.keys.namedasexpectedatbuildtime = con el nombre esperado al compilar

trust.keys.rootintro = { $key_count ->
     [one] esta es la raíz de firma v2 de sol pbc, versión { $root_version }: un id de clave, el único que firma. se renueva cada año, y cada línea anterior del registro de testigos sigue publicada cuando se renueva.
     [many] esta es la raíz de firma v2 de sol pbc, versión { $root_version }: { $key_count } ids de clave, de los cuales { $threshold } deben firmar. se renueva cada año, y cada línea anterior del registro de testigos sigue publicada cuando se renueva.
    *[other] esta es la raíz de firma v2 de sol pbc, versión { $root_version }: { $key_count } ids de clave, de los cuales { $threshold } deben firmar. se renueva cada año, y cada línea anterior del registro de testigos sigue publicada cuando se renueva.
}

trust.keys.thepinnedrootinthepublicverifierrepository = la raíz anclada en el repositorio público del verificador

trust.keys.thewitnesslogonsolpbcorg = el registro de testigos en solpbc.org

trust.page.aboutthisregister = sobre este índice

trust.page.aboutthisregistertrustsolstoneapp = sobre este índice — trust.solstone.app

trust.page.active = activa

trust.page.algorithm = algoritmo

trust.page.authorizationpolicy = política de autorización

trust.page.backtothesoftwareregister = volver al índice de software

trust.page.breadcrumb = ruta de navegación

trust.page.buildandverificationreportid = informe de compilación y verificación, { $id }

trust.page.chainledgerderived = libro de cadena (derivado)

trust.page.chainposition = posición en la cadena

trust.page.confidentialprocessingappliance = equipo de procesamiento confidencial

trust.page.confidentialprocessingappliancerecord1630bf4pub = registro del equipo de procesamiento confidencial, 1630bf4: publicado

trust.page.confidentialprocessingappliancerecord8e4291dpub = registro del equipo de procesamiento confidencial, 8e4291d: publicado

trust.page.confidentialprocessingappliancerecord9968c21pub = registro del equipo de procesamiento confidencial, 9968c21: publicado

trust.page.confidentialprocessingwhitepaper = procesamiento confidencial en solstone: cómo tu diario revisa el servicio antes de enviar (informe de seguridad, PDF)

trust.page.couldnotrunexit2 = no se pudo ejecutar, salida 2

trust.page.curlorfetchfails = curl o fetch falla

trust.page.ed25519 = ed25519

trust.page.entrysha256 = sha256 de la entrada

trust.page.entrysignature = firma de la entrada

trust.page.expectedrecordmissing = falta el registro esperado

trust.page.fingerprint = huella

trust.page.footer = pie

trust.page.freshnessassertion = afirmación de vigencia

trust.page.fullpublickeytext = texto completo de la clave pública

trust.page.godeeper = ahondar

trust.page.home = inicio

trust.page.immutableentry = entrada inmutable

trust.page.issuedat = emitido

trust.page.issuetime = hora de emisión

trust.page.keys = claves

trust.page.keystrustsolstoneapp = claves — trust.solstone.app

trust.page.labelcount = { $label } (×{ $count })

trust.page.latestrecorded = último registrado

trust.page.latestrecordedrelease = última publicación registrada

trust.page.linux = linux

trust.page.mac = mac

trust.page.mainnavigation = navegación principal

trust.page.minisignsignatureovertheentry = firma minisign sobre la entrada

trust.page.minisignsignatureoverthepointer = firma minisign sobre el puntero

trust.page.mutablelatestpointer = puntero mutable más reciente

trust.page.namesand = { $items }

trust.page.nativeproofreceipts = recibos de prueba nativos

trust.page.nopublishdate = sin fecha de publicación

trust.page.norecord = sin registro

trust.page.norecordatthisversion = sin registro en esta versión

trust.page.norecordatthisversiontrustsolstoneapp = sin registro en esta versión — trust.solstone.app

trust.page.norecordsinthisregister = sin registros en este índice

trust.page.notarawlink = no es un enlace en bruto

trust.page.notfoundtrustsolstoneapp = no se encontró — trust.solstone.app

trust.page.outcome = resultado

trust.page.pinnedroot = raíz anclada

trust.page.pointersignature = firma del puntero

trust.page.policysha256 = sha256 de la política

trust.page.product = producto

trust.page.products = productos

trust.page.producttrustsolstoneapp = { $product } — { $tok }

trust.page.productversiontrustsolstoneapp = { $product } { $version } — { $tok }

trust.page.rawevidence = evidencia en bruto

trust.page.rawkeyfile = archivo de clave en bruto

trust.page.rawrootfile = archivo de raíz en bruto

trust.page.readingtheresult = leer el resultado

trust.page.record = registro

trust.page.recordedbytes = bytes registrados

trust.page.recordproduct = producto del registro

trust.page.releasemanifests = manifiestos de publicación

trust.page.releaserecord = registro de publicación

trust.page.rootfilesha256 = sha256 del archivo de raíz

trust.page.rootkeyids = ids de clave de la raíz

trust.page.rootversion = versión de la raíz

trust.page.seqseqgenesis = { $tok } { $seq } génesis

trust.page.seqseqpreviousversion = { $tok } { $seq } anterior { $version }

trust.page.sha256digestlengthbytes = { $length ->
     [one] { $tok } { $digest } · { $length } bytes
     [many] { $tok } { $digest } · { $length } bytes
    *[other] { $tok } { $digest } · { $length } bytes
}

trust.page.signaturefailstoverify = la firma no se verifica

trust.page.signatureverifies = la firma se verifica

trust.page.signedledgerentry = entrada firmada del libro

trust.page.signedpointer = puntero firmado

trust.page.signedrecorddsseenvelopeinside = registro firmado (sobre DSSE dentro)

trust.page.signerkeyids = ids de clave firmante

trust.page.signingkey = clave de firma

trust.page.signingkeyset = conjunto de claves de firma

trust.page.signingthreshold = umbral de firma

trust.page.skiptocontent = saltar al contenido

trust.page.software = software

trust.page.softwarepublicationregistersummary = resumen del índice de publicaciones de software

trust.page.softwareregister = índice de software

trust.page.softwaretrustsolstoneapp = software — trust.solstone.app

trust.page.status = estado

trust.page.subject = sujeto

trust.page.targetpath = ruta de destino

trust.page.targetsha256 = sha256 de destino

trust.page.technicalfields = campos técnicos

trust.page.thecommand = el comando

trust.page.thederivedchainledger = el libro de la cadena derivada

trust.page.thejournalsrecords = los registros del diario

trust.page.theregisterataglance = el índice, de un vistazo

trust.page.thesoftwareregister = el índice de software

trust.page.thisisnotastatementaboutanyrecordtherawevi = esto no es una declaración sobre ningún registro. la evidencia en bruto permanece en transparency.solstone.app.

trust.page.thisportalcannotpresentcollidingrecords = este portal no puede presentar registros en colisión

trust.page.thisportalcannotpresentcollidingrecordstrusts = este portal no puede presentar registros en colisión — trust.solstone.app

trust.page.thisportalcannotpresenttheregisterrightnow = este portal no puede presentar el índice ahora mismo

trust.page.thisrecordcouldnotbeconstructednofieldsfrom = no se pudo construir este registro. no se muestra ningún campo del cuerpo fallido.

trust.page.thresholdofkeycount = { $threshold } de { $key_count }

trust.page.timestamprole = rol timestamp

trust.page.trustportalhome = inicio del portal de confianza

trust.page.trustsolstoneapp = trust.solstone.app

trust.page.tworecordsresolvedtothesamerouteleftleftver = dos registros se resolvieron en la misma ruta { $left } { $left_version } y { $right } { $right_version}. no se muestra ninguno.

trust.page.unavailable = no disponible

trust.page.unavailablereason = no disponible { $reason }

trust.page.unavailabletrustsolstoneapp = no disponible — trust.solstone.app

trust.page.v1tiptofirstv2record = punta v1 al primer registro v2

trust.page.valid = válido

trust.page.verify = verificar

trust.page.verifyarecordyourself = verificar un registro por tu cuenta

trust.page.verifythisrecordyourself = verificar este registro por tu cuenta

trust.page.verifytrustsolstoneapp = verificar — trust.solstone.app

trust.page.verifywhatishereyourself = verificar por tu cuenta lo que hay aquí

trust.page.versionversion = versión { $version }

trust.page.viewproduct = ver { $product }

trust.page.wedonthaveapageatthataddress = no tenemos una página en esa dirección

trust.page.whatitmeans = qué significa

trust.page.whatthisdoesnotprove = qué no demuestra esto

trust.page.whatthisproves = qué demuestra esto

trust.page.whycoverageisstatednotimplied = por qué la cobertura se declara, no queda implícita

trust.page.windows = windows

trust.product.summaryjournalcount = { $count ->
     [one] este índice guarda { $count } registros firmados para la publicación del diario de solstone, más recientemente la versión { $version }, firmada el { $date }.
     [many] este índice guarda { $count } registros firmados para la publicación del diario de solstone, más recientemente la versión { $version }, firmada el { $date }.
    *[other] este índice guarda { $count } registros firmados para la publicación del diario de solstone, más recientemente la versión { $version }, firmada el { $date }.
}

trust.software.journalplatforms = el registro más reciente del diario, { $version }, nombra archivos para { $platforms }.

trust.vocab.afiledidnotmatchitssigneddescription = un archivo no coincidió con su descripción firmada

trust.vocab.afiledidnotparse = un archivo no se pudo analizar

trust.vocab.anolderversionwasservedthanonealreadyseen = se sirvió una versión más antigua que una ya vista

trust.vocab.asignaturedidnotcheckout = una firma no pasó la revisión

trust.vocab.asserteduntil = afirmado hasta

trust.vocab.av1objectdidnotmatchthemanifest = un objeto v1 no coincidió con el manifiesto

trust.vocab.couldnotbechecked = no se pudo revisar

trust.vocab.didnotverify = no se verificó

trust.vocab.evidencefreshness = vigencia de la evidencia

trust.vocab.expired = vencido

trust.vocab.fromanyreleasesrawevidencetabledownloadledger = desde la tabla de evidencia en bruto de cualquier publicación, descarga ledger-entry.json, ledger-entry.json.minisig y el archivo de clave anclado nombrado en /keys/. después ejecuta:

trust.vocab.itssigningkeyismarkedcompromisedinthepolicy = su clave de firma está marcada como comprometida en la política

trust.vocab.method1av1recordwithminisign = método 1: un registro v1, con minisign

trust.vocab.method2thev2registerwithverifyv2 = método 2: el índice v2, con verify-v2

trust.vocab.method3onev2recordwithverifyrelease = método 3: un registro v2, con verify-release

trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren = { $cmd }{ $filename }{ $cmd2 }

trust.vocab.norecordyet = todavía no hay registro

trust.vocab.notattempted = no se intentó

trust.vocab.nottimebound = sin límite de tiempo

trust.vocab.oneofitssignedvaliditywindowshadpassed = una de sus ventanas de validez firmadas había pasado

trust.vocab.partoftheregistercouldnotbefetchedorchecked = parte del índice no se pudo obtener o revisar

trust.vocab.paused = en pausa

trust.vocab.publication = publicación

trust.vocab.rebuild = reconstrucción

trust.vocab.register = ▤ índice

trust.vocab.savetherawrootfilelinkedonkeysastufrootjs = guarda el archivo de raíz en bruto enlazado en /keys/ como tuf-root.json, byte por byte; esa copia guardada es tu ancla. antes de usarla, revísala contra el registro de testigos: encuentra la línea sha256 que nombra el signed.version de tu copia y haz coincidir su resumen con el sha256 de los bytes de tu copia; haz coincidir los ids de clave que tu copia enumera para su rol root con la línea de id de clave más cercana por encima de esa; después confirma que no aparece una línea de versión más alta, porque el registro de testigos conserva la línea de cada versión anterior mientras el ancla guarda solo una. después ejecuta:

trust.vocab.signaturedidnotverify = la firma no se verificó

trust.vocab.signed = ✓ firmado

trust.vocab.signingkeys = claves de firma

trust.vocab.solpbcsays = ◆ sol pbc dice

trust.vocab.solstoneforlinux = solstone para linux

trust.vocab.solstoneformacos = solstone para macos

trust.vocab.solstonefortmux = solstone para tmux

trust.vocab.solstoneforwindows = solstone para windows

trust.vocab.solstonetransparencyverifyreleaseroottufrootj1 = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.solstonetransparencyverifyreleaseroottufrootj2 = { $cmd }{ $product }{ $cmd2 }{ $version }{ $cmd3 }{ $metadata }{ $cmd4 }{ $targets }

trust.vocab.solstonetransparencyverifyv2roottufrootjsonm = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.thecheckersownsavedstatedidnotreadback = el estado guardado del propio verificador no se pudo volver a leer

trust.vocab.thejournal = el diario

trust.vocab.therecorddoesnotnamewhatitwaspublishedas = el registro no nombra como qué se publicó

trust.vocab.therootsrolesetupdidnotcheckout = la configuración de roles de la raíz no pasó la revisión

trust.vocab.thesigningkeywasnotauthorizedforthisrecord = la clave de firma no estaba autorizada para este registro

trust.vocab.thev1signingkey = la clave de firma v1

trust.vocab.thev2signingroot = la raíz de firma v2

trust.vocab.thewitnessloglinesforthisroot = las líneas del registro de testigos para esta raíz

trust.vocab.thisisthesignedrecordofproductversionpublish1 = este es el registro firmado de { $product } { $version }, publicado el { $published_utc }. no es la última entrada de la cadena v1, así que no lleva una ventana de vigencia propia; solo la lleva la última entrada de la cadena. su firma permanece exactamente como se publicó y es verificable hoy.

trust.vocab.thisisthesignedrecordofproductversionpublish2 = este es el registro firmado de { $product } { $version }, publicado el { $published_utc }. a las entradas superadas como esta no se les asigna una ventana de vigencia propia — solo la punta actual de la cadena lleva una afirmación de vigencia firmada por separado. la firma propia de esta entrada permanece exactamente como se publicó y es verificable de forma independiente hoy.

trust.vocab.thisisthesignedrecordofproductversionpublish3 = este es el registro firmado de { $product } { $version }, publicado el { $published_utc }. esta es la punta actual de la cadena, pero su puntero de vigencia firmado por separado no se pudo revisar ({ $reason }); eso es una declaración sobre esta revisión, no sobre la firma propia de la entrada, que permanece exactamente como se publicó y es verificable de forma independiente hoy.

trust.vocab.thispageshowsonefactratherthanfourseparatea = esta página muestra un solo hecho en lugar de cuatro ejes separados: sin registros, no hay ventana de vigencia, nada que verificar y nada que reconstruir.

trust.vocab.thisportalisforallofsolstonenotonlythejour = este portal es para todo solstone, no solo para el diario. los productos se listan aquí a medida que sol pbc publica registros de publicación para ellos, y un producto listado sin registros lo dice.

trust.vocab.v1record = registro v1

trust.vocab.v1releasetimelineclosedchain = línea de tiempo de publicaciones v1 (cadena cerrada)

trust.vocab.v2record = registro v2

trust.vocab.v2registernotchecked = índice v2 sin revisar

trust.vocab.v2releaserecords = registros de publicación v2

trust.vocab.verification = verificación

trust.vocab.verifier = ⟳ verificador

trust.vocab.whattherecordsaysitproves = qué dice el registro que demuestra

trust.vocab.whatthev1recordsdonotprove = qué no demuestran los registros v1

trust.vocab.whatthev1recordsprove = qué demuestran los registros v1

trust.vocab.withthesamepinnedtufrootjsonnametherecordb = con el mismo tuf-root.json anclado, nombra el registro por su id de producto y su versión tal como aparecen en la ruta del registro, software/PRODUCT/VERSION, no por su nombre visible, después ejecuta:
