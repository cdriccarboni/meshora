# Implémentation de référence indépendante (Python, bibliothèque cryptography) de l'étape A V0.4 :
# prékeys de réception signées, HKDF-SHA256, enveloppe v3. Spécification : docs/PROTOCOLE-V0.4-PROPOSITION.md.
# Produit docs/tests/v0.4/prekey-vectors.json, relu à l'identique par TypeScript et Kotlin.
import hashlib, json, sys
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

def key(scalar): return ec.derive_private_key(scalar, ec.SECP256R1())
def spki_hex(priv): return priv.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo).hex()
def pkcs8_hex(priv): return priv.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).hex()
def sign(priv, text):  # ECDSA P-256 / SHA-256, format P1363 (r||s), comme WebCrypto
    r, s = decode_dss_signature(priv.sign(text.encode(), ec.ECDSA(hashes.SHA256())))
    return (r.to_bytes(32, "big") + s.to_bytes(32, "big")).hex()
def verify(pub_hex, sig_hex, text):
    pub = serialization.load_der_public_key(bytes.fromhex(pub_hex))
    sig = bytes.fromhex(sig_hex)
    try:
        pub.verify(encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")), text.encode(), ec.ECDSA(hashes.SHA256()))
        return True
    except Exception:
        return False

def prekey_id(prekey_pub_hex): return hashlib.sha256(bytes.fromhex(prekey_pub_hex)).hexdigest()[:16]
def prekey_string(identity_pub, prekey_pub, pid, expires): return f"PREKEY|v1|{identity_pub}|{prekey_pub}|{pid}|{expires}"
def hkdf_info(sender, recipient, pid): return f"MESHORA-ENV|v3|{sender}|{recipient}|{pid}"
def message_key(shared, salt, info): return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info.encode()).derive(shared)
def env3_string(e): return "ENV3|" + "|".join(str(e[k]) for k in ("id", "senderPublicKeyHex", "recipientPublicKeyHex", "prekeyId", "ephemeralPublicKeyHex", "saltHex", "ivHex", "ciphertextHex", "timestamp"))

alice = key(0xA11CE0000000000000000000000000000000000000000000000000000000001)   # expéditrice (identité)
bob = key(0xB0B0000000000000000000000000000000000000000000000000000000000002)     # destinataire (identité)
bob_pk = key(0xB0B0FE0000000000000000000000000000000000000000000000000000000003)  # prékey de Bob
eph = key(0xEFE0000000000000000000000000000000000000000000000000000000000004)     # clé éphémère d'Alice
salt = bytes(range(32)); iv = bytes(range(100, 112))
expires = 1793145600000  # 2026-10-28T00:00:00Z (valeur fixe)
pid = prekey_id(spki_hex(bob_pk))
pk_sig = sign(bob, prekey_string(spki_hex(bob), spki_hex(bob_pk), pid, expires))
shared = eph.exchange(ec.ECDH(), bob_pk.public_key())
assert shared == bob_pk.exchange(ec.ECDH(), eph.public_key())
info = hkdf_info(spki_hex(alice), spki_hex(bob), pid)
mk = message_key(shared, salt, info)
plaintext = "Bonjour Bob — confidentialité persistante (v3)"
ct = AESGCM(mk).encrypt(iv, plaintext.encode(), None)
env = {"v": 3, "id": "vec-v3-1", "senderPublicKeyHex": spki_hex(alice), "recipientPublicKeyHex": spki_hex(bob), "prekeyId": pid,
       "ephemeralPublicKeyHex": spki_hex(eph), "saltHex": salt.hex(), "ivHex": iv.hex(), "ciphertextHex": ct.hex(), "timestamp": 1793100000000}
env["signatureHex"] = sign(alice, env3_string(env))
assert verify(env["senderPublicKeyHex"], env["signatureHex"], env3_string(env))
assert AESGCM(message_key(bob_pk.exchange(ec.ECDH(), eph.public_key()), salt, info)).decrypt(iv, ct, None).decode() == plaintext

vectors = {
    "comment": "Étape A V0.4 — vecteurs produits par tools/audit/prekey-reference.py (Python cryptography). Les signatures ECDSA sont aléatoires : les implémentations doivent les VÉRIFIER, pas les reproduire.",
    "aliceIdentityPublicHex": spki_hex(alice),
    "bobIdentityPublicHex": spki_hex(bob),
    "bobIdentityPrivatePkcs8Hex": pkcs8_hex(bob),
    "prekey": {"publicKeyHex": spki_hex(bob_pk), "id": pid, "expiresAt": expires, "signatureHex": pk_sig},
    "prekeyPrivatePkcs8Hex": pkcs8_hex(bob_pk),
    "prekeySignedString": prekey_string(spki_hex(bob), spki_hex(bob_pk), pid, expires),
    "ephemeralPrivatePkcs8Hex": pkcs8_hex(eph),
    "sharedSecretHex": shared.hex(),
    "hkdfInfo": info,
    "messageKeyHex": mk.hex(),
    "plaintext": plaintext,
    "envelope": env,
    "envelopeSignedString": env3_string(env),
}
out = sys.argv[1] if len(sys.argv) > 1 else "docs/tests/v0.4/prekey-vectors.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(vectors, f, ensure_ascii=False, indent=1)
print("vecteurs écrits :", out, "| prekeyId", pid, "| clé de message", mk.hex()[:16] + "…")
