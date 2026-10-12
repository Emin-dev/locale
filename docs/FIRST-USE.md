# First use: missing, outdated, and unverified captures

Open the [Locale demo](https://project-refiy.vercel.app/) with the bundled **Vale / Autumn release**. The sample targets `vale-0.8.4`, declares 12 expected slots, and supplies 9 captures.

These expectations come from the [pinned source](https://github.com/Emin-dev/locale/blob/b58e59571d00c06443733d060aaa057146975216/README.md), fixture and tests, not a new browser run. This guide does not verify which commit the live demo currently serves.

## Try it

1. Choose **All views**, then open **Explore · ar-SA**. No capture is supplied for this expected slot. **Approve capture** should be disabled. Choose **Close review**.
2. Open **Search · ar-SA**. Its declared build is `vale-0.8.3`. Expect **Outdated** and disabled approval. Close the review.
3. Open **Booking · fr-FR**. Its `catalog_hash` is empty. Expect **Unverified** and disabled approval. Close the review.
4. Open **Explore · fr-FR** to inspect a current image. For a practice review, keep **Reviewer name** as “Demo reviewer,” enter “Synthetic exercise: request a closer review of this label.” in **Review note**, then choose **Request changes**. Expect **Changes requested**. This exercises a review decision; it is not a finding that the translation is wrong.
5. Choose **Close review**, then **Export report**.

## Read the report

Expect `audit.complete: false` and `audit.counts.expected: 12`. Coverage gaps remain visible, and the caveat states that the evidence is not a digital signature. Export includes no image bytes.

The captures, text and reviewers are synthetic. Declared build/catalog metadata does not prove what a real application rendered; a reference image is not a certified baseline. This guide does not establish translation, accessibility or visual-quality certification.

Reviews clear on reload. Export cannot resume a session: retain the original manifest and image files separately. Review names and comments before sharing a report.

## Source and verification

- [Exact sample slots](https://github.com/Emin-dev/locale/blob/b58e59571d00c06443733d060aaa057146975216/web/sample-manifest.json)
- [Browser assertions](https://github.com/Emin-dev/locale/blob/b58e59571d00c06443733d060aaa057146975216/scripts/browser-tests.py)
- [UI labels](https://github.com/Emin-dev/locale/blob/b58e59571d00c06443733d060aaa057146975216/web/index.html)
- [Recorded verification and limits](../evidence/QA.md)
