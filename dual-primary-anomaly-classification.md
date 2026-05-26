# Dual-Primary Anomaly — Classification Report
**Generated:** 2026-05-22  
**Scope:** 220 approved, non-reversed payments with BOTH a `payment` GL entry AND a `payment_advance` GL entry sharing `source_id = payment.id`  
**Database:** Neon PostgreSQL (ep-cold-salad-amemotpi-pooler)  
**Investigation only — no DB or code changes made**

---

## 1. Root Cause

Every correctly-recorded payment should produce exactly one primary GL entry:

| Scenario | Entry type | Debit | Credit |
|---|---|---|---|
| Payment on account (no invoice) | `payment_advance` | 1130 Undeposited | 2150 Tenant Prepayments |
| Payment against invoice | `payment` | 1130 Undeposited | 1210 AR-Tenants |

All 220 anomalous payments originally produced the correct `payment_advance` entry. Two erroneous batch migration runs later injected a phantom `payment` ("Rent collection") entry for each:

| Batch run | Time | Payments affected |
|---|---|---|
| Run 1 | 2026-04-08 07:45–07:46 UTC | ~110 payments |
| Run 2 | 2026-04-16 15:30–15:32 UTC | ~110 payments |

**Evidence:** `backfill_registry` contains exactly 220 rows where `source_event_id IN (DPA payment IDs)` and `source_type = 'payment'`. For all 220, the `payment_advance` transaction `id` is numerically lower than the `payment` transaction `id`, confirming the advance was created first (the real entry) and the payment entry was the later injection.

The `payment` entries incorrectly credited Account 1210 (AR-Tenants), giving the appearance that each tenant's rent was applied to invoices when it was not. This inflated the Tenant Prepayments (2150) balance because the paired discharge (a `payment_auto_apply` entry debiting 2150) was never generated for most payments.

---

## 2. Classification Key

| Class | Meaning |
|---|---|
| **B1** | PAY_ON_ACCOUNT_IS_REAL; `payment_advance` is the real entry; existing `payment_auto_apply` already fully covers all allocations — phantom `payment` entry only |
| **B2** | PAY_ON_ACCOUNT_IS_REAL; existing `payment_auto_apply` only partially covers allocations — phantom `payment` entry + missing auto_apply gap |
| **B3** | PAY_ON_ACCOUNT_IS_REAL; allocations exist but zero `payment_auto_apply` was ever inserted — phantom `payment` entry + full auto_apply backfill needed |
| **B4** | PAY_ON_ACCOUNT_IS_REAL; no allocations yet — phantom `payment` entry only; auto_apply will be needed when allocations are created |

(Classes A, C, D from the original specification do not apply: all 220 have valid allocations or are unallocated-on-account, and none are genuinely ambiguous.)

---

## 3. Class B1 — Fully Covered (2 payments, 750,000 UGX)

The phantom `payment` entry is the only defect. All allocations are already discharged by existing `payment_auto_apply` entries.

### Payment 60 — Otim Martin
- **Date:** 2026-03-25 | **Amount:** 500,000 UGX
- **GL entries tied to this payment:**
  - `payment_advance` (source_id=60, source_type='payment_advance') — REAL ENTRY, keep
  - `payment` tx_id=**498** (source_id=60, source_type='payment') — PHANTOM, soft-delete
  - `payment_auto_apply` (500,000) — correct, covers 1 allocation of 500,000
- **Classification:** B1
- **Reasoning:** Allocated 500,000 = auto_apply 500,000. No gap. Phantom payment entry is the only error.
- **Proposed action:** Soft-delete tx_id=498.

### Payment 232 — Ruth Legombasia Matisho
- **Date:** 2026-03-09 | **Amount:** 250,000 UGX
- **GL entries tied to this payment:**
  - `payment_advance` (source_id=232) — REAL ENTRY, keep
  - `payment` tx_id=**467** (source_id=232) — PHANTOM, soft-delete
  - `payment_auto_apply` (250,000) — correct, covers 1 allocation of 250,000
- **Classification:** B1
- **Reasoning:** Allocated 250,000 = auto_apply 250,000. No gap. Phantom payment entry is the only error.
- **Proposed action:** Soft-delete tx_id=467.

---

## 4. Class B2 — Partial Auto-Apply (10 payments, 8,100,000 UGX; 3,550,000 UGX gap)

The phantom `payment` entry is present AND `payment_auto_apply` entries cover only part of the allocated amount. Both actions are required: delete the phantom entry AND insert the missing auto_apply entries.

### Payment 61 — Mukwasi Steven
- **Date:** 2026-03-24 | **Amount:** 500,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**496** (phantom, delete) | `payment_auto_apply` 250,000 (partial)
- **Allocations:** 500,000 allocated | Auto-apply applied: 250,000 | **Gap: 250,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=496; insert `payment_auto_apply` for 250,000 (Dr 2150 / Cr 1210).

