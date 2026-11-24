trust.about.body = sol pbc release transparency — { $url }{ $nl }{ $nl }what this surface attests:{ $nl }- what sol pbc released: for each product release, a signed ledger entry{ $nl }  naming the exact artifacts, their sizes, and their SHA-256 digests, plus{ $nl }  the companion release manifests and install/smoke proof receipts.{ $nl }- that it is immutable: release entries and keys live under create-only,{ $nl }  indefinitely retained object paths; nothing under releases/{ $tok }/v/{ $nl }  or releases/keys/ is ever overwritten or deleted.{ $nl }- that history is publicly reconstructible: entries are hash-chained,{ $nl }  signed with the key below, and independently witnessed; anyone can{ $nl }  re-derive and verify the full chain from this surface alone.{ $nl }{ $nl }what this surface does NOT claim:{ $nl }- it does not claim the released binaries provably match their source (no{ $nl }  reproducible-build claim). the guarantee is that any later rewrite of{ $nl }  history is detectable, not that the original attestation is infallible.{ $nl }{ $nl }signing key: releases/keys/solpbc-transparency-1.pub (minisign). rotation{ $nl }publishes a successor key cross-signed by its predecessor in the same{ $nl }directory.{ $nl }{ $nl }delivery surfaces (where the attested bytes are actually served):{ $nl }- solstone-journal: { $url2 } (with the{ $nl }  solstone, solstone-core, solstone-journal-cuda, and{ $nl }  solstone-journal-models packages on the same index){ $nl }- solstone-windows: { $url3 }{ $nl }- solstone-linux: { $url4 }{ $nl }{ $nl }note: "schema" URLs inside ledger entries are version identifiers, not{ $nl }dereferenceable documents.

trust.axis.asserteduntilwhen = asserted until { $when }

trust.axis.detail = detail

trust.axis.freshuntilwhen = fresh until { $when }

trust.axis.howthiswaschecked = how this was checked

trust.axis.item = item

trust.axis.key = key

trust.axis.notesha256digestbyteslength = { $length ->
     [one] { $note } { $tok } { $digest } bytes { $length }
    *[other] { $note } { $tok } { $digest } bytes { $length }
}


trust.axis.raw = raw

trust.axis.signed = signed

trust.axis.signedwhen = signed { $when }

trust.axis.stamp = expired { $when }

trust.axis.verified = verified

trust.axis.verifiedwhen = verified { $when }

trust.chrome.backto = back to { $product }

trust.claims.doesnotprove = { $claim }

trust.claims.doesprove = { $claim }

trust.copy.amanifestbindingthev1releaserecordsintothev = a manifest binding the v1 release records into the v2 root did not verify when this page was built ({ $reason }); this check stopped there, and it is not a verdict on any v1 record; each record's own check is on its page.

trust.copy.arecordofproductversionwasexpectedbasisandi = a record of { $product } { $version } was expected ({ $basis }) and is not in this register. that is a gap in the register, not evidence about the release.

trust.copy.asignedvaliditywindowonthisregisterhadpassed = a signed validity window on this register had passed by { $date }; records have not been re-checked past that date. that is a statement about how old sol pbc's assertion is, not about any record's signature.

trust.copy.eachproductbelowshowswhetherithasasignedrec = each product below shows whether it has a signed record in this register, v1 or v2, and each record lists the exact files it covers. apps shipped through app stores (ios, android) have no sol pbc artifact url and no record here; that is a fact about how those builds are delivered, not a statement about them. a product that isn't listed, or a version with no record, isn't evidence that nothing was released. it means this register has no record for it.

trust.copy.everyrecordonthissiteissignedandyoucanchec = every record on this site is signed, and you can check that signature yourself using the public key we publish alongside it. a valid signature tells you the record hasn't been altered since we signed it; it doesn't tell you anything about whether the software itself is safe or behaves as described.

trust.copy.newestrecordedreleaseversionsigneddate = newest recorded release { $version } (signed { $date })

trust.copy.nonepublishedyet = none published yet

trust.copy.publicationtothisregisterispausedrightnowby = publication to this register is paused right now, by deliberate decision, not because of an incident or an outage. sol pbc is holding new signed records until we ship one coordinated release across every solstone surface, and we'll re-evaluate publication at that point. every record already published here stays published, unchanged, and verifiable exactly as it is.

trust.copy.publishingrecords = publishing records

trust.copy.solpbchascreateditsv2signingrootandboundth1 = sol pbc has created its v2 signing root and bound the v1 release records into it. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

trust.copy.solpbchascreateditsv2signingrootandboundth2 = sol pbc has created its v2 signing root and bound the v1 release records of { $products } into it; the rest of the v1 release records are not yet bound. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

