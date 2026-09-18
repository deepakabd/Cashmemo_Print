# Invoice cloud billing

Deploy the client, `/api/invoice-workspace` and updated Firestore rules together. Local development uses the same API handler through Vite. Firebase Admin credentials already used by login/admin APIs are required.

Billing API verifies revoked ID tokens, dealer ownership, active account and plan. Viewer accounts are read-only. Client writes to invoices, consumers and counters are denied by rules; mutations go through the API.

Data lives in `users/{userId}/invoices`, `consumers` and `billingCounters`. Numbers use `INV/{Indian financial year}/{sequence}`. Counter allocation and invoice creation are one transaction; stable request IDs make retries idempotent. Archived invoices retain their ID so cache migration cannot resurrect them. Invoices with recorded payments cannot be deleted.

On opening the workspace, existing local invoices without cloud numbers and cached consumers migrate sequentially with stable IDs. Interrupted migrations are safe to retry. Existing Paid status becomes an explicitly marked Legacy payment, not a newly claimed bank/cash receipt. Cache remains available offline; writes require a successful cloud sync. Malformed legacy records surface a migration error rather than being silently dropped.

Partial payments store amount, business date, mode, reference and recording timestamp. Server transactions reject negative amounts, excess precision, overpayments, invalid/future dates and payments before the invoice date. Ledger rows show invoice debits, payment credits, reversals, cancellations and adjustments, with balances per consumer. Date filtering retains the earlier running balance. Adjustments supports one opening balance per consumer and immutable manual debit/credit entries. Corrections use new entries rather than overwriting history. Consumer Statement includes opening, debit, credit, closing and CSV export. Refunds and invoice-linked credit/debit notes remain separate future work.

Payment History supports a reasoned reversal, preserving the original payment and recording actor/time. Cancel Invoice replaces hard deletion, preserving the invoice number and adding a cancelling ledger credit. Recorded payments must be reversed first. Cancelled invoices reject further payment/edit operations and are excluded from dashboard billing totals. Old delete API calls now require a reason and perform cancellation. Previously archived invoices remain archived for migration compatibility.

Search covers names, consumer numbers, mobile and invoice numbers. Generated invoices support date and Paid/Partial/Unpaid filters. Other sessions refresh through Sync Data; this is snapshot synchronization, not a real-time subscription.

Consumer records support editing and invoice-history navigation. Consumer numbers are immutable during editing and uniquely reserved by their canonical document ID. Unpaid invoices can be edited without changing their issued number/date; prior versions are retained in the server-only invoiceHistory subcollection. Payment-bearing invoices are locked.

Dashboard supports All Time, Today, This Month and Financial Year periods, optional due-date overdue alerts and current outstanding-consumer rankings. A4 printing uses the browser print dialog (choose Save as PDF). Share sends an invoice text summary through native sharing or a WhatsApp compose window; it does not publish a public invoice URL or automatically send messages. Browser exit warns about an unsaved billing draft.

No production deployment or remote-data migration was run during implementation. Rules emulator validation remains a deployment check.


Invoice-linked notes and refunds

The Notes / Refunds view records immutable credit/debit notes and refunds on the invoice document. Notes change the adjusted total without rewriting the issued invoice. Refunds are limited transactionally to excess active receipts above that adjusted total. Retries use stable entry IDs; changed payloads with an existing ID are rejected. Payments backing refunds cannot be reversed. Notes/refunds lock invoice editing. Ledger and consumer statements retain each receipt, note, and refund.

Outstanding Ageing groups positive balances by days past the due date (invoice date fallback): not due, 0?30, 31?60, 61?90 and 90+. Cancelled invoices are excluded. Direct downloadable PDF remains future work; the existing print dialog is unchanged. These changes have not been deployed.


Bin and modification

Consumer List offers Modify Consumer and Delete Consumer; Generated Invoice offers Modify Invoice and Delete Invoice. Delete moves the record into a cloud-persisted Bin using a `trashed` flag, deletion time and actor. Restore clears that flag and retains the original ID and invoice number. Normal lists exclude trashed records; trashed consumer master records suppress consumers inferred from invoice history. Trashed invoices are excluded from active dashboard totals, records, ledger, statements and ageing. Their original transactions remain stored in Bin for restoration. Trashed consumers are excluded from consumer records, counts, ledger and statement selectors; independently stored invoices are not cascade-deleted. Trashed records reject edit/payment operations until restored. Paid or corrected invoices keep existing edit restrictions; use notes for financial corrections. No permanent deletion is provided.


Bulk Consumer Import

The sidebar menu below Add Consumer accepts Excel .xlsx/.xls up to 5 MB. Download Template supplies Consumer Name, Consumer Number, Mobile Number, Address and GSTIN. Preview validates name/number/mobile and in-file duplicate numbers. Imports contain 1?400 consumers and save through one authenticated Firestore transaction; existing consumer numbers, including Bin records, reject the complete import. An identical complete import replays safely. Consumer number is read as formatted text to preserve leading zeros. Center Number has been removed from consumer forms, runtime invoice drafts and printable invoices; legacy cloud fields are not migrated or deleted.