### Payment 65 — Solomon Musiimenta
- **Date:** 2026-03-26 | **Amount:** 300,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**502** (phantom, delete) | `payment_auto_apply` 150,000 (partial)
- **Allocations:** 300,000 allocated | Auto-apply applied: 150,000 | **Gap: 150,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=502; insert `payment_auto_apply` for 150,000.

### Payment 70 — Godfrey Bongole
- **Date:** 2026-03-08 | **Amount:** 3,000,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**464** (phantom, delete) | `payment_auto_apply` 750,000 (partial)
- **Allocations:** 2,250,000 allocated across 3 invoices | Auto-apply applied: 750,000 | **Gap: 1,500,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=464; insert `payment_auto_apply` entries totalling 1,500,000.

### Payment 126 — Ayesigwa Vonnie
- **Date:** 2026-03-27 | **Amount:** 1,000,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**513** (phantom, delete) | `payment_auto_apply` 500,000 (partial)
- **Allocations:** 1,000,000 allocated | Auto-apply applied: 500,000 | **Gap: 500,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=513; insert `payment_auto_apply` for 500,000.

### Payment 166 — Jonathan Owili
- **Date:** 2026-04-05 | **Amount:** 450,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**565** (phantom, delete) | `payment_auto_apply` 150,000 (partial)
- **Allocations:** 300,000 allocated | Auto-apply applied: 150,000 | **Gap: 150,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=565; insert `payment_auto_apply` for 150,000.

### Payment 266 — Ssentamu Islamic School (2nd payment)
- **Date:** 2026-04-01 | **Amount:** 450,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**714** (phantom, delete) | `payment_auto_apply` 150,000 (partial)
- **Allocations:** 300,000 allocated | Auto-apply applied: 150,000 | **Gap: 150,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=714; insert `payment_auto_apply` for 150,000.

### Payment 267 — Ssentamu Islamic School (3rd payment)
- **Date:** 2026-04-01 | **Amount:** 450,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**715** (phantom, delete) | `payment_auto_apply` 150,000 (partial)
- **Allocations:** 300,000 allocated | Auto-apply applied: 150,000 | **Gap: 150,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=715; insert `payment_auto_apply` for 150,000.

### Payment 283 — Rukundo M.
- **Date:** 2026-04-07 | **Amount:** 900,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**727** (phantom, delete) | `payment_auto_apply` 300,000 (partial)
- **Allocations:** 600,000 allocated | Auto-apply applied: 300,000 | **Gap: 300,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=727; insert `payment_auto_apply` for 300,000.

### Payment 285 — Winnie Lwadde Esther
- **Date:** 2026-04-07 | **Amount:** 750,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**729** (phantom, delete) | `payment_auto_apply` 250,000 (partial)
- **Allocations:** 500,000 allocated | Auto-apply applied: 250,000 | **Gap: 250,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=729; insert `payment_auto_apply` for 250,000.

### Payment 313 — Ocen Morish
- **Date:** 2026-04-12 | **Amount:** 300,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**767** (phantom, delete) | `payment_auto_apply` 150,000 (partial)
- **Allocations:** 300,000 allocated | Auto-apply applied: 150,000 | **Gap: 150,000**
- **Classification:** B2
- **Proposed action:** Soft-delete tx_id=767; insert `payment_auto_apply` for 150,000.

---

## 5. Class B3 — No Auto-Apply (206 payments, 58,141,000 UGX)

All allocations exist but zero `payment_auto_apply` entries were ever created. Both actions required: delete the phantom `payment` entry AND insert full `payment_auto_apply` backfill for all allocations.

**Flags:**
- ⚠ void-invoice — allocation points to a voided invoice (verify handling before inserting auto_apply)
- ○ open-invoice — invoice is still open/partially unpaid (auto_apply should clear the balance)