trust.copy.solpbchascreateditsv2signingrooteveryv1rec = sol pbc has created its v2 signing root. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

trust.copy.solpbchascreateditsv2signingrootnoreleaser = sol pbc has created its v2 signing root. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

trust.copy.solpbchaspublishedsignedrecordsforsomeofits = sol pbc has published signed records for some of its software, not necessarily all of it.

trust.copy.solpbcpublishesreleaserecordsunderitsv2signi = sol pbc publishes release records under its v2 signing root. the first is { $product } { $version }. the software page lists which products have records here.

trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa = solstone for linux and solstone for windows are separate from the journal; what this register shows for them is about those apps alone.

trust.copy.solstoneisatrademarkofsolpbc = solstone is a trademark of sol pbc.

trust.copy.thatourregistercurrentlyhasnosignedrecordfor = that our register currently has no signed record for a windows release.

trust.copy.thatsolpbcsignedarecordnamingtheseexactarti = that sol pbc signed a record naming these exact artifacts, their digests, and their release date, and that each entry is correctly linked to the one before it in the chain.

trust.copy.thatsolpbcsignedarecordnamingthisreleasesex = that sol pbc signed a record naming this release's exact artifacts, digests, and release date.

trust.copy.thatsolpbcssigningkeyattestedtheseexactartif = that sol pbc's signing key attested these exact artifacts, named, sized, and hashed in the record, at the stated time, and that this entry is correctly linked to the one before it in the chain.

trust.copy.thatsolstonehasneverbeenreleasedforwindows = that solstone has never been released for windows.

trust.copy.thatthesourcecodewepointtoproducedtheseexac = that the source code we point to produced these exact bytes (that's a reproducible-build claim we don't make), or that this is the version currently installed or available to download.

trust.copy.thattheseareallthejournalversionsweverelease = that these are all the journal versions we've released, or that the recorded version is the one you're currently running.

trust.copy.thatthisistheonlylinuxreleasewevemadeortha = that this is the only linux release we've made, or that it's what you're running now.

trust.copy.thecommandexited2becauseitcouldntreaditsinp = the command exited 2 because it couldn't read its inputs, most often the pinned root file; the check didn't happen, which is different from a failed check and isn't evidence about the record.

trust.copy.thecommandexited2becausethepinnedrootcouldnt = the command exited 2 because the pinned root couldn't be read; the check didn't happen, which is different from a failed check and isn't evidence about the register.

trust.copy.thecommandprintedacceptedandexited0theregist = the command printed { $tok } and exited 0: the register you fetched matches what was signed by the keys your pinned root authorizes, every record's bytes match their signed description, and no signed validity window had passed when you ran it.

trust.copy.thecommandprintedacceptedreleaserecordandexit = the command printed { $tok } and exited 0: the record verified through your pinned root, its signature checked against an authorized key, and every file it names was fetched and matched its recorded length and { $tok2 }.

trust.copy.thecommandprintedrejectedwithareasonandexite1 = the command printed { $tok } with a reason and exited 1; read the reason. "{ $tok2 }" means one of sol pbc's signed validity windows has passed (a fact about sol pbc's assertion, not about any record's signature). "{ $tok3 }" or "{ $tok4 }" means an object couldn't be fetched and the check did not complete. "{ $tok5 }" points at a file on your machine, not at the register; "{ $tok6 }" means a file could not be read or did not parse; the detail line names the field, not always the file, so on a first run check the root file you saved first. any other reason means what { $tok7 } served did not check out.

trust.copy.thecommandprintedrejectedwithareasonandexite2 = the command printed { $tok } with a reason and exited 1; read the reason. { $tok2 } means the product id or version you typed isn't a valid name; { $tok3 } means no record exists under that product id and version, which is a gap in the register, not evidence about a release. a trust-store reason points at a file on your machine. a reason about a fetch means a file couldn't be retrieved and the check did not complete. { $tok4 } means what it means in method 2. any other reason, with the command as printed here, means the register, the record, or a file it names did not check out as served to you.

trust.copy.thedistributedfilesthemselvesarenthostedonthi = the distributed files themselves aren't hosted on this evidence surface. their names and digests are declared in the signed record above. verify them by hashing the file you have and comparing it to the digest here, not by following a link.

trust.copy.theproductsbelowaretheoneswevepublishedatle = the products below are the ones we've published at least one signed record for. a product that isn't listed, or a gap between two recorded versions of a product that is, isn't evidence that nothing was released. it means our register doesn't have a record for it, which is a fact about our register, not about what we shipped.

trust.copy.therecordforversiondidnotverifyreasonsonoth = the record for { $version } did not verify ({ $reason }), so nothing it claims is shown here.

