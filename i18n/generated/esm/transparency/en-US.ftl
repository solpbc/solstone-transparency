m74727573742e61626f75742e626f6479 = sol pbc release transparency — { "https://transparency.solstone.app/releases/" }{ "\u000a" }{ "\u000a" }what this surface attests:{ "\u000a" }- what sol pbc released: for each product release, a signed ledger entry{ "\u000a" }  naming the exact artifacts, their sizes, and their SHA-256 digests, plus{ "\u000a" }  the companion release manifests and install/smoke proof receipts.{ "\u000a" }- that it is immutable: release entries and keys live under create-only,{ "\u000a" }  indefinitely retained object paths; nothing under releases/{ "<product>" }/v/{ "\u000a" }  or releases/keys/ is ever overwritten or deleted.{ "\u000a" }- that history is publicly reconstructible: entries are hash-chained,{ "\u000a" }  signed with the key below, and independently witnessed; anyone can{ "\u000a" }  re-derive and verify the full chain from this surface alone.{ "\u000a" }{ "\u000a" }what this surface does NOT claim:{ "\u000a" }- it does not claim the released binaries provably match their source (no{ "\u000a" }  reproducible-build claim). the guarantee is that any later rewrite of{ "\u000a" }  history is detectable, not that the original attestation is infallible.{ "\u000a" }{ "\u000a" }signing key: releases/keys/solpbc-transparency-1.pub (minisign). rotation{ "\u000a" }publishes a successor key cross-signed by its predecessor in the same{ "\u000a" }directory.{ "\u000a" }{ "\u000a" }delivery surfaces (where the attested bytes are actually served):{ "\u000a" }- solstone-journal: { "https://pypi.org/project/solstone-journal/" } (with the{ "\u000a" }  solstone, solstone-core, solstone-journal-cuda, and{ "\u000a" }  solstone-journal-models packages on the same index){ "\u000a" }- solstone-windows: { "https://solstone.app/download/windows" }{ "\u000a" }- solstone-linux: { "https://github.com/solpbc/solstone-linux/releases" }{ "\u000a" }{ "\u000a" }note: "schema" URLs inside ledger entries are version identifiers, not{ "\u000a" }dereferenceable documents.

m74727573742e617869732e6173736572746564756e74696c7768656e = asserted until { $when }

m74727573742e617869732e64657461696c = detail

m74727573742e617869732e6672657368756e74696c7768656e = fresh until { $when }

m74727573742e617869732e686f7774686973776173636865636b6564 = how this was checked

m74727573742e617869732e6974656d = item

m74727573742e617869732e6b6579 = key

m74727573742e617869732e6e6f746573686132353664696765737462797465736c656e677468 = { $i18nCategory ->
    [one] { $note } { "sha256" } { $digest } bytes { NUMBER($length, useGrouping: 0) }
   *[other] { $note } { "sha256" } { $digest } bytes { NUMBER($length, useGrouping: 0) }
}

m74727573742e617869732e726177 = raw

m74727573742e617869732e7369676e6564 = signed

m74727573742e617869732e7369676e65647768656e = signed { $when }

m74727573742e617869732e7374616d70 = expired { $when }

m74727573742e617869732e7665726966696564 = verified

m74727573742e617869732e76657269666965647768656e = verified { $when }

m74727573742e6368726f6d652e6261636b746f = back to { $product }

m74727573742e636c61696d732e646f65736e6f7470726f7665 = { $claim }

m74727573742e636c61696d732e646f657370726f7665 = { $claim }

m74727573742e636f70792e616d616e696665737462696e64696e67746865763172656c656173657265636f726473696e746f74686576 = a manifest binding the v1 release records into the v2 root did not verify when this page was built ({ $reason }); this check stopped there, and it is not a verdict on any v1 record; each record's own check is on its page.

m74727573742e636f70792e617265636f72646f6670726f6475637476657273696f6e77617365787065637465646261736973616e6469 = a record of { $product } { $version } was expected ({ $basis }) and is not in this register. that is a gap in the register, not evidence about the release.

m74727573742e636f70792e617369676e656476616c696469747977696e646f776f6e746869737265676973746572686164706173736564 = a signed validity window on this register had passed by { $date }; records have not been re-checked past that date. that is a statement about how old sol pbc's assertion is, not about any record's signature.

m74727573742e636f70792e6561636870726f6475637462656c6f7773686f7773776865746865726974686173617369676e6564726563 = each product below shows whether it has a signed record in this register, v1 or v2, and each record lists the exact files it covers. apps shipped through app stores (ios, android) have no sol pbc artifact url and no record here; that is a fact about how those builds are delivered, not a statement about them. a product that isn't listed, or a version with no record, isn't evidence that nothing was released. it means this register has no record for it.

m74727573742e636f70792e65766572797265636f72646f6e746869737369746569737369676e6564616e64796f7563616e63686563 = every record on this site is signed, and you can check that signature yourself using the public key we publish alongside it. a valid signature tells you the record hasn't been altered since we signed it; it doesn't tell you anything about whether the software itself is safe or behaves as described.

m74727573742e636f70792e6e65776573747265636f7264656472656c6561736576657273696f6e7369676e656464617465 = newest recorded release { $version } (signed { $date })

m74727573742e636f70792e6e6f6e657075626c6973686564796574 = none published yet

m74727573742e636f70792e7075626c69636174696f6e746f746869737265676973746572697370617573656472696768746e6f776279 = publication to this register is paused right now, by deliberate decision, not because of an incident or an outage. sol pbc is holding new signed records until we ship one coordinated release across every solstone surface, and we'll re-evaluate publication at that point. every record already published here stays published, unchanged, and verifiable exactly as it is.

m74727573742e636f70792e7075626c697368696e677265636f726473 = publishing records

m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f74616e64626f756e64746831 = sol pbc has created its v2 signing root and bound the v1 release records into it. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f74616e64626f756e64746832 = sol pbc has created its v2 signing root and bound the v1 release records of { $products } into it; the rest of the v1 release records are not yet bound. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f7465766572797631726563 = sol pbc has created its v2 signing root. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

m74727573742e636f70792e736f6c7062636861736372656174656469747376327369676e696e67726f6f746e6f72656c6561736572 = sol pbc has created its v2 signing root. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.

m74727573742e636f70792e736f6c7062636861737075626c69736865647369676e65647265636f726473666f72736f6d656f66697473 = sol pbc has published signed records for some of its software, not necessarily all of it.

m74727573742e636f70792e736f6c7062637075626c697368657372656c656173657265636f726473756e64657269747376327369676e69 = sol pbc publishes release records under its v2 signing root. the first is { $product } { $version }. the software page lists which products have records here.