| pay_id | date | tenant | amount | allocs | to_apply | del_tx | flag |
|---|---|---|---|---|---|---|---|
| 13 | 2026-03-07 | Ssemilembe Phillip | 700,000 | 1 | 700,000 | 463 | |
| 19 | 2026-03-06 | Kironde Rashid Deo | 300,000 | 1 | 300,000 | 461 | |
| 20 | 2026-03-23 | Timothy Isingoma | 500,000 | 1 | 500,000 | 488 | |
| 21 | 2026-03-23 | Nansamba Nuliat | 200,000 | 1 | 200,000 | 489 | ⚠ void-invoice |
| 22 | 2026-03-21 | Brian Mukasa | 350,000 | 1 | 350,000 | 487 | |
| 23 | 2026-03-16 | Ssenkuma Matia | 100,000 | 1 | 100,000 | 475 | |
| 24 | 2026-03-16 | Mugenyi Harriet | 350,000 | 1 | 350,000 | 476 | |
| 25 | 2026-03-16 | Talent Keitesi | 250,000 | 1 | 250,000 | 477 | |
| 27 | 2026-03-23 | Jane Nakityo | 200,000 | 1 | 200,000 | 490 | |
| 29 | 2026-03-19 | Ainamatsiko Ahereza Ann | 190,000 | 1 | 190,000 | 480 | |
| 31 | 2026-03-24 | Liz | 250,000 | 1 | 250,000 | 493 | |
| 37 | 2026-03-05 | Nabwami Gertrude | 700,000 | 1 | 700,000 | 453 | |
| 38 | 2026-03-05 | Mugerwa Allan | 1,000,000 | 1 | 1,000,000 | 454 | |
| 43 | 2026-03-24 | Cosma Sanvura | 500,000 | 1 | 500,000 | 494 | |
| 44 | 2026-03-12 | Baraza Village Design | 2,400,000 | 2 | 2,400,000 | 470 | |
| 45 | 2026-03-19 | Janet Mirembe | 200,000 | 1 | 200,000 | 481 | ○ open-invoice |
| 46 | 2026-03-12 | Samuel Sekajja | 350,000 | 1 | 350,000 | 471 | |
| 47 | 2026-03-17 | Haruna Manaf | 350,000 | 1 | 350,000 | 479 | |
| 48 | 2026-03-24 | Ssekiranda Charles | 900,000 | 1 | 900,000 | 495 | |
| 52 | 2026-03-05 | Victoria Nabunnya | 50,000 | 1 | 50,000 | 455 | |
| 63 | 2026-03-26 | Lucky Mwesigye | 300,000 | 1 | 300,000 | 500 | |
| 64 | 2026-03-26 | Louis Ogwang | 300,000 | 1 | 300,000 | 501 | |
| 66 | 2026-03-26 | Lubega Idii | 300,000 | 1 | 300,000 | 503 | |
| 67 | 2026-03-26 | Hussein Rasta | 150,000 | 1 | 150,000 | 504 | |
| 69 | 2026-03-25 | Muwanguzi & Kenyanji | 750,000 | 1 | 750,000 | 499 | |
| 71 | 2026-03-26 | Kagande Richard Fiona | 100,000 | 1 | 100,000 | 505 | |
| 72 | 2026-03-27 | Sekago Hakumed | 100,000 | 1 | 100,000 | 508 | |
| 76 | 2026-03-30 | Daphine Namara | 200,000 | 1 | 200,000 | 518 | |
| 77 | 2026-03-27 | Mukasa John | 400,000 | 1 | 400,000 | 510 | ○ open-invoice |
| 78 | 2026-03-26 | Tugume Joseph | 550,000 | 3 | 550,000 | 506 | ○ open-invoice |
| 79 | 2026-03-27 | Proscovia Ingariat | 500,000 | 2 | 500,000 | 511 | |
| 80 | 2026-03-28 | Vincent Matembe | 500,000 | 1 | 500,000 | 514 | |
| 81 | 2026-03-27 | Isaac Lutwama | 200,000 | 1 | 200,000 | 512 | |
| 82 | 2026-03-30 | Ssemuya Richard | 100,000 | 1 | 100,000 | 519 | |
| 83 | 2026-03-13 | Ronald Arineitwe | 250,000 | 1 | 250,000 | 472 | |
| 84 | 2026-03-08 | Echaye Wilson | 150,000 | 1 | 150,000 | 465 | |
| 85 | 2026-03-06 | Julius | 100,000 | 1 | 100,000 | 462 | |
| 86 | 2026-03-24 | Kezaala Hababu | 150,000 | 1 | 150,000 | 497 | |
| 87 | 2026-03-15 | Vanessa Hatega | 200,000 | 1 | 200,000 | 474 | |
| 88 | 2026-03-10 | Joan Mama Lara | 100,000 | 1 | 100,000 | 468 | |
| 89 | 2026-02-28 | Andrew Kaketo | 150,000 | 2 | 150,000 | 445 | |
| 90 | 2026-02-14 | Milo Isma | 120,000 | 2 | 120,000 | 444 | |
| 91 | 2026-03-13 | Carlos Irene Kyakuwadde | 250,000 | 1 | 250,000 | 473 | |
| 92 | 2026-03-04 | Kalagala Phionah Mirembe | 150,000 | 1 | 150,000 | 452 | |
| 93 | 2026-03-05 | Bato Nicholas | 150,000 | 1 | 150,000 | 456 | |
| 94 | 2026-03-05 | Suliaman Kiryowa | 150,000 | 1 | 150,000 | 457 | |
| 95 | 2026-03-02 | Sekago Hakumed | 150,000 | 2 | 150,000 | 447 | |
| 97 | 2026-03-02 | Ivan Brown | 150,000 | 1 | 150,000 | 448 | |
| 98 | 2026-03-02 | Florence Babirye | 150,000 | 1 | 150,000 | 449 | |
| 99 | 2026-03-05 | Kugonza Mose | 150,000 | 1 | 150,000 | 458 | |
| 100 | 2026-03-05 | Kiberu | 150,000 | 1 | 150,000 | 459 | |
| 101 | 2026-03-05 | Jackline Twinamasiko | 150,000 | 1 | 150,000 | 460 | |
| 102 | 2026-03-23 | Jane Namatovu | 100,000 | 2 | 100,000 | 491 | |
| 103 | 2026-03-28 | Namata Joan | 200,000 | 1 | 200,000 | 515 | |
| 104 | 2026-03-19 | Muhindo Robert | 200,000 | 1 | 200,000 | 482 | |
| 105 | 2026-03-26 | Arinda Shira | 150,000 | 1 | 150,000 | 507 | |
| 109 | 2026-03-31 | Iduma Samuel | 100,000 | 1 | 100,000 | 521 | |
| 112 | 2026-03-03 | Kasujja Muhamad Mustapha | 260,000 | 1 | 260,000 | 451 | |
| 113 | 2026-03-20 | Mayanja Farid | 100,000 | 1 | 100,000 | 484 | |
| 114 | 2026-03-20 | Ssenkuma Matia | 150,000 | 1 | 150,000 | 485 | |
| 116 | 2026-03-31 | Iduma Samuel | 50,000 | 1 | 50,000 | 522 | |
| 117 | 2026-03-20 | Ayub Wambi | 100,000 | 1 | 100,000 | 486 | |
| 118 | 2026-03-02 | Sewanyana | 200,000 | 2 | 200,000 | 450 | |
| 119 | 2026-04-01 | Ivan Brown | 150,000 | 1 | 150,000 | 530 | |
| 120 | 2026-03-31 | Silas Chongeywo Zait | 400,000 | 1 | 400,000 | 523 | |
| 122 | 2026-04-01 | Timothy Isingoma | 500,000 | 1 | 500,000 | 531 | |
| 123 | 2026-03-31 | Nassasira Esther | 200,000 | 1 | 200,000 | 525 | |
| 124 | 2026-04-03 | Leticia | 300,000 | 1 | 300,000 | 526 | |
| 125 | 2026-03-31 | Madlen Ayikoru | 100,000 | 1 | 100,000 | 527 | |
| 127 | 2026-03-31 | Muhammad Shaban | 400,000 | 1 | 400,000 | 528 | ⚠ void-invoice |
| 128 | 2026-03-31 | Muhammad Shaban | 200,000 | 1 | 200,000 | 529 | ⚠ void-invoice |
| 129 | 2026-04-01 | Muhammad Shaban | 100,000 | 1 | 100,000 | 532 | ⚠ void-invoice |
| 130 | 2026-04-02 | Katoogo Jovan | 500,000 | 1 | 500,000 | 533 | |
| 131 | 2026-03-19 | Milly Nabirye | 500,000 | 1 | 500,000 | 483 | |
| 132 | 2026-04-02 | Jane Nakityo | 50,000 | 1 | 50,000 | 534 | |
| 133 | 2026-04-02 | Aggrey Mulaavu | 350,000 | 1 | 350,000 | 535 | |
| 134 | 2026-04-02 | Madlen Ayikoru | 150,000 | 1 | 150,000 | 536 | |
| 136 | 2026-04-02 | Kansiime Flavia | 100,000 | 1 | 100,000 | 537 | |
| 137 | 2026-04-02 | Natukunda Maureen | 100,000 | 1 | 100,000 | 538 | |
| 138 | 2026-04-02 | Derick Amumpe | 740,000 | 2 | 740,000 | 539 | |
| 140 | 2026-04-02 | Iduma Samuel | 100,000 | 1 | 100,000 | 540 | |
| 141 | 2026-04-02 | Hajjat Nassazi | 200,000 | 1 | 200,000 | 541 | |
| 142 | 2026-04-02 | Hasuman Lubega | 100,000 | 1 | 100,000 | 542 | |
| 143 | 2026-03-10 | Jemimah Apio | 250,000 | 2 | 250,000 | 469 | |
| 144 | 2026-03-28 | Mutungi Collins | 750,000 | 1 | 750,000 | 516 | |
| 145 | 2026-03-23 | Nabasa Perezi | 800,000 | 1 | 800,000 | 492 | |
| 146 | 2026-04-02 | Brian Tebandeke | 200,000 | 1 | 200,000 | 543 | |
| 147 | 2026-04-03 | Isaac Nsereko | 350,000 | 1 | 350,000 | 544 | |
| 148 | 2026-04-03 | Nassasira Esther | 200,000 | 1 | 200,000 | 545 | |
| 149 | 2026-04-03 | Kyomugisha Bashirah | 200,000 | 1 | 200,000 | 546 | |
| 153 | 2026-04-04 | Iduma Samuel | 150,000 | 1 | 150,000 | 548 | |
| 154 | 2026-04-04 | Mukasa John | 120,000 | 1 | 120,000 | 549 | ○ open-invoice |
| 156 | 2026-04-04 | Ssekamatte Wilberforce | 200,000 | 1 | 200,000 | 550 | |
| 157 | 2026-04-04 | Christpher Basengezi | 400,000 | 1 | 400,000 | 551 | |
| 158 | 2026-04-04 | Birungi Fatumah Kasawuli | 120,000 | 1 | 120,000 | 552 | |
| 159 | 2026-04-04 | Josephine Nassazi Katende | 120,000 | 1 | 120,000 | 553 | |
| 160 | 2026-04-05 | Deborah Nanteza | 300,000 | 1 | 300,000 | 559 | |
| 161 | 2026-04-05 | Talent Keitesi | 250,000 | 1 | 250,000 | 560 | |
| 162 | 2026-04-05 | Pamella Ayinkamiye | 200,000 | 1 | 200,000 | 561 | |
| 163 | 2026-04-05 | Sserwadda Ramathan | 100,000 | 1 | 100,000 | 562 | |
| 164 | 2026-04-05 | Sophia Kemigisha Phirose | 200,000 | 1 | 200,000 | 563 | |
| 167 | 2026-04-05 | Arinda Sandra | 326,000 | 1 | 326,000 | 566 | |
| 171 | 2026-04-07 | Nabwami Gertrude | 700,000 | 1 | 700,000 | 595 | |
| 172 | 2026-04-04 | Ssempala Muhamud | 200,000 | 1 | 200,000 | 554 | |
| 173 | 2026-04-05 | Sekago Hakumed | 50,000 | 1 | 50,000 | 567 | |
| 175 | 2026-04-06 | Kyomugisha Gloria | 250,000 | 1 | 250,000 | 569 | |
| 176 | 2026-04-06 | Nantambi Olivia | 300,000 | 1 | 300,000 | 570 | |
| 177 | 2026-04-06 | Loyce Evert Tumukunde | 100,000 | 1 | 100,000 | 571 | |
| 178 | 2026-04-05 | Anabella Nakibuuka | 100,000 | 1 | 100,000 | 568 | |
| 179 | 2026-04-06 | Hasuman Lubega | 200,000 | 1 | 200,000 | 572 | |
| 183 | 2026-04-06 | Bato Nicholas | 150,000 | 1 | 150,000 | 573 | |
| 184 | 2026-04-06 | Lutaya Alkam | 200,000 | 1 | 200,000 | 574 | |
| 185 | 2026-04-06 | Nagginda Dear Najuma | 250,000 | 1 | 250,000 | 575 | |
| 186 | 2026-04-06 | Vanessa Hatega | 200,000 | 1 | 200,000 | 576 | |
| 187 | 2026-04-06 | Kasujja Muhamad Mustapha | 240,000 | 1 | 240,000 | 577 | |
| 188 | 2026-04-06 | Kasujja Muhamad Mustapha | 20,000 | 1 | 20,000 | 578 | |
| 189 | 2026-04-06 | David Mujasi | 250,000 | 1 | 250,000 | 579 | |
| 190 | 2026-04-04 | Prossy Nakazzi Luwaga | 200,000 | 1 | 200,000 | 555 | |
| 195 | 2026-04-06 | Aisha Sharif Fatuma Nasanga | 200,000 | 1 | 200,000 | 580 | |
| 196 | 2026-04-06 | Arinda Vastine David | 100,000 | 1 | 100,000 | 581 | |
| 197 | 2026-04-06 | Julius | 100,000 | 1 | 100,000 | 582 | |
| 198 | 2026-04-07 | Mariam Nanyanzi | 600,000 | 1 | 600,000 | 596 | |
| 199 | 2026-04-06 | Ukombozi Pearl Bank | 200,000 | 1 | 200,000 | 583 | |
| 200 | 2026-04-07 | Rachel Nasejje | 200,000 | 1 | 200,000 | 597 | |
| 201 | 2026-03-29 | Kalagala Phionah Mirembe | 50,000 | 1 | 50,000 | 517 | |
| 203 | 2026-04-06 | Nuwamanya Apollo | 800,000 | 1 | 800,000 | 584 | |
| 204 | 2026-04-06 | Nuwamanya Apollo | 800,000 | 1 | 800,000 | 585 | |
| 205 | 2026-04-06 | Vincent Mugume Mwesigye | 800,000 | 1 | 800,000 | 586 | |
| 206 | 2026-04-06 | Kamukama David | 200,000 | 1 | 200,000 | 587 | |
| 207 | 2026-04-06 | Kintu Henry | 250,000 | 1 | 250,000 | 588 | |
| 208 | 2026-04-06 | Kintu Henry | 250,000 | 1 | 250,000 | 589 | |
| 209 | 2026-04-06 | Lamula Namatovu | 300,000 | 1 | 300,000 | 590 | |
| 210 | 2026-04-06 | Kugonza Mose | 150,000 | 1 | 150,000 | 591 | |
| 211 | 2026-04-06 | Kyalimpa Jovita Asuman | 150,000 | 1 | 150,000 | 592 | |
| 212 | 2026-04-04 | Kalagala Phionah Mirembe | 100,000 | 1 | 100,000 | 558 | |
| 215 | 2026-04-07 | Namiiro Prossy | 300,000 | 1 | 300,000 | 598 | |
| 216 | 2026-04-07 | Isaac Ssenyonga | 130,000 | 1 | 130,000 | 599 | |
| 217 | 2026-04-07 | Bridget Nahwera Muhangi | 800,000 | 1 | 800,000 | 600 | |
| 222 | 2026-04-07 | Kagande Richard Fiona | 85,000 | 1 | 85,000 | 603 | |
| 224 | 2026-04-07 | Ssemilembe Phillip | 700,000 | 1 | 700,000 | 605 | |
| 225 | 2026-04-07 | Florence Babirye | 150,000 | 1 | 150,000 | 606 | |
| 226 | 2026-04-07 | Betwara Charles | 400,000 | 1 | 400,000 | 607 | |
| 227 | 2026-04-07 | Byaruhanga Gloria Vicky | 250,000 | 1 | 250,000 | 608 | |
| 228 | 2026-04-07 | Vanessa Aganze Kavira | 270,000 | 1 | 270,000 | 609 | |
| 229 | 2026-04-07 | Kiberu | 150,000 | 1 | 150,000 | 610 | |
| 230 | 2026-04-07 | Bryan Asiimwe | 200,000 | 1 | 200,000 | 611 | |
| 231 | 2026-04-07 | Semujju Remegio | 300,000 | 1 | 300,000 | 612 | |
| 234 | 2026-04-07 | Hajarah Nakato | 300,000 | 1 | 300,000 | 718 | |
| 235 | 2026-04-07 | Shadia Richard Kabuye | 300,000 | 1 | 300,000 | 719 | |
| 236 | 2026-04-07 | Praise Rachel Nuwamanya | 250,000 | 1 | 250,000 | 720 | |
| 237 | 2026-04-07 | Kemigisa | 200,000 | 1 | 200,000 | 721 | |
| 238 | 2026-04-07 | Vincent | 200,000 | 1 | 200,000 | 722 | |
| 239 | 2026-04-07 | Mugerwa Allan | 1,000,000 | 2 | 1,000,000 | 723 | ⚠ void-invoice |
| 240 | 2026-04-07 | Alowo Florence | 230,000 | 1 | 230,000 | 724 | |
| 262 | 2026-04-08 | Abdul Hakim Nsubuga | 1,000,000 | 1 | 1,000,000 | 731 | |
| 263 | 2026-04-08 | Kansiime Flavia | 100,000 | 1 | 100,000 | 732 | |
| 264 | 2026-04-08 | Cypher Phone Clinic | 200,000 | 1 | 200,000 | 733 | |
| 268 | 2026-04-08 | Mwesigye Ignitius | 300,000 | 1 | 300,000 | 734 | |
| 269 | 2026-04-08 | Betwara Charles | 400,000 | 1 | 400,000 | 735 | |
| 271 | 2026-04-08 | Noume Kyoshabire | 250,000 | 1 | 250,000 | 736 | |
| 272 | 2026-04-08 | Arafat Sebaka | 120,000 | 1 | 120,000 | 737 | |
| 273 | 2026-04-08 | Ndyabashaija Enoch Boaz | 400,000 | 1 | 400,000 | 738 | |
| 274 | 2026-04-08 | Daphine Namara | 400,000 | 2 | 400,000 | 739 | |
| 275 | 2026-04-08 | Samuel Sekajja | 350,000 | 1 | 350,000 | 740 | |
| 276 | 2026-04-09 | Suliaman Kiryowa | 150,000 | 1 | 150,000 | 744 | |
| 277 | 2026-04-09 | Iduma Samuel | 100,000 | 1 | 100,000 | 745 | |
| 278 | 2026-04-09 | Ssenkuma Matia | 100,000 | 1 | 100,000 | 746 | |
| 279 | 2026-04-09 | Batuba David Mwira | 270,000 | 1 | 270,000 | 747 | |
| 280 | 2026-04-08 | Nkayirivu Shira | 150,000 | 1 | 150,000 | 741 | |
| 281 | 2026-04-01 | Madia Promise | 150,000 | 1 | 150,000 | 716 | ○ open-invoice |
| 284 | 2026-04-07 | Ramathan Seleman | 250,000 | 1 | 250,000 | 728 | |
| 287 | 2026-04-09 | Jemimah Apio | 300,000 | 2 | 300,000 | 748 | |
| 288 | 2026-04-09 | Kigonya Fred | 400,000 | 1 | 400,000 | 749 | |
| 289 | 2026-04-09 | Bwaise Sacco | 250,000 | 1 | 250,000 | 750 | |
| 290 | 2026-04-09 | Suzan Kyalimpa | 150,000 | 1 | 150,000 | 751 | |
| 291 | 2026-04-09 | Mwinja Francoise | 400,000 | 1 | 400,000 | 752 | |
| 292 | 2026-04-09 | Belami | 300,000 | 1 | 300,000 | 753 | |
| 293 | 2026-04-10 | Tushemereirwe Joselyn | 700,000 | 1 | 700,000 | 756 | |
| 295 | 2026-04-10 | Tumi Isaac Nakimbu-A14 | 150,000 | 1 | 150,000 | 758 | |
| 296 | 2026-04-10 | Kensinze | 250,000 | 1 | 250,000 | 759 | |
| 297 | 2026-04-12 | Tr. Sam Ssenyange Kyambade | 250,000 | 1 | 250,000 | 765 | |
| 310 | 2026-04-08 | Muwanguzi Latib | 150,000 | 1 | 150,000 | 742 | |
| 311 | 2026-04-10 | Janet Mbambu | 200,000 | 1 | 200,000 | 760 | |
| 312 | 2026-04-08 | Jackline Twinamasiko | 150,000 | 1 | 150,000 | 743 | |
| 314 | 2026-04-09 | Byuma Sulaiman | 200,000 | 2 | 200,000 | 754 | |
| 315 | 2026-04-09 | Brenda Massy (Brooms) | 400,000 | 1 | 400,000 | 755 | |
| 317 | 2026-04-11 | Nakamanya Costa | 250,000 | 1 | 250,000 | 764 | |
| 318 | 2026-04-14 | Christine Nabatanzi | 100,000 | 1 | 100,000 | 770 | |
| 320 | 2026-04-14 | Joan Mama Lara | 100,000 | 1 | 100,000 | 771 | |
| 322 | 2026-04-14 | Abdul Wassajja-Ware | 400,000 | 1 | 400,000 | 773 | |
| 323 | 2026-04-14 | Bryan Asiimwe | 200,000 | 2 | 200,000 | 774 | |
| 324 | 2026-04-14 | Carlos Irene Kyakuwadde | 250,000 | 1 | 250,000 | 775 | |
| 325 | 2026-04-14 | Kironde Rashid Deo | 200,000 | 1 | 200,000 | 776 | |
| 326 | 2026-04-07 | Andrew Kaketo | 100,000 | 2 | 100,000 | 730 | |
| 327 | 2026-04-13 | Edson Kiyonga Bigabwa | 250,000 | 1 | 250,000 | 768 | |
| 328 | 2026-04-13 | Lilian Nabulya | 350,000 | 1 | 350,000 | 769 | |
| 329 | 2026-04-15 | Silas Chongeywo Zait | 400,000 | 2 | 400,000 | 777 | |
| 330 | 2026-04-15 | Mutungi Collins | 750,000 | 1 | 750,000 | 778 | |
| 333 | 2026-04-15 | Ronald Arineitwe | 50,000 | 1 | 50,000 | 779 | |
| 334 | 2026-04-02 | Monday Kalibala | 200,000 | 2 | 200,000 | 717 | |
| 335 | 2026-04-10 | Monday Kalibala | 180,000 | 2 | 180,000 | 761 | ○ open-invoice |
| 336 | 2026-04-10 | Hasuman Lubega | 100,000 | 1 | 100,000 | 762 | |
| 337 | 2026-04-15 | Mukooza George William | 500,000 | 2 | 500,000 | 780 | ○ open-invoice |
| 338 | 2026-04-15 | Musinguzi Andrew | 200,000 | 1 | 200,000 | 781 | |
| 339 | 2026-04-15 | Basiima Zulia | 200,000 | 1 | 200,000 | 782 | |
| 340 | 2026-04-15 | Hajjat Nassazi | 350,000 | 2 | 350,000 | 783 | ○ open-invoice |