trust.copy.therecordstateswhatitdoesanddoesnotprovebo = the record states what it does and does not prove; both lists below are rendered from the signed record, word for word.

trust.copy.theregistermovesfromthev1tipprevtothefirst = the register moves from the v1 tip, { $prev }, to the first v2 record, { $next }. versions between the two have no record here; that is a fact about this register, not about what was released.

trust.copy.thesignaturechecksoutthisexactrecordmatchesw = the signature checks out. this exact record matches what we signed and hasn't been altered.

trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy = the signature doesn't check out. don't trust this copy, and let us know how you got it.

trust.copy.thev1chainofproductclosedatversionitishist = the v1 chain of { $product } closed at { $version }. it is history, still signed and still verifiable with the v1 key; nothing in it was re-signed or moved.

trust.copy.thev1chainrecordednoreleaseofsolstoneforwin = the v1 chain recorded no release of solstone for windows and is closed, so it never will record one. any record of solstone for windows will appear under the v2 root and this page will show it.

trust.copy.thev1releaserecordscountobjectsareboundinto = { $count ->
     [one] the v1 release records ({ $count } objects) are bound into the v2 root by signed manifests, and every one of them checked out when this page was built.
    *[other] the v1 release records ({ $count } objects) are bound into the v2 root by signed manifests, and every one of them checked out when this page was built.
}


trust.copy.thev1releaserecordsofproductscountobjectsare = { $count ->
     [one] the v1 release records of { $products } ({ $count } objects) are bound into the v2 root by signed manifests that checked out when this page was built; the rest of the v1 release records are not yet bound.
    *[other] the v1 release records of { $products } ({ $count } objects) are bound into the v2 root by signed manifests that checked out when this page was built; the rest of the v1 release records are not yet bound.
}


trust.copy.thev2registerdidnotverifywhenthispagewasbu = the v2 register did not verify when this page was built ({ $reason }), so nothing from it is shown here. that is a statement about this check, not about any record.

trust.copy.therearethreewaystocheckwhatisherev1record = there are three ways to check what is here. v1 records are checked with minisign and the v1 key; the v2 register is checked whole with verify-v2 against the pinned v2 root; one v2 record is checked with verify-release, which also opens the record's own signature and fetches the files it names. each record's page says which chain it belongs to.

trust.copy.theresnorecordhereforthatversionthatisntevi = there's no record here for that version. that isn't evidence it wasn't released, only that our register has no signed entry for it.

trust.copy.theresnorecordhereforversionthechainrunsfro = there's no record here for { $version }; the chain runs from { $prev } to { $next } without it, and a gap in this register is not evidence that { $version } was never released.

trust.copy.theresnothingatthisaddressheadbacktothetrus = there's nothing at this address. head back to the trust portal home, or check the software register for a specific product.

trust.copy.theselinesarepublishedatmorethanonelocation = these lines are published at more than one location sol pbc controls, listed below; they are a cross-check for a root you have already pinned, not a trust root themselves. in the witness log, each root version adds one sha256 line, and the key id line covers every sha256 line below it, reappearing only when the key set changes.

trust.copy.thisfiledescribesthev1chaininthev1chainsow = this file describes the v1 chain, in the v1 chain's own words, and is shown exactly as published.

trust.copy.thisisthesignedrecordofproductversionpublish1 = this is the signed record of { $product } { $version }, published { $published_utc }. sol pbc signed it as valid through { $valid_until }; that window has since passed, and the v1 chain this record belongs to is closed, so no later v1 record renews it. the record and its signature remain exactly as published and remain verifiable today.

trust.copy.thisisthesignedrecordofproductversionpublish2 = this is the signed record of { $product } { $version }, published { $published_utc }. sol pbc signed it as valid through { $valid_until }; that window has since passed, which reflects our publication pause, not a problem with the record itself. the record and its signature remain exactly as published and remain verifiable today.

trust.copy.thisisthev2releaserecordofproductversionsig = this is the v2 release record of { $product } { $version }, signed { $issued_at }. it names the exact final bytes sol pbc recorded as this release: each file's url, length, and { $tok }. the register's freshness is asserted until { $asserted_until }.

trust.copy.thiskeyverifieseverysignedrecordpublishedint = this key verifies every signed record published in this register.

trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing = this key verifies the v1 chain only; it signs nothing new.

trust.copy.thispageisaboutproductthesolstoneappthejour = this page is about { $product }, the solstone app. the journal is a separate product, with its own records.

trust.copy.thisregisteralsoholdsrecordsforproductsthisp = this register also holds records for { $products }; this portal has no page for them yet, so it links the raw records instead.

