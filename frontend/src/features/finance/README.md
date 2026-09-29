# Finance feature

Owns the existing finance pages and action contracts: meter readings, periods,
receivables, collection and receipts, reconciliation, cash handover, and debt.
The feature remains a classic script while legacy elimination is in progress.

`A.canDirectCollect` and `A.canCollectReceivable` retain
their existing public semantics until their dedicated shared-core extraction.