**Column key:** `to_apply` = amount of `payment_auto_apply` entries that must be inserted (Dr 2150 / Cr 1210 for each allocation). `del_tx` = transaction id of phantom `payment` entry to soft-delete.

---

## 6. Class B4 — No Allocations Yet (2 payments, 390,000 UGX)

The phantom `payment` entry is present but no `payment_invoice_allocations` exist. Only the delete is needed now; auto_apply will be generated by normal flow when allocations are eventually created.

### Payment 165 — Solomon Musiimenta
- **Date:** 2026-04-05 | **Amount:** 140,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**564** (phantom, delete)
- **Allocations:** 0 | Auto-apply: 0
- **Classification:** B4
- **Proposed action:** Soft-delete tx_id=564. No auto_apply insertion needed until allocation is created.

### Payment 233 — Ruth Legombasia Matisho
- **Date:** 2026-04-07 | **Amount:** 250,000 UGX
- **GL entries:** `payment_advance` (keep) | `payment` tx_id=**613** (phantom, delete)
- **Allocations:** 0 | Auto-apply: 0
- **Classification:** B4
- **Proposed action:** Soft-delete tx_id=613. No auto_apply insertion needed until allocation is created.

---

## 7. Summary Totals

| Class | Payments | Payment Amount (UGX) | Phantom tx to delete | Auto-apply to insert (UGX) |
|---|---|---|---|---|
| B1 — Fully covered | 2 | 750,000 | 2 | 0 |
| B2 — Partial auto-apply | 10 | 8,100,000 | 10 | 3,550,000 |
| B3 — No auto-apply | 206 | 58,141,000 | 206 | 58,141,000 |
| B4 — No allocations | 2 | 390,000 | 2 | 0 |
| **TOTAL** | **220** | **67,381,000** | **220** | **61,691,000** |

