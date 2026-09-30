# App lock gates the voter client visit

The voter client must not show its screens or create a user private key until
the person holding the device authenticates (`CONTEXT.md`, issue #57). Recovery
of that key is out of scope. The app lock is one OS prompt per foreground
visit — biometrics, or the device passcode when biometrics are missing — and
it closes when the app leaves the foreground, before the app-switcher snapshot.
Dismissing the prompt leaves only a control that raises it again. A device
with neither biometrics nor a passcode stays closed, and no key is created.
Debug builds use the same lock. The user private key stays in the device
secure store for this device only and is read only after the visit opens. We
rejected binding the stored key to current biometrics (a Face ID or fingerprint
change would make it unreadable, with no recovery), a password held by the
app, a prompt on every key read, opening the visit when the device cannot
authenticate, restoring the key from a backup, and a debug skip.