m74727573742e636f70792e736f6c73746f6e65666f726c696e7578616e64736f6c73746f6e65666f7277696e646f777361726573657061 = solstone for linux and solstone for windows are separate from the journal; what this register shows for them is about those apps alone.

m74727573742e636f70792e736f6c73746f6e6569736174726164656d61726b6f66736f6c706263 = solstone is a trademark of sol pbc.

m74727573742e636f70792e746861746f7572726567697374657263757272656e746c796861736e6f7369676e65647265636f7264666f72 = that our register currently has no signed record for a windows release.

m74727573742e636f70792e74686174736f6c7062637369676e6564617265636f72646e616d696e677468657365657861637461727469 = that sol pbc signed a record naming these exact artifacts, their digests, and their release date, and that each entry is correctly linked to the one before it in the chain.

m74727573742e636f70792e74686174736f6c7062637369676e6564617265636f72646e616d696e677468697372656c65617365736578 = that sol pbc signed a record naming this release's exact artifacts, digests, and release date.

m74727573742e636f70792e74686174736f6c706263737369676e696e676b65796174746573746564746865736565786163746172746966 = that sol pbc's signing key attested these exact artifacts, named, sized, and hashed in the record, at the stated time, and that this entry is correctly linked to the one before it in the chain.

m74727573742e636f70792e74686174736f6c73746f6e656861736e657665726265656e72656c6561736564666f7277696e646f7773 = that solstone has never been released for windows.

m74727573742e636f70792e746861747468657365617265616c6c7468656a6f75726e616c76657273696f6e737765766572656c65617365 = that these are all the journal versions we've released, or that the recorded version is the one you're currently running.

m74727573742e636f70792e74686174746865736f75726365636f64657765706f696e74746f70726f6475636564746865736565786163 = that the source code we point to produced these exact bytes (that's a reproducible-build claim we don't make), or that this is the version currently installed or available to download.

m74727573742e636f70792e746861747468697369737468656f6e6c796c696e757872656c65617365776576656d6164656f72746861 = that this is the only linux release we've made, or that it's what you're running now.

m74727573742e636f70792e746865636f6d6d616e6465786974656432626563617573656974636f756c646e7472656164697473696e70 = the command exited 2 because it couldn't read its inputs, most often the pinned root file; the check didn't happen, which is different from a failed check and isn't evidence about the record.

m74727573742e636f70792e746865636f6d6d616e64657869746564326265636175736574686570696e6e6564726f6f74636f756c646e74 = the command exited 2 because the pinned root couldn't be read; the check didn't happen, which is different from a failed check and isn't evidence about the register.

m74727573742e636f70792e746865636f6d6d616e647072696e7465646163636570746564616e6465786974656430746865726567697374 = the command printed { "ACCEPTED" } and exited 0: the register you fetched matches what was signed by the keys your pinned root authorizes, every record's bytes match their signed description, and no signed validity window had passed when you ran it.

m74727573742e636f70792e746865636f6d6d616e647072696e746564616363657074656472656c656173657265636f7264616e6465786974 = the command printed { "accepted release record" } and exited 0: the record verified through your pinned root, its signature checked against an authorized key, and every file it names was fetched and matched its recorded length and { "sha256" }.

m74727573742e636f70792e746865636f6d6d616e647072696e74656472656a65637465647769746861726561736f6e616e64657869746531 = the command printed { "REJECTED" } with a reason and exited 1; read the reason. "{ "expired" }" means one of sol pbc's signed validity windows has passed (a fact about sol pbc's assertion, not about any record's signature). "{ "unavailable" }" or "{ "retrieval-failed" }" means an object couldn't be fetched and the check did not complete. "{ "trust-store-corrupt" }" points at a file on your machine, not at the register; "{ "malformed" }" means a file could not be read or did not parse; the detail line names the field, not always the file, so on a first run check the root file you saved first. any other reason means what { "transparency.solstone.app" } served did not check out.

m74727573742e636f70792e746865636f6d6d616e647072696e74656472656a65637465647769746861726561736f6e616e64657869746532 = the command printed { "rejected:" } with a reason and exited 1; read the reason. { "invalid-coordinate" } means the product id or version you typed isn't a valid name; { "record-missing" } means no record exists under that product id and version, which is a gap in the register, not evidence about a release. a trust-store reason points at a file on your machine. a reason about a fetch means a file couldn't be retrieved and the check did not complete. { "expired" } means what it means in method 2. any other reason, with the command as printed here, means the register, the record, or a file it names did not check out as served to you.

m74727573742e636f70792e746865646973747269627574656466696c65737468656d73656c7665736172656e74686f737465646f6e746869 = the distributed files themselves aren't hosted on this evidence surface. their names and digests are declared in the signed record above. verify them by hashing the file you have and comparing it to the digest here, not by following a link.

m74727573742e636f70792e74686570726f647563747362656c6f776172657468656f6e6573776576657075626c697368656461746c65 = the products below are the ones we've published at least one signed record for. a product that isn't listed, or a gap between two recorded versions of a product that is, isn't evidence that nothing was released. it means our register doesn't have a record for it, which is a fact about our register, not about what we shipped.

m74727573742e636f70792e7468657265617265746872656577617973746f636865636b7768617469736865726576317265636f7264 = there are three ways to check what is here. v1 records are checked with minisign and the v1 key; the v2 register is checked whole with verify-v2 against the pinned v2 root; one v2 record is checked with verify-release, which also opens the record's own signature and fetches the files it names. each record's page says which chain it belongs to.

m74727573742e636f70792e7468657265636f7264666f7276657273696f6e6469646e6f74766572696679726561736f6e736f6e6f7468 = the record for { $version } did not verify ({ $reason }), so nothing it claims is shown here.

m74727573742e636f70792e7468657265636f7264737461746573776861746974646f6573616e64646f65736e6f7470726f7665626f = the record states what it does and does not prove; both lists below are rendered from the signed record, word for word.

m74727573742e636f70792e74686572656769737465726d6f76657366726f6d746865763174697070726576746f7468656669727374 = the register moves from the v1 tip, { $prev }, to the first v2 record, { $next }. versions between the two have no record here; that is a fact about this register, not about what was released.

m74727573742e636f70792e7468657265736e6f7265636f726468657265666f727468617476657273696f6e7468617469736e74657669 = there's no record here for that version. that isn't evidence it wasn't released, only that our register has no signed entry for it.