Void-invoice payments (4): 21, 127, 128, 129, 239 — auto_apply insertion must be skipped or handled separately for these.  
Open-invoice payments (8): 45, 77, 78, 154, 281, 335, 337, 340 — auto_apply will close or partially close the invoice balance, which is correct.

---

## 8. Recommended Fix Order

### Step 1 — Soft-delete all 220 phantom `payment` entries
**Scope:** Set `is_deleted = true`, `deleted_at = now()` on transaction IDs: 498, 467, 496, 502, 464, 513, 565, 714, 715, 727, 729, 767, 564, 613, and all 206 `del_tx` values from the B3 table above.

**GL effect:** Removes 67,381,000 UGX of phantom credits to Account 1210 (AR-Tenants). No change to Account 2150 (Tenant Prepayments) — `payment` entries do not touch 2150.

**Why first:** Safe to do in isolation. Removes the phantom AR credits that are inflating tenant balances. Does not create any new entries. Reversible (un-delete by clearing `is_deleted`).

### Step 2 — Insert missing `payment_auto_apply` for B3 payments (206 payments)
**Scope:** For each allocation in each B3 payment, insert one `payment_auto_apply` transaction:
- `debit_account_id` = 2150 (Tenant Prepayments)
- `credit_account_id` = 1210 (AR-Tenants)
- `amount` = allocation `amount_applied`
- `source_type` = `'payment_auto_apply'`
- `source_id` = allocation `id`
- `description` = standard auto-apply description including tenant name

