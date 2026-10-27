# Implémentation de référence indépendante (Python, bibliothèque cryptography) du scellement de groupe BLE v1.
import hmac, hashlib, struct, json
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
SALT=b"MESHORA-BLE-v1"
def hk(room, info): return HKDF(algorithm=hashes.SHA256(), length=32, salt=SALT, info=info.encode()).derive(room.encode())
def frame_key(room, day): return hk(room, f"frame|{day}")
def id_key(room, day): return hk(room, f"id|{day}")
def seal(room, day, inner_type, data, iv):
    plain = bytes([inner_type]) + struct.pack(">H", len(data)) + data
    pad = (-len(plain)) % 128
    plain += b"\0"*pad
    aad = b"\x01" + struct.pack(">I", day)
    return aad + iv + AESGCM(frame_key(room, day)).encrypt(iv, plain, aad)
def frame_id(room, day, label): return hmac.new(id_key(room, day), label.encode(), hashlib.sha256).digest()[:16]
room="gvector2345678"; day=20388; iv=bytes(range(12))
v={"room":room,"day":day,"ivHex":iv.hex(),
   "frameKeyHex":frame_key(room,day).hex(),"idKeyHex":id_key(room,day).hex(),
   "sealedHex":seal(room,day,3,b'{"a":"b"}',iv).hex(),
   "idEnvHex":frame_id(room,day,"env|00ff").hex()}
print(json.dumps(v,indent=1))