m74727573742e636f70792e7468657265736e6f7265636f726468657265666f7276657273696f6e746865636861696e72756e7366726f = there's no record here for { $version }; the chain runs from { $prev } to { $next } without it, and a gap in this register is not evidence that { $version } was never released.

m74727573742e636f70792e7468657265736e6f7468696e6761747468697361646472657373686561646261636b746f74686574727573 = there's nothing at this address. head back to the trust portal home, or check the software register for a specific product.

m74727573742e636f70792e74686573656c696e65736172657075626c697368656461746d6f72657468616e6f6e656c6f636174696f6e = these lines are published at more than one location sol pbc controls, listed below; they are a cross-check for a root you have already pinned, not a trust root themselves. in the witness log, each root version adds one sha256 line, and the key id line covers every sha256 line below it, reappearing only when the key set changes.

m74727573742e636f70792e7468657369676e6174757265636865636b736f75747468697365786163747265636f72646d61746368657377 = the signature checks out. this exact record matches what we signed and hasn't been altered.

m74727573742e636f70792e7468657369676e6174757265646f65736e74636865636b6f7574646f6e74747275737474686973636f7079 = the signature doesn't check out. don't trust this copy, and let us know how you got it.

m74727573742e636f70792e7468657631636861696e6f6670726f64756374636c6f736564617476657273696f6e6974697368697374 = the v1 chain of { $product } closed at { $version }. it is history, still signed and still verifiable with the v1 key; nothing in it was re-signed or moved.

m74727573742e636f70792e7468657631636861696e7265636f726465646e6f72656c656173656f66736f6c73746f6e65666f7277696e = the v1 chain recorded no release of solstone for windows and is closed, so it never will record one. any record of solstone for windows will appear under the v2 root and this page will show it.

m74727573742e636f70792e746865763172656c656173657265636f726473636f756e746f626a65637473617265626f756e64696e746f = { $i18nCategory ->
    [one] the v1 release records ({ NUMBER($count, useGrouping: 0) } objects) are bound into the v2 root by signed manifests, and every one of them checked out when this page was built.
   *[other] the v1 release records ({ NUMBER($count, useGrouping: 0) } objects) are bound into the v2 root by signed manifests, and every one of them checked out when this page was built.
}

m74727573742e636f70792e746865763172656c656173657265636f7264736f6670726f6475637473636f756e746f626a65637473617265 = { $i18nCategory ->
    [one] the v1 release records of { $products } ({ NUMBER($count, useGrouping: 0) } objects) are bound into the v2 root by signed manifests that checked out when this page was built; the rest of the v1 release records are not yet bound.
   *[other] the v1 release records of { $products } ({ NUMBER($count, useGrouping: 0) } objects) are bound into the v2 root by signed manifests that checked out when this page was built; the rest of the v1 release records are not yet bound.
}

m74727573742e636f70792e746865763272656769737465726469646e6f747665726966797768656e74686973706167657761736275 = the v2 register did not verify when this page was built ({ $reason }), so nothing from it is shown here. that is a statement about this check, not about any record.

m74727573742e636f70792e7468697366696c656465736372696265737468657631636861696e696e7468657631636861696e736f77 = this file describes the v1 chain, in the v1 chain's own words, and is shown exactly as published.

m74727573742e636f70792e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736831 = this is the signed record of { $product } { $version }, published { $published_utc }. sol pbc signed it as valid through { $valid_until }; that window has since passed, and the v1 chain this record belongs to is closed, so no later v1 record renews it. the record and its signature remain exactly as published and remain verifiable today.

m74727573742e636f70792e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736832 = this is the signed record of { $product } { $version }, published { $published_utc }. sol pbc signed it as valid through { $valid_until }; that window has since passed, which reflects our publication pause, not a problem with the record itself. the record and its signature remain exactly as published and remain verifiable today.

m74727573742e636f70792e746869736973746865763272656c656173657265636f72646f6670726f6475637476657273696f6e736967 = this is the v2 release record of { $product } { $version }, signed { $issued_at }. it names the exact final bytes sol pbc recorded as this release: each file's url, length, and { "sha256" }. the register's freshness is asserted until { $asserted_until }.

m74727573742e636f70792e746869736b6579766572696669657365766572797369676e65647265636f72647075626c6973686564696e74 = this key verifies every signed record published in this register.

m74727573742e636f70792e746869736b657976657269666965737468657631636861696e6f6e6c7969747369676e736e6f7468696e67 = this key verifies the v1 chain only; it signs nothing new.

m74727573742e636f70792e7468697370616765697361626f757470726f64756374746865736f6c73746f6e656170707468656a6f7572 = this page is about { $product }, the solstone app. the journal is a separate product, with its own records.

m74727573742e636f70792e746869737265676973746572616c736f686f6c64737265636f726473666f7270726f64756374737468697370 = this register also holds records for { $products }; this portal has no page for them yet, so it links the raw records instead.

m74727573742e636f70792e7468697372656769737465726861736e6f7369676e65647265636f726473666f726177696e646f77737265 = this register has no signed records for a windows release. that's a fact about what we've published to this register, not a claim about whether solstone runs on windows. zero records here means we haven't recorded one yet, not that none exists to record.

m74727573742e636f70792e746869737265676973746572686f6c647361763272656c656173657265636f72646f6670726f647563747631 = this register holds a v2 release record of { $product } { $version }, signed { $issued_at }.

m74727573742e636f70792e746869737265676973746572686f6c647361763272656c656173657265636f72646f6670726f647563747632 = this register holds a v2 release record of { $product } { $version }, signed { $issued_at }. the v1 history of { $product } stays below, unchanged and still verifiable with the v1 key.

m74727573742e636f70792e746869737265676973746572686f6c6473636f756e747369676e65647265636f7264666f72736f6c73746f6e65 = { $i18nCategory ->
    [one] this register holds { NUMBER($count, useGrouping: 0) } signed record for solstone's linux release, version { $version }, signed { $date }.
   *[other] this register holds { NUMBER($count, useGrouping: 0) } signed record for solstone's linux release, version { $version }, signed { $date }.
}

m74727573742e636f70792e746869737265676973746572686f6c64736e6f7369676e65647265636f726473666f72736f6c73746f6e6573 = this register holds no signed records for solstone's windows release.

m74727573742e636f70792e7472757374736f6c73746f6e6561707069737768657265736f6c7062636578706c61696e73696e706c6169 = trust.solstone.app is where sol pbc explains, in plain language, what we've published about our own software. the actual signed records live at transparency.solstone.app; this site walks through them and links straight back to the originals. if anything here ever disagrees with a record at transparency.solstone.app, that record is the one to believe.