trust.copy.thisregisterhasnosignedrecordsforawindowsre = this register has no signed records for a windows release. that's a fact about what we've published to this register, not a claim about whether solstone runs on windows. zero records here means we haven't recorded one yet, not that none exists to record.

trust.copy.thisregisterholdsav2releaserecordofproductv1 = this register holds a v2 release record of { $product } { $version }, signed { $issued_at }.

trust.copy.thisregisterholdsav2releaserecordofproductv2 = this register holds a v2 release record of { $product } { $version }, signed { $issued_at }. the v1 history of { $product } stays below, unchanged and still verifiable with the v1 key.

trust.copy.thisregisterholdscountsignedrecordforsolstone = { $count ->
     [one] this register holds { $count } signed record for solstone's linux release, version { $version }, signed { $date }.
    *[other] this register holds { $count } signed record for solstone's linux release, version { $version }, signed { $date }.
}


trust.copy.thisregisterholdsnosignedrecordsforsolstones = this register holds no signed records for solstone's windows release.

trust.copy.trustsolstoneappiswheresolpbcexplainsinplai = trust.solstone.app is where sol pbc explains, in plain language, what we've published about our own software. the actual signed records live at transparency.solstone.app; this site walks through them and links straight back to the originals. if anything here ever disagrees with a record at transparency.solstone.app, that record is the one to believe.

trust.copy.v1chainclosedatversionnov2recordinthisregi = v1 chain closed at { $version } · no v2 record in this register

trust.copy.v1chainclosedatversionv2registernotchecked = v1 chain closed at { $version } · v2 register not checked

trust.copy.v1onlynonewsignatures = v1 only, no new signatures

trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe = v2 records are covered by verify-v2, which checks the whole register against a pinned copy of sol pbc's v2 signing root. a passing check tells you the register you fetched matches what was signed by the keys your pinned root authorizes, that every record's bytes match their signed description, and that none of sol pbc's signed validity windows had passed when you ran it. it does not open a record's own signature; that is method 3 below. it does not tell you the root you pinned is the right one; you compare that yourself against the witness log lines, listed on the keys page. and it speaks only to the register, not to the software the records name.

trust.copy.verifyreleasechecksonev2recorditwalksfromyo = verify-release checks one v2 record. it walks from your pinned root to the record through the register, checks the record's own signature against the signing keys the register authorizes, and then fetches every file the record names from its recorded url and compares the bytes it receives against the recorded length and sha256. a passing check tells you those files, as served to you at that moment, are the bytes sol pbc recorded as that release. it does not tell you the software is safe, or that a build you already have is these bytes; compare your own copy's sha256 against the record's yourself.

trust.copy.wecouldntcompletethecheckusuallyanetworkora = we couldn't complete the check, usually a network or availability issue on our end; that's different from a failed check and isn't evidence the record is wrong.

trust.diag.artifactsmanifestsproofsmusteachbearrays = artifacts/manifests/proofs must each be arrays

trust.diag.brokenchainlinkentrydeclaresprevsha256declare = broken chain link: entry declares prev_sha256={ $declared } but the actual previous entry hashes to { $actual }

trust.diag.candidatewasnotalreadyinnormalizedformrefusin = candidate was not already in normalized form — refusing to link a URL that differs from what it will actually resolve to

trust.diag.couldnotfetchthepinnedpublickey = could not fetch the pinned public key

trust.diag.couldnotparseminisignkeyidfromthepublickey = could not parse minisign key id from the public-key file

trust.diag.couldnotruntheverifiererror = could not run the verifier: { $error }

trust.diag.credentialsnotallowedinarawlink = credentials not allowed in a raw link

trust.diag.entrybodyisnotvalidjson = entry body is not valid JSON

trust.diag.entryhasnoproductfield = entry has no product field

trust.diag.entryhasnoversionfield = entry has no version field

trust.diag.fragmentnotallowedinarawlink = fragment not allowed in a raw link

trust.diag.hostmustbeexpectedgothost = host must be { $expected }, got { $host }

trust.diag.minisignverificationfailederror = minisign verification failed: { $error }

trust.diag.nocanonicalartifactrouteforproductproduct = no canonical artifact route for product { $product }

trust.diag.nonasciivalueatpath = non-ASCII value at { $path }

trust.diag.nondefaultportnotallowed = non-default port not allowed

trust.diag.notaparseableurl = not a parseable URL

trust.diag.operatordecision2026081218 = operator decision, 2026-08-12/18

trust.diag.operatordecision2026081218publicationisdelib = operator decision, 2026-08-12/18: publication is deliberately paused

trust.diag.pathcontainsadoubledseparator = path contains a doubled separator

trust.diag.pathcontainsanencodedseparatorordotsegmentam = path contains an encoded separator or dot-segment ambiguity

