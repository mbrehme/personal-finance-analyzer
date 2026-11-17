# Personal Finance Analyzer

Local-first personal finance domain for tracking bank accounts, virtual subaccounts, hierarchical categories, and directed money flows.

## Language

**Account**:
A real bank account identified by an IBAN with optional dated balance checkpoints.
_Avoid_: Depot, Bankverbindung (when referring to the domain entity)

**Virtual Account**:
A logical subaccount nested under a real Account that tracks a subset of transactions by category or explicit assignment without double-counting the parent Account's total balance.
_Avoid_: Sub-bucket, shadow account

**Category**:
A node in the hierarchical classification tree (German UI: _Kategorie_); only leaf Categories hold regex matching rules.
_Avoid_: Bucket

**Manual Override**:
A user edit to a transaction's fields or Category assignment that is protected from being overwritten by automatic regex re-matching or CSV re-imports.
_Avoid_: Hardcode, lock

**Counterpart**:
The matching opposite-sign booking on another Account's statement for the same internal transfer, reconciled within the value-date and amount tolerance window to prevent double-counting.
_Avoid_: Duplicate (for two-sided transfers)

**Split Transaction**:
A child booking carved out of a parent booking's amount so each part can carry its own Category while preserving the original bank total.
_Avoid_: Sub-transaction, partial booking
