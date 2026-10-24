# e-KOFI NFC registrar

Android app that uses the platform NFC APIs to read a tag UID, read/write an `EKOFI:` NDEF auth token, and call the NestJS card endpoints.

Payments never authenticate on UID alone. If a tag has no token, registration issues one and the next tap writes it.