**Skip** void-invoice payments 21, 127, 128, 129, 239 until their allocation status is resolved (4 payments, 1,700,000 UGX).

**GL effect:** Reduces Account 2150 by 58,141,000 UGX (minus skipped void payments ~1,700,000 = ~56,441,000 net).

### Step 3 — Insert missing `payment_auto_apply` gaps for B2 payments (10 payments)
**Scope:** For each B2 payment, insert `payment_auto_apply` entries for the un-covered portion of each allocation.

| pay_id | tenant | gap (UGX) |
|---|---|---|
| 61 | Mukwasi Steven | 250,000 |
| 65 | Solomon Musiimenta | 150,000 |
| 70 | Godfrey Bongole | 1,500,000 |
| 126 | Ayesigwa Vonnie | 500,000 |
| 166 | Jonathan Owili | 150,000 |
| 266 | Ssentamu Islamic School-2 | 150,000 |
| 267 | Ssentamu Islamic School-3 | 150,000 |
| 283 | Rukundo M. | 300,000 |
| 285 | Winnie Lwadde Esther | 250,000 |
| 313 | Ocen Morish | 150,000 |
| **Total** | | **3,550,000** |

**GL effect:** Reduces Account 2150 by 3,550,000 UGX.

### Step 4 — Resolve void-invoice payments (deferred)
**Scope:** Payments 21, 127, 128, 129, 239. Determine whether the void is correct and whether the payment should be re-allocated or refunded. Until resolved, 2150 retains 1,700,000 UGX from these.