m74727573742e636f70792e7631636861696e636c6f736564617476657273696f6e6e6f76327265636f7264696e7468697372656769 = v1 chain closed at { $version } · no v2 record in this register

m74727573742e636f70792e7631636861696e636c6f736564617476657273696f6e763272656769737465726e6f74636865636b6564 = v1 chain closed at { $version } · v2 register not checked

m74727573742e636f70792e76316f6e6c796e6f6e65777369676e617475726573 = v1 only, no new signatures

m74727573742e636f70792e76327265636f726473617265636f7665726564627976657269667976327768696368636865636b73746865 = v2 records are covered by verify-v2, which checks the whole register against a pinned copy of sol pbc's v2 signing root. a passing check tells you the register you fetched matches what was signed by the keys your pinned root authorizes, that every record's bytes match their signed description, and that none of sol pbc's signed validity windows had passed when you ran it. it does not open a record's own signature; that is method 3 below. it does not tell you the root you pinned is the right one; you compare that yourself against the witness log lines, listed on the keys page. and it speaks only to the register, not to the software the records name.

m74727573742e636f70792e76657269667972656c65617365636865636b736f6e6576327265636f7264697477616c6b7366726f6d796f = verify-release checks one v2 record. it walks from your pinned root to the record through the register, checks the record's own signature against the signing keys the register authorizes, and then fetches every file the record names from its recorded url and compares the bytes it receives against the recorded length and sha256. a passing check tells you those files, as served to you at that moment, are the bytes sol pbc recorded as that release. it does not tell you the software is safe, or that a build you already have is these bytes; compare your own copy's sha256 against the record's yourself.

m74727573742e636f70792e7765636f756c646e74636f6d706c657465746865636865636b757375616c6c79616e6574776f726b6f7261 = we couldn't complete the check, usually a network or availability issue on our end; that's different from a failed check and isn't evidence the record is wrong.

m74727573742e646961672e6172746966616374736d616e69666573747370726f6f66736d757374656163686265617272617973 = artifacts/manifests/proofs must each be arrays

m74727573742e646961672e62726f6b656e636861696e6c696e6b656e7472796465636c61726573707265767368613235366465636c617265 = broken chain link: entry declares prev_sha256={ $declared } but the actual previous entry hashes to { $actual }

m74727573742e646961672e63616e6469646174657761736e6f74616c7265616479696e6e6f726d616c697a6564666f726d7265667573696e = candidate was not already in normalized form — refusing to link a URL that differs from what it will actually resolve to

m74727573742e646961672e636f756c646e6f74666574636874686570696e6e65647075626c69636b6579 = could not fetch the pinned public key

m74727573742e646961672e636f756c646e6f7470617273656d696e697369676e6b6579696466726f6d7468657075626c69636b6579 = could not parse minisign key id from the public-key file

m74727573742e646961672e636f756c646e6f7472756e74686576657269666965726572726f72 = could not run the verifier: { $error }

m74727573742e646961672e63726564656e7469616c736e6f74616c6c6f776564696e617261776c696e6b = credentials not allowed in a raw link

m74727573742e646961672e6465677261646564 = degraded

m74727573742e646961672e656e747279626f647969736e6f7476616c69646a736f6e = entry body is not valid JSON

m74727573742e646961672e656e7472796861736e6f70726f647563746669656c64 = entry has no product field

m74727573742e646961672e656e7472796861736e6f76657273696f6e6669656c64 = entry has no version field

m74727573742e646961672e667261676d656e746e6f74616c6c6f776564696e617261776c696e6b = fragment not allowed in a raw link

m74727573742e646961672e686f73746d75737462656578706563746564676f74686f7374 = host must be { $expected }, got { $host }

m74727573742e646961672e6d696e697369676e766572696669636174696f6e6661696c65646572726f72 = minisign verification failed: { $error }

m74727573742e646961672e6e6f63616e6f6e6963616c6172746966616374726f757465666f7270726f6475637470726f64756374 = no canonical artifact route for product { $product }

m74727573742e646961672e6e6f6e617363696976616c7565617470617468 = non-ASCII value at { $path }

m74727573742e646961672e6e6f6e64656661756c74706f72746e6f74616c6c6f776564 = non-default port not allowed

m74727573742e646961672e6e6f7461706172736561626c6575726c = not a parseable URL

m74727573742e646961672e6f70657261746f726465636973696f6e32303236303831323138 = operator decision, 2026-08-12/18

m74727573742e646961672e6f70657261746f726465636973696f6e323032363038313231387075626c69636174696f6e697364656c6962 = operator decision, 2026-08-12/18: publication is deliberately paused

m74727573742e646961672e70617468636f6e7461696e7361646f75626c6564736570617261746f72 = path contains a doubled separator

m74727573742e646961672e70617468636f6e7461696e73616e656e636f646564736570617261746f726f72646f747365676d656e74616d = path contains an encoded separator or dot-segment ambiguity

m74727573742e646961672e706174686d7573746e616d656f6e6566696c656469726563746c79756e646572707265666978 = path must name one file directly under { $prefix }

m74727573742e646961672e706f696e746572626f647969736e6f7476616c69646a736f6e = pointer body is not valid JSON

m74727573742e646961672e706f696e74657269736d697373696e676172657175697265646669656c64 = pointer is missing a required field

m74727573742e646961672e707265766d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479 = prev mismatch: comment={ $comment } body={ $body }

m74727573742e646961672e707265767368613235366d757374626565786163746c7936346c6f7765726361736568657863686172616374 = prev_sha256 must be exactly 64 lowercase hex characters

m74727573742e646961672e7072657676657273696f6e6669656c646d697373696e67757365656d707479737472696e67617467656e6573 = prev_version field missing (use empty string at genesis)

m74727573742e646961672e70726f647563746d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479 = product mismatch: comment={ $comment } body={ $body }

m74727573742e646961672e7075626c69736865647574636d757374626565786163746c79797979796d6d64647468686d6d73737a67 = published_utc must be exactly YYYY-MM-DDTHH:MM:SSZ, got { $value }

m74727573742e646961672e7175657279737472696e676e6f74616c6c6f776564696e617261776c696e6b = query string not allowed in a raw link

m74727573742e646961672e736368656d656d75737462656874747073676f74736368656d65 = scheme must be https, got { $scheme }

m74727573742e646961672e736571316d757374626567656e6573697370726576736861323536616c6c7a65726f616e6470726576 = seq=1 must be genesis: prev_sha256 all-zero and prev_version empty

m74727573742e646961672e7365716d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479 = seq mismatch: comment={ $comment } body={ $body }