trust.diag.pathmustnameonefiledirectlyunderprefix = path must name one file directly under { $prefix }

trust.diag.pointerbodyisnotvalidjson = pointer body is not valid JSON

trust.diag.pointerismissingarequiredfield = pointer is missing a required field

trust.diag.prevmismatchcommentcommentbodybody = prev mismatch: comment={ $comment } body={ $body }

trust.diag.prevsha256mustbeexactly64lowercasehexcharact = prev_sha256 must be exactly 64 lowercase hex characters

trust.diag.prevversionfieldmissinguseemptystringatgenes = prev_version field missing (use empty string at genesis)

trust.diag.productmismatchcommentcommentbodybody = product mismatch: comment={ $comment } body={ $body }

trust.diag.publishedutcmustbeexactlyyyyymmddthhmmsszg = published_utc must be exactly YYYY-MM-DDTHH:MM:SSZ, got { $value }

trust.diag.querystringnotallowedinarawlink = query string not allowed in a raw link

trust.diag.schememustbehttpsgotscheme = scheme must be https, got { $scheme }

trust.diag.seq1mustbegenesisprevsha256allzeroandprev = seq=1 must be genesis: prev_sha256 all-zero and prev_version empty

trust.diag.seqmismatchcommentcommentbodybody = seq mismatch: comment={ $comment } body={ $body }

trust.diag.seqmustbeapositiveintegergotvalue = seq must be a positive integer, got { $value }

trust.diag.sha256mismatchcommentcommentbodybody = sha256 mismatch: comment={ $comment } body={ $body }

trust.diag.signatureverifiedbutnotrustedcommentwasreturn = signature verified but no trusted comment was returned

trust.diag.signedatvaliduntilmustbeexactlyyyyymmddthh = signed_at/valid_until must be exactly YYYY-MM-DDTHH:MM:SSZ

trust.diag.thesignedfreshnesspointercouldnotbefetched = the signed freshness pointer could not be fetched

trust.diag.thesignedfreshnesspointerdidnotverifydetail = the signed freshness pointer did not verify: { $detail }

trust.diag.trustedcommentbindingfaileddetail = trusted-comment binding failed: { $detail }

trust.diag.trustedcommentisnotav1entrycommentcomment = trusted comment is not a v1 entry comment: { $comment }

trust.diag.versionmismatchcommentcommentbodybody = version mismatch: comment={ $comment } body={ $body }

trust.evidence.linkcount = { $count ->
     [one] { $count } exact links below
    *[other] { $count } exact links below
}


trust.home.registerrow = { $state ->
    *[empty] publication paused · no records in this register
     [hasrecord] publication paused · latest recorded release { $version } (signed { $date })
}


trust.home.verifylead = { $lead ->
    *[v1] how to verify a record yourself
     [v2] how to verify what is here yourself
}


trust.keys.linklabel = { $label ->
    *[v1] the public key
     [v2] the signing keys
}


trust.keys.namedasexpectedatbuildtime = named as expected at build time

trust.keys.rootintro = { $key_count ->
     [one] this is sol pbc's v2 signing root, version { $root_version }: one key id, which signs alone. it is renewed yearly, and every prior witness log line stays published when it is.
    *[other] this is sol pbc's v2 signing root, version { $root_version }: { $key_count } key ids, of which { $threshold } must sign. it is renewed yearly, and every prior witness log line stays published when it is.
}


trust.keys.thepinnedrootinthepublicverifierrepository = the pinned root in the public verifier repository

trust.keys.thewitnesslogonsolpbcorg = the witness log on solpbc.org

trust.page.aboutthisregister = about this register

trust.page.aboutthisregistertrustsolstoneapp = about this register — trust.solstone.app

trust.page.acceptedexit0 = { $tok }, exit 0

trust.page.acceptedreleaserecordexit0 = { $tok }, exit 0

trust.page.active = active

trust.page.algorithm = algorithm

trust.page.authorizationpolicy = authorization policy

trust.page.backtothesoftwareregister = back to the software register

trust.page.breadcrumb = breadcrumb

trust.page.buildandverificationreportid = build and verification report, { $id }

trust.page.chainledgerderived = chain ledger (derived)

trust.page.chainposition = chain position

trust.page.confidentialprocessingappliance = confidential processing appliance

trust.page.confidentialprocessingappliancerecord1630bf4pub = confidential processing appliance record, 1630bf4: published

trust.page.confidentialprocessingappliancerecord8e4291dpub = confidential processing appliance record, 8e4291d: published

trust.page.confidentialprocessingappliancerecord9968c21pub = confidential processing appliance record, 9968c21: published

