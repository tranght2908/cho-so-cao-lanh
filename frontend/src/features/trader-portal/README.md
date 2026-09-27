# Trader portal feature

Owns the existing Mini App shell, mock phone/OTP entry, trader and collector
portal views, and the remaining effective `mini-*` handlers. Its feature calls
the existing contracts exposed by finance, market sessions, and complaints.

The obsolete fixed-stall application flow is intentionally not available; only
the session-registration path remains in the portal.