m74727573742e646961672e7365716d757374626561706f736974697665696e7465676572676f7476616c7565 = seq must be a positive integer, got { $value }

m74727573742e646961672e7368613235366d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479 = sha256 mismatch: comment={ $comment } body={ $body }

m74727573742e646961672e7369676e617475726576657269666965646275746e6f74727573746564636f6d6d656e7477617372657475726e = signature verified but no trusted comment was returned

m74727573742e646961672e7369676e6564617476616c6964756e74696c6d757374626565786163746c79797979796d6d6464746868 = signed_at/valid_until must be exactly YYYY-MM-DDTHH:MM:SSZ

m74727573742e646961672e7468657369676e656466726573686e657373706f696e746572636f756c646e6f74626566657463686564 = the signed freshness pointer could not be fetched

m74727573742e646961672e7468657369676e656466726573686e657373706f696e7465726469646e6f7476657269667964657461696c = the signed freshness pointer did not verify: { $detail }

m74727573742e646961672e74727573746564636f6d6d656e7462696e64696e676661696c656464657461696c = trusted-comment binding failed: { $detail }

m74727573742e646961672e74727573746564636f6d6d656e7469736e6f74617631656e747279636f6d6d656e74636f6d6d656e74 = trusted comment is not a v1 entry comment: { $comment }

m74727573742e646961672e76657273696f6e6d69736d61746368636f6d6d656e74636f6d6d656e74626f6479626f6479 = version mismatch: comment={ $comment } body={ $body }

m74727573742e65766964656e63652e6c696e6b636f756e74 = { $i18nCategory ->
    [one] { NUMBER($count, useGrouping: 0) } exact links below
   *[other] { NUMBER($count, useGrouping: 0) } exact links below
}

m74727573742e686f6d652e7265676973746572726f77_v656d707479 = publication paused · no records in this register

m74727573742e686f6d652e7265676973746572726f77_v6861737265636f7264 = publication paused · latest recorded release { $version } (signed { $date })

m74727573742e686f6d652e7665726966796c656164_v7631 = how to verify a record yourself

m74727573742e686f6d652e7665726966796c656164_v7632 = how to verify what is here yourself

m74727573742e6b6579732e6c696e6b6c6162656c_v7631 = the public key

m74727573742e6b6579732e6c696e6b6c6162656c_v7632 = the signing keys

m74727573742e6b6579732e6e616d65646173657870656374656461746275696c6474696d65 = named as expected at build time

m74727573742e6b6579732e726f6f74696e74726f = { $i18nCategory ->
    [one] this is sol pbc's v2 signing root, version { $root_version }: one key id, which signs alone. it is renewed yearly, and every prior witness log line stays published when it is.
   *[other] this is sol pbc's v2 signing root, version { $root_version }: { NUMBER($key_count, useGrouping: 0) } key ids, of which { NUMBER($threshold, useGrouping: 0) } must sign. it is renewed yearly, and every prior witness log line stays published when it is.
}

m74727573742e6b6579732e74686570696e6e6564726f6f74696e7468657075626c696376657269666965727265706f7369746f7279 = the pinned root in the public verifier repository

m74727573742e6b6579732e7468657769746e6573736c6f676f6e736f6c7062636f7267 = the witness log on solpbc.org

m74727573742e706167652e61626f7574746869737265676973746572 = about this register

m74727573742e706167652e61626f75747468697372656769737465727472757374736f6c73746f6e65617070 = about this register — trust.solstone.app

m74727573742e706167652e61636365707465646578697430 = { "ACCEPTED" }, exit 0

m74727573742e706167652e616363657074656472656c656173657265636f72646578697430 = { "accepted release record" }, exit 0

m74727573742e706167652e616374697665 = active

m74727573742e706167652e616c676f726974686d = algorithm

m74727573742e706167652e617574686f72697a6174696f6e706f6c696379 = authorization policy

m74727573742e706167652e6261636b746f746865736f6674776172657265676973746572 = back to the software register

m74727573742e706167652e62726561646372756d62 = breadcrumb

m74727573742e706167652e6275696c64616e64766572696669636174696f6e7265706f72746964 = build and verification report, { $id }

m74727573742e706167652e636861696e6c656467657264657269766564 = chain ledger (derived)

m74727573742e706167652e636861696e706f736974696f6e = chain position

m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e6365 = confidential processing appliance

m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726431363330626634707562 = confidential processing appliance record, 1630bf4: published

m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726438653432393164707562 = confidential processing appliance record, 8e4291d: published

m74727573742e706167652e636f6e666964656e7469616c70726f63657373696e676170706c69616e63657265636f726439393638633231707562 = confidential processing appliance record, 9968c21: published

m74727573742e706167652e636f756c646e6f7472756e6578697432 = could not run, exit 2

m74727573742e706167652e6375726c6f7266657463686661696c73 = curl or fetch fails

m74727573742e706167652e6465677261646564726561736f6e = degraded { $reason }

m74727573742e706167652e65643235353139 = ed25519

m74727573742e706167652e656e747279736861323536 = entry sha256

m74727573742e706167652e656e7472797369676e6174757265 = entry signature

m74727573742e706167652e65787065637465647265636f72646d697373696e67 = expected record missing

m74727573742e706167652e66696e6765727072696e74 = fingerprint

m74727573742e706167652e666f6f746572 = footer

m74727573742e706167652e66726573686e657373617373657274696f6e = freshness assertion

m74727573742e706167652e66756c6c7075626c69636b657974657874 = full public key text

m74727573742e706167652e676f646565706572 = go deeper

m74727573742e706167652e686f6d65 = home

m74727573742e706167652e696d6d757461626c65656e747279 = immutable entry

m74727573742e706167652e6973737565646174 = issued at

m74727573742e706167652e697373756574696d65 = issue time

m74727573742e706167652e6b657973 = keys

m74727573742e706167652e6b6579737472757374736f6c73746f6e65617070 = keys — trust.solstone.app

m74727573742e706167652e6c6162656c636f756e74 = { $label } (×{ NUMBER($count, useGrouping: 0) })

m74727573742e706167652e6c61746573747265636f72646564 = latest recorded

m74727573742e706167652e6c61746573747265636f7264656472656c65617365 = latest recorded release

m74727573742e706167652e6c696e7578 = linux

m74727573742e706167652e6d6163 = mac

m74727573742e706167652e6d61696e6e617669676174696f6e = main navigation

m74727573742e706167652e6d696e697369676e7369676e61747572656f766572746865656e747279 = minisign signature over the entry