trust.page.confidentialprocessingwhitepaper = confidential processing in solstone: how your journal checks the service before it sends (security whitepaper, PDF)

trust.page.couldnotrunexit2 = could not run, exit 2

trust.page.curlorfetchfails = curl or fetch fails

trust.page.ed25519 = ed25519

trust.page.entrysha256 = entry sha256

trust.page.entrysignature = entry signature

trust.page.expectedrecordmissing = expected record missing

trust.page.fingerprint = fingerprint

trust.page.footer = footer

trust.page.freshnessassertion = freshness assertion

trust.page.fullpublickeytext = full public key text

trust.page.godeeper = go deeper

trust.page.home = home

trust.page.immutableentry = immutable entry

trust.page.issuetime = issue time

trust.page.issuedat = issued at

trust.page.keys = keys

trust.page.keystrustsolstoneapp = keys — trust.solstone.app

trust.page.labelcount = { $label } (×{ $count })

trust.page.latestrecorded = latest recorded

trust.page.latestrecordedrelease = latest recorded release

trust.page.linux = linux

trust.page.mac = mac

trust.page.mainnavigation = main navigation

trust.page.minisignsignatureovertheentry = minisign signature over the entry

trust.page.minisignsignatureoverthepointer = minisign signature over the pointer

trust.page.missingsubject = missing subject

trust.page.mutablelatestpointer = mutable latest pointer

trust.page.namesand = { $items }

trust.page.nativeproofreceipts = native proof receipts

trust.page.noevidenceobjectatname = no evidence object at { $name }

trust.page.nopublishdate = no publish date

trust.page.norecord = no record

trust.page.norecordatthisversion = no record at this version

trust.page.norecordatthisversiontrustsolstoneapp = no record at this version — trust.solstone.app

trust.page.norecordwasconstructedforthisproduct = no record was constructed for this product

trust.page.norecordsinthisregister = no records in this register

trust.page.notarawlink = not a raw link

trust.page.notcheckedbecausethetipentryitselfcouldnotb = not checked because the tip entry itself could not be constructed

trust.page.notfoundtrustsolstoneapp = not found — trust.solstone.app

trust.page.outcome = outcome

trust.page.pinnedroot = pinned root

trust.page.pointersignature = pointer signature

trust.page.policysha256 = policy sha256

trust.page.product = product

trust.page.producttrustsolstoneapp = { $product } — { $tok }

trust.page.productversiontrustsolstoneapp = { $product } { $version } — { $tok }

trust.page.products = products

trust.page.rawevidence = raw evidence

trust.page.rawkeyfile = raw key file

trust.page.rawrootfile = raw root file

trust.page.readingtheresult = reading the result

trust.page.record = record

trust.page.recordproduct = record product

trust.page.recordedbytes = recorded bytes

trust.page.rejectedexit11 = { $tok }, exit 1

trust.page.rejectedexit12 = { $tok }, exit 1

trust.page.releasemanifests = release manifests

trust.page.releaserecord = release record

trust.page.rootfilesha256 = root file sha256

trust.page.rootkeyids = root key ids

trust.page.rootversion = root version

trust.page.seqseqgenesis = { $tok } { $seq } genesis

trust.page.seqseqpreviousversion = { $tok } { $seq } previous { $version }

trust.page.sha256digestlengthbytes = { $length ->
     [one] { $tok } { $digest } · { $length } bytes
    *[other] { $tok } { $digest } · { $length } bytes
}


trust.page.signaturefailstoverify = signature fails to verify

trust.page.signatureverifies = signature verifies

trust.page.signedledgerentry = signed ledger entry

trust.page.signedpointer = signed pointer

trust.page.signedrecorddsseenvelopeinside = signed record (DSSE envelope inside)

trust.page.signerkeyids = signer key ids

trust.page.signingkey = signing key

trust.page.signingkeyset = signing key set

trust.page.signingthreshold = signing threshold

trust.page.skiptocontent = skip to content

trust.page.software = software

trust.page.softwarepublicationregistersummary = software publication register summary

trust.page.softwareregister = software register

trust.page.softwaretrustsolstoneapp = software — trust.solstone.app

trust.page.state = { $state }

trust.page.status = status

trust.page.subject = subject

trust.page.targetpath = target path

trust.page.targetsha256 = target sha256

trust.page.technicalfields = technical fields

trust.page.thecommand = the command

trust.page.thederivedchainledger = the derived chain ledger

trust.page.thejournalsrecords = the journal's records

trust.page.theregisterataglance = the register, at a glance

trust.page.thesoftwareregister = the software register

trust.page.thisisnotastatementaboutanyrecordtherawevi = this is not a statement about any record. the raw evidence remains at transparency.solstone.app.