### Step 5 — B4 auto_apply (future, triggered by normal flow)
When allocations are created for payments 165 and 233, the application code's normal `payment_auto_apply` logic will generate the entries. No manual intervention needed beyond the Step 1 delete.

---

## 9. Estimated Tenant Prepayments (Account 2150) Balance Change

Current balance (2026-05-22): **76,970,000 UGX** (approximate, per audit-2026-05-22.md Section C)

| After step | Action | 2150 change (UGX) | Running balance (UGX) |
|---|---|---|---|
| Current | — | — | 76,970,000 |
| Step 1 | Delete 220 phantom `payment` entries | 0 | 76,970,000 |
| Step 2 | Insert B3 auto_apply (excl. void-invoice) | −56,441,000 | 20,529,000 |
| Step 3 | Insert B2 gap auto_apply | −3,550,000 | 16,979,000 |
| Step 4 | Resolve void-invoice (if re-allocated) | −1,700,000 | 15,279,000 |

Remaining ~15.3M after DPA cleanup comes from the other categories identified in audit-2026-05-22.md:
- Reversed payment advances not soft-deleted: ~5,600,000
- Missing auto_apply for 17 non-DPA payments: ~2,975,000
- Legitimately unallocated on-account advances: ~6,700,000

Expected true operational balance after all cleanup: **~6,700,000 UGX**