m74727573742e706167652e6d696e697369676e7369676e61747572656f766572746865706f696e746572 = minisign signature over the pointer

m74727573742e706167652e6d697373696e677375626a656374 = missing subject

m74727573742e706167652e6d757461626c656c6174657374706f696e746572 = mutable latest pointer

m74727573742e706167652e6e616d6573616e64 = { $items }

m74727573742e706167652e6e617469766570726f6f667265636569707473 = native proof receipts

m74727573742e706167652e6e6f65766964656e63656f626a65637461746e616d65 = no evidence object at { $name }

m74727573742e706167652e6e6f7075626c69736864617465 = no publish date

m74727573742e706167652e6e6f7265636f7264 = no record

m74727573742e706167652e6e6f7265636f726461747468697376657273696f6e = no record at this version

m74727573742e706167652e6e6f7265636f726461747468697376657273696f6e7472757374736f6c73746f6e65617070 = no record at this version — trust.solstone.app

m74727573742e706167652e6e6f7265636f726473696e746869737265676973746572 = no records in this register

m74727573742e706167652e6e6f7265636f7264776173636f6e7374727563746564666f727468697370726f64756374 = no record was constructed for this product

m74727573742e706167652e6e6f74617261776c696e6b = not a raw link

m74727573742e706167652e6e6f74636865636b656462656361757365746865746970656e747279697473656c66636f756c646e6f7462 = not checked because the tip entry itself could not be constructed

m74727573742e706167652e6e6f74666f756e647472757374736f6c73746f6e65617070 = not found — trust.solstone.app

m74727573742e706167652e6f7574636f6d65 = outcome

m74727573742e706167652e70696e6e6564726f6f74 = pinned root

m74727573742e706167652e706f696e7465727369676e6174757265 = pointer signature

m74727573742e706167652e706f6c696379736861323536 = policy sha256

m74727573742e706167652e70726f64756374 = product

m74727573742e706167652e70726f6475637473 = products

m74727573742e706167652e70726f647563747472757374736f6c73746f6e65617070 = { $product } — { "trust.solstone.app" }

m74727573742e706167652e70726f6475637476657273696f6e7472757374736f6c73746f6e65617070 = { $product } { $version } — { "trust.solstone.app" }

m74727573742e706167652e72617765766964656e6365 = raw evidence

m74727573742e706167652e7261776b657966696c65 = raw key file

m74727573742e706167652e726177726f6f7466696c65 = raw root file

m74727573742e706167652e72656164696e67746865726573756c74 = reading the result

m74727573742e706167652e7265636f7264 = record

m74727573742e706167652e7265636f726465646279746573 = recorded bytes

m74727573742e706167652e7265636f726470726f64756374 = record product

m74727573742e706167652e72656a6563746564657869743131 = { "REJECTED" }, exit 1

m74727573742e706167652e72656a6563746564657869743132 = { "rejected:" }, exit 1

m74727573742e706167652e72656c656173656d616e696665737473 = release manifests

m74727573742e706167652e72656c656173657265636f7264 = release record

m74727573742e706167652e726f6f7466696c65736861323536 = root file sha256

m74727573742e706167652e726f6f746b6579696473 = root key ids

m74727573742e706167652e726f6f7476657273696f6e = root version

m74727573742e706167652e73657173657167656e65736973 = { "seq" } { NUMBER($seq, useGrouping: 0) } genesis

m74727573742e706167652e73657173657170726576696f757376657273696f6e = { "seq" } { NUMBER($seq, useGrouping: 0) } previous { $version }

m74727573742e706167652e7368613235366469676573746c656e6774686279746573 = { $i18nCategory ->
    [one] { "sha256" } { $digest } · { NUMBER($length, useGrouping: 0) } bytes
   *[other] { "sha256" } { $digest } · { NUMBER($length, useGrouping: 0) } bytes
}

m74727573742e706167652e7369676e61747572656661696c73746f766572696679 = signature fails to verify

m74727573742e706167652e7369676e61747572657665726966696573 = signature verifies

m74727573742e706167652e7369676e65646c6564676572656e747279 = signed ledger entry

m74727573742e706167652e7369676e6564706f696e746572 = signed pointer

m74727573742e706167652e7369676e65647265636f726464737365656e76656c6f7065696e73696465 = signed record (DSSE envelope inside)

m74727573742e706167652e7369676e65726b6579696473 = signer key ids

m74727573742e706167652e7369676e696e676b6579 = signing key

m74727573742e706167652e7369676e696e676b6579736574 = signing key set

m74727573742e706167652e7369676e696e677468726573686f6c64 = signing threshold

m74727573742e706167652e736b6970746f636f6e74656e74 = skip to content

m74727573742e706167652e736f667477617265 = software

m74727573742e706167652e736f6674776172657075626c69636174696f6e726567697374657273756d6d617279 = software publication register summary

m74727573742e706167652e736f6674776172657265676973746572 = software register

m74727573742e706167652e736f6674776172657472757374736f6c73746f6e65617070 = software — trust.solstone.app

m74727573742e706167652e7374617465 = { $state }

m74727573742e706167652e737461747573 = status

m74727573742e706167652e7375626a656374 = subject

m74727573742e706167652e74617267657470617468 = target path

m74727573742e706167652e746172676574736861323536 = target sha256

m74727573742e706167652e746563686e6963616c6669656c6473 = technical fields

m74727573742e706167652e746865636f6d6d616e64 = the command

m74727573742e706167652e74686564657269766564636861696e6c6564676572 = the derived chain ledger

m74727573742e706167652e7468656a6f75726e616c737265636f726473 = the journal's records

m74727573742e706167652e7468657265676973746572617461676c616e6365 = the register, at a glance

m74727573742e706167652e746865736f6674776172657265676973746572 = the software register

m74727573742e706167652e7468697369736e6f746173746174656d656e7461626f7574616e797265636f7264746865726177657669 = this is not a statement about any record. the raw evidence remains at transparency.solstone.app.

m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74636f6c6c6964696e677265636f726473 = this portal cannot present colliding records

m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74636f6c6c6964696e677265636f726473747275737473 = this portal cannot present colliding records — trust.solstone.app

m74727573742e706167652e74686973706f7274616c63616e6e6f7470726573656e74746865726567697374657272696768746e6f77 = this portal cannot present the register right now

m74727573742e706167652e746869737265636f7264636f756c646e6f746265636f6e73747275637465646e6f6669656c647366726f6d = this record could not be constructed. no fields from the failed body are shown.

m74727573742e706167652e7468726573686f6c646f666b6579636f756e74 = { NUMBER($threshold, useGrouping: 0) } of { NUMBER($key_count, useGrouping: 0) }