trust.page.thisportalcannotpresentcollidingrecords = this portal cannot present colliding records

trust.page.thisportalcannotpresentcollidingrecordstrusts = this portal cannot present colliding records — trust.solstone.app

trust.page.thisportalcannotpresenttheregisterrightnow = this portal cannot present the register right now

trust.page.thisrecordcouldnotbeconstructednofieldsfrom = this record could not be constructed. no fields from the failed body are shown.

trust.page.thresholdofkeycount = { $threshold } of { $key_count }

trust.page.timestamprole = timestamp role

trust.page.trustportalhome = trust portal home

trust.page.trustsolstoneapp = trust.solstone.app

trust.page.tworecordsresolvedtothesamerouteleftleftver = two records resolved to the same route { $left } { $left_version } and { $right } { $right_version}. neither is shown.

trust.page.unavailable = unavailable

trust.page.unavailablereason = unavailable { $reason }

trust.page.unavailabletrustsolstoneapp = unavailable — trust.solstone.app

trust.page.v1tiptofirstv2record = v1 tip to first v2 record

trust.page.valid = valid

trust.page.verify = verify

trust.page.verifyarecordyourself = verify a record yourself

trust.page.verifythisrecordyourself = verify this record yourself

trust.page.verifytrustsolstoneapp = verify — trust.solstone.app

trust.page.verifywhatishereyourself = verify what is here yourself

trust.page.versionversion = version { $version }

trust.page.viewproduct = view { $product }

trust.page.wedonthaveapageatthataddress = we don't have a page at that address

trust.page.whatitmeans = what it means

trust.page.whatthisdoesnotprove = what this does not prove

trust.page.whatthisproves = what this proves

trust.page.whycoverageisstatednotimplied = why coverage is stated, not implied

trust.page.windows = windows

trust.product.summaryjournalcount = { $count ->
     [one] this register holds { $count } signed records for solstone's journal release, most recently version { $version }, signed { $date }.
    *[other] this register holds { $count } signed records for solstone's journal release, most recently version { $version }, signed { $date }.
}


trust.software.journalplatforms = the journal's newest record, { $version }, names files for { $platforms }.

trust.verify.accepted = { $tok }

trust.verify.acceptedreleaserecordproductversion = { $tok } { $product } { $version }

trust.verify.advisoriesbody = { $kind ->
     [none] { $sp2 }advisories     none
    *[list] { $sp2 }advisories     { $body }
}


trust.verify.fetchedcountobjects = { $count ->
     [one] { $sp2 }fetched { $count } object(s)
    *[other] { $sp2 }fetched { $count } object(s)
}


trust.verify.fetchedcountobjectsbeforerejecting = { $count ->
     [one] { $sp2 }fetched { $count } object(s) before rejecting
    *[other] { $sp2 }fetched { $count } object(s) before rejecting
}


trust.verify.rejectedlinkreason = { $tok } { $link }/{ $reason }

trust.verify.rejectedreason = { $tok } { $reason }

trust.verify.rolefailedreason = { $sp4 }{ $role } failed ({ $reason })

trust.verify.rolestatevversion = { $sp4 }{ $role } { $state } (v{ $version })

trust.vocab.afiledidnotmatchitssigneddescription = a file did not match its signed description

trust.vocab.afiledidnotparse = a file did not parse

trust.vocab.asignaturedidnotcheckout = a signature did not check out

trust.vocab.av1objectdidnotmatchthemanifest = a v1 object did not match the manifest

trust.vocab.anolderversionwasservedthanonealreadyseen = an older version was served than one already seen

trust.vocab.asserteduntil = asserted until

trust.vocab.couldnotbechecked = could not be checked

trust.vocab.didnotverify = did not verify

trust.vocab.evidencefreshness = evidence freshness

trust.vocab.expired = expired

trust.vocab.fromanyreleasesrawevidencetabledownloadledger = from any release's raw-evidence table, download ledger-entry.json, ledger-entry.json.minisig, and the pinned key file named on /keys/. then run:

trust.vocab.itssigningkeyismarkedcompromisedinthepolicy = its signing key is marked compromised in the policy

trust.vocab.method1av1recordwithminisign = method 1: a v1 record, with minisign

trust.vocab.method2thev2registerwithverifyv2 = method 2: the v2 register, with verify-v2

trust.vocab.method3onev2recordwithverifyrelease = method 3: one v2 record, with verify-release

trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren = { $cmd }{ $filename }{ $cmd2 }

trust.vocab.norecordyet = no record yet

trust.vocab.notattempted = not attempted

trust.vocab.nottimebound = not time-bound

trust.vocab.oneofitssignedvaliditywindowshadpassed = one of its signed validity windows had passed

trust.vocab.partoftheregistercouldnotbefetchedorchecked = part of the register could not be fetched or checked

trust.vocab.paused = paused

trust.vocab.publication = publication

trust.vocab.rebuild = rebuild

trust.vocab.register = ▤ register

trust.vocab.savetherawrootfilelinkedonkeysastufrootjs = save the raw root file linked on /keys/ as tuf-root.json, byte for byte; that saved copy is your pin. before you use it, check it against the witness log: find the sha256 line naming your copy's signed.version and match its digest against the sha256 of your copy's bytes; match the key ids your copy lists for its root role against the nearest key id line above that; then confirm no higher version line appears, because the log keeps every earlier version's line while the pin holds only one. then run:

trust.vocab.signaturedidnotverify = signature did not verify

trust.vocab.signed = ✓ signed

trust.vocab.signingkeys = signing keys

trust.vocab.solpbcsays = ◆ sol pbc says

trust.vocab.solstoneforlinux = solstone for linux

trust.vocab.solstoneformacos = solstone for macos

trust.vocab.solstonefortmux = solstone for tmux

trust.vocab.solstoneforwindows = solstone for windows

trust.vocab.solstonetransparencyverifyreleaseroottufrootj1 = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.solstonetransparencyverifyreleaseroottufrootj2 = { $cmd }{ $product }{ $cmd2 }{ $version }{ $cmd3 }{ $metadata }{ $cmd4 }{ $targets }

trust.vocab.solstonetransparencyverifyv2roottufrootjsonm = { $cmd }{ $metadata }{ $cmd2 }{ $targets }

trust.vocab.thecheckreportedreason = the check reported "{ $reason }"

trust.vocab.thecheckersownsavedstatedidnotreadback = the checker's own saved state did not read back

trust.vocab.thejournal = the journal

trust.vocab.therecorddoesnotnamewhatitwaspublishedas = the record does not name what it was published as

trust.vocab.therootsrolesetupdidnotcheckout = the root's role setup did not check out

trust.vocab.thesigningkeywasnotauthorizedforthisrecord = the signing key was not authorized for this record

trust.vocab.thev1signingkey = the v1 signing key

trust.vocab.thev2signingroot = the v2 signing root

trust.vocab.thewitnessloglinesforthisroot = the witness log lines for this root

trust.vocab.thisisthesignedrecordofproductversionpublish1 = this is the signed record of { $product } { $version }, published { $published_utc }. it is not the last entry in the v1 chain, so it carries no freshness window of its own; only the chain's last entry does. its signature remains exactly as published and is verifiable today.

trust.vocab.thisisthesignedrecordofproductversionpublish2 = this is the signed record of { $product } { $version }, published { $published_utc }. superseded entries like this one are not assigned their own freshness window — only the current tip of the chain carries a separately signed freshness assertion. this entry's own signature remains exactly as published and is independently verifiable today.

trust.vocab.thisisthesignedrecordofproductversionpublish3 = this is the signed record of { $product } { $version }, published { $published_utc }. this is the current tip of the chain, but its separately signed freshness pointer could not be checked ({ $reason }); that is a statement about this check, not about the entry's own signature, which remains exactly as published and independently verifiable today.

trust.vocab.thispageshowsonefactratherthanfourseparatea = this page shows one fact rather than four separate axes: with no records, there is no freshness window, nothing to verify, and nothing to rebuild.

trust.vocab.thisportalisforallofsolstonenotonlythejour = this portal is for all of solstone, not only the journal. products are listed here as sol pbc publishes release records for them, and a listed product with no records says so.

trust.vocab.v1record = v1 record

trust.vocab.v1releasetimelineclosedchain = v1 release timeline (closed chain)

trust.vocab.v2record = v2 record

trust.vocab.v2registernotchecked = v2 register not checked

trust.vocab.v2releaserecords = v2 release records

trust.vocab.verification = verification

trust.vocab.verifier = ⟳ verifier

trust.vocab.whattherecordsaysitproves = what the record says it proves

trust.vocab.whatthev1recordsdonotprove = what the v1 records do not prove

trust.vocab.whatthev1recordsprove = what the v1 records prove

trust.vocab.withthesamepinnedtufrootjsonnametherecordb = with the same pinned tuf-root.json, name the record by its product id and version as they appear in the record's path, software/PRODUCT/VERSION, not by its display name, then run:

trust.verify.detailline = { $sp2 }detail: { $detail }

trust.verify.evaluatedat = { $sp2 }evaluated at   { $when }

trust.verify.fingerprintline = { $sp2 }fingerprint    { $fingerprint }

trust.verify.rolestate = { $sp4 }{ $role } { $state }
