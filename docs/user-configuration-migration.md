User configuration reads prefer singleton subdocuments for profile, bank,
cashmemo settings, rates, header, delivery area and delivery staff. Only a missing
document falls back to the parent field. Null and empty values clear configuration.
Read failures or cached subdocument reads are errors, not successful legacy reads.

Client writes use updateUserData and commit parent compatibility copies and
singleton replacements in one batch. Server create/approve/edit/restore writes
use the same path schema and transaction. Rules require both copies to match
after configuration changes, preventing old clients from writing only one copy.
Deploy client, API and rules together; old clients must refresh. No production
backfill or rule deployment has been performed. Existing unmigrated accounts
continue using parent fields until their next configuration write.

Devices and pending dictionary requests stay parent-owned. Their former item
mirrors are ignored because they cannot represent removals reliably. Restoring
an account replaces singleton values and clears omitted configuration, preventing
orphaned subdocuments from a deleted account from resurfacing.