m74727573742e706167652e74696d657374616d70726f6c65 = timestamp role

m74727573742e706167652e7472757374706f7274616c686f6d65 = trust portal home

m74727573742e706167652e7472757374736f6c73746f6e65617070 = trust.solstone.app

m74727573742e706167652e74776f7265636f7264737265736f6c766564746f74686573616d65726f7574656c6566746c656674766572 = two records resolved to the same route { $left } { $left_version } and { $right } { $right_version }. neither is shown.

m74727573742e706167652e756e617661696c61626c65 = unavailable

m74727573742e706167652e756e617661696c61626c65726561736f6e = unavailable { $reason }

m74727573742e706167652e756e617661696c61626c657472757374736f6c73746f6e65617070 = unavailable — trust.solstone.app

m74727573742e706167652e7631746970746f666972737476327265636f7264 = v1 tip to first v2 record

m74727573742e706167652e76616c6964 = valid

m74727573742e706167652e766572696679 = verify

m74727573742e706167652e766572696679617265636f7264796f757273656c66 = verify a record yourself

m74727573742e706167652e766572696679746869737265636f7264796f757273656c66 = verify this record yourself

m74727573742e706167652e7665726966797472757374736f6c73746f6e65617070 = verify — trust.solstone.app

m74727573742e706167652e76657269667977686174697368657265796f757273656c66 = verify what is here yourself

m74727573742e706167652e76657273696f6e76657273696f6e = version { $version }

m74727573742e706167652e7669657770726f64756374 = view { $product }

m74727573742e706167652e7765646f6e7468617665617061676561747468617461646472657373 = we don't have a page at that address

m74727573742e706167652e7768617469746d65616e73 = what it means

m74727573742e706167652e7768617474686973646f65736e6f7470726f7665 = what this does not prove

m74727573742e706167652e776861747468697370726f766573 = what this proves

m74727573742e706167652e776879636f76657261676569737374617465646e6f74696d706c696564 = why coverage is stated, not implied

m74727573742e706167652e77696e646f7773 = windows

m74727573742e70726f647563742e73756d6d6172796a6f75726e616c636f756e74 = { $i18nCategory ->
    [one] this register holds { NUMBER($count, useGrouping: 0) } signed records for solstone's journal release, most recently version { $version }, signed { $date }.
   *[other] this register holds { NUMBER($count, useGrouping: 0) } signed records for solstone's journal release, most recently version { $version }, signed { $date }.
}

m74727573742e736f6674776172652e6a6f75726e616c706c6174666f726d73 = the journal's newest record, { $version }, names files for { $platforms }.

m74727573742e7665726966792e6163636570746564 = { "ACCEPTED" }

m74727573742e7665726966792e616363657074656472656c656173657265636f726470726f6475637476657273696f6e = { "accepted release record:" } { $product } { $version }

m74727573742e7665726966792e61647669736f72696573626f6479_v6e6f6e65 = { "  " }advisories     none

m74727573742e7665726966792e61647669736f72696573626f6479_v6c697374 = { "  " }advisories     { $body }

m74727573742e7665726966792e64657461696c6c696e65 = { "  " }detail: { $detail }

m74727573742e7665726966792e6576616c75617465646174 = { "  " }evaluated at   { $when }

m74727573742e7665726966792e66657463686564636f756e746f626a65637473 = { $i18nCategory ->
    [one] { "  " }fetched { NUMBER($count, useGrouping: 0) } object(s)
   *[other] { "  " }fetched { NUMBER($count, useGrouping: 0) } object(s)
}

m74727573742e7665726966792e66657463686564636f756e746f626a656374736265666f726572656a656374696e67 = { $i18nCategory ->
    [one] { "  " }fetched { NUMBER($count, useGrouping: 0) } object(s) before rejecting
   *[other] { "  " }fetched { NUMBER($count, useGrouping: 0) } object(s) before rejecting
}

m74727573742e7665726966792e66696e6765727072696e746c696e65 = { "  " }fingerprint    { $fingerprint }

m74727573742e7665726966792e72656a65637465646c696e6b726561736f6e = { "rejected:" } { $link }/{ $reason }

m74727573742e7665726966792e72656a6563746564726561736f6e = { "REJECTED:" } { $reason }

m74727573742e7665726966792e726f6c656661696c6564726561736f6e = { "    " }{ $role } failed ({ $reason })

m74727573742e7665726966792e726f6c657374617465 = { "    " }{ $role } { $state }

m74727573742e7665726966792e726f6c6573746174657676657273696f6e = { "    " }{ $role } { $state } (v{ $version })

m74727573742e766f6361622e6166696c656469646e6f746d617463686974737369676e65646465736372697074696f6e = a file did not match its signed description

m74727573742e766f6361622e6166696c656469646e6f747061727365 = a file did not parse

m74727573742e766f6361622e616e6f6c64657276657273696f6e7761737365727665647468616e6f6e65616c72656164797365656e = an older version was served than one already seen

m74727573742e766f6361622e617369676e61747572656469646e6f74636865636b6f7574 = a signature did not check out

m74727573742e766f6361622e6173736572746564756e74696c = asserted until

m74727573742e766f6361622e6176316f626a6563746469646e6f746d617463687468656d616e6966657374 = a v1 object did not match the manifest

m74727573742e766f6361622e636f756c646e6f746265636865636b6564 = could not be checked

m74727573742e766f6361622e6469646e6f74766572696679 = did not verify

m74727573742e766f6361622e65766964656e636566726573686e657373 = evidence freshness

m74727573742e766f6361622e65787069726564 = expired

m74727573742e766f6361622e66726f6d616e7972656c656173657372617765766964656e63657461626c65646f776e6c6f61646c6564676572 = from any release's raw-evidence table, download ledger-entry.json, ledger-entry.json.minisig, and the pinned key file named on /keys/. then run:

m74727573742e766f6361622e6974737369676e696e676b657969736d61726b6564636f6d70726f6d69736564696e746865706f6c696379 = its signing key is marked compromised in the policy

m74727573742e766f6361622e6d6574686f64316176317265636f7264776974686d696e697369676e = method 1: a v1 record, with minisign

m74727573742e766f6361622e6d6574686f643274686576327265676973746572776974687665726966797632 = method 2: the v2 register, with verify-v2

m74727573742e766f6361622e6d6574686f64336f6e6576327265636f72647769746876657269667972656c65617365 = method 3: one v2 record, with verify-release

m74727573742e766f6361622e6d696e697369676e766d6c6564676572656e7472796a736f6e7066696c656e616d65786c6564676572656e = { "minisign -Vm ledger-entry.json -p " }{ $filename }{ " -x ledger-entry.json.minisig" }

m74727573742e766f6361622e6e6f7265636f7264796574 = no record yet

m74727573742e766f6361622e6e6f74617474656d70746564 = not attempted

m74727573742e766f6361622e6e6f7474696d65626f756e64 = not time-bound

m74727573742e766f6361622e6f6e656f666974737369676e656476616c696469747977696e646f7773686164706173736564 = one of its signed validity windows had passed

m74727573742e766f6361622e706172746f667468657265676973746572636f756c646e6f746265666574636865646f72636865636b6564 = part of the register could not be fetched or checked

m74727573742e766f6361622e706175736564 = paused

m74727573742e766f6361622e7075626c69636174696f6e = publication

m74727573742e766f6361622e72656275696c64 = rebuild

m74727573742e766f6361622e7265676973746572 = ▤ register

m74727573742e766f6361622e73617665746865726177726f6f7466696c656c696e6b65646f6e6b6579736173747566726f6f746a73 = save the raw root file linked on /keys/ as tuf-root.json, byte for byte; that saved copy is your pin. before you use it, check it against the witness log: find the sha256 line naming your copy's signed.version and match its digest against the sha256 of your copy's bytes; match the key ids your copy lists for its root role against the nearest key id line above that; then confirm no higher version line appears, because the log keeps every earlier version's line while the pin holds only one. then run:

m74727573742e766f6361622e7369676e61747572656469646e6f74766572696679 = signature did not verify

m74727573742e766f6361622e7369676e6564 = ✓ signed

m74727573742e766f6361622e7369676e696e676b657973 = signing keys

m74727573742e766f6361622e736f6c70626373617973 = ◆ sol pbc says

m74727573742e766f6361622e736f6c73746f6e65666f726c696e7578 = solstone for linux

m74727573742e766f6361622e736f6c73746f6e65666f726d61636f73 = solstone for macos

m74727573742e766f6361622e736f6c73746f6e65666f72746d7578 = solstone for tmux

m74727573742e766f6361622e736f6c73746f6e65666f7277696e646f7773 = solstone for windows

m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e637976657269667972656c65617365726f6f74747566726f6f746a31 = { "solstone-transparency verify-release --root tuf-root.json --product PRODUCT --version VERSION --metadata-base " }{ $metadata }{ " --targets-base " }{ $targets }

m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e637976657269667972656c65617365726f6f74747566726f6f746a32 = { "solstone-transparency verify-release --root tuf-root.json --product " }{ $product }{ " --version " }{ $version }{ " --metadata-base " }{ $metadata }{ " --targets-base " }{ $targets }

m74727573742e766f6361622e736f6c73746f6e657472616e73706172656e63797665726966797632726f6f74747566726f6f746a736f6e6d = { "solstone-transparency verify-v2 --root tuf-root.json --metadata-base " }{ $metadata }{ " --targets-base " }{ $targets }

m74727573742e766f6361622e746865636865636b6572736f776e736176656473746174656469646e6f74726561646261636b = the checker's own saved state did not read back

m74727573742e766f6361622e746865636865636b7265706f72746564726561736f6e = the check reported "{ $reason }"

m74727573742e766f6361622e7468656a6f75726e616c = the journal

m74727573742e766f6361622e7468657265636f7264646f65736e6f746e616d657768617469747761737075626c69736865646173 = the record does not name what it was published as

m74727573742e766f6361622e746865726f6f7473726f6c6573657475706469646e6f74636865636b6f7574 = the root's role setup did not check out

m74727573742e766f6361622e7468657369676e696e676b65797761736e6f74617574686f72697a6564666f72746869737265636f7264 = the signing key was not authorized for this record

m74727573742e766f6361622e74686576317369676e696e676b6579 = the v1 signing key

m74727573742e766f6361622e74686576327369676e696e67726f6f74 = the v2 signing root

m74727573742e766f6361622e7468657769746e6573736c6f676c696e6573666f7274686973726f6f74 = the witness log lines for this root

m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736831 = this is the signed record of { $product } { $version }, published { $published_utc }. it is not the last entry in the v1 chain, so it carries no freshness window of its own; only the chain's last entry does. its signature remains exactly as published and is verifiable today.

m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736832 = this is the signed record of { $product } { $version }, published { $published_utc }. superseded entries like this one are not assigned their own freshness window — only the current tip of the chain carries a separately signed freshness assertion. this entry's own signature remains exactly as published and is independently verifiable today.

m74727573742e766f6361622e7468697369737468657369676e65647265636f72646f6670726f6475637476657273696f6e7075626c69736833 = this is the signed record of { $product } { $version }, published { $published_utc }. this is the current tip of the chain, but its separately signed freshness pointer could not be checked ({ $reason }); that is a statement about this check, not about the entry's own signature, which remains exactly as published and independently verifiable today.

m74727573742e766f6361622e746869737061676573686f77736f6e65666163747261746865727468616e666f7572736570617261746561 = this page shows one fact rather than four separate axes: with no records, there is no freshness window, nothing to verify, and nothing to rebuild.

m74727573742e766f6361622e74686973706f7274616c6973666f72616c6c6f66736f6c73746f6e656e6f746f6e6c797468656a6f7572 = this portal is for all of solstone, not only the journal. products are listed here as sol pbc publishes release records for them, and a listed product with no records says so.

m74727573742e766f6361622e76317265636f7264 = v1 record

m74727573742e766f6361622e763172656c6561736574696d656c696e65636c6f736564636861696e = v1 release timeline (closed chain)

m74727573742e766f6361622e76327265636f7264 = v2 record

m74727573742e766f6361622e763272656769737465726e6f74636865636b6564 = v2 register not checked

m74727573742e766f6361622e763272656c656173657265636f726473 = v2 release records

m74727573742e766f6361622e766572696669636174696f6e = verification

m74727573742e766f6361622e7665726966696572 = ⟳ verifier

m74727573742e766f6361622e776861747468657265636f726473617973697470726f766573 = what the record says it proves

m74727573742e766f6361622e7768617474686576317265636f726473646f6e6f7470726f7665 = what the v1 records do not prove

m74727573742e766f6361622e7768617474686576317265636f72647370726f7665 = what the v1 records prove

m74727573742e766f6361622e7769746874686573616d6570696e6e6564747566726f6f746a736f6e6e616d657468657265636f726462 = with the same pinned tuf-root.json, name the record by its product id and version as they appear in the record's path, software/PRODUCT/VERSION, not by its display name, then run:

