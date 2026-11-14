#!/usr/bin/env python3
"""Translate paired {pl,en} strings in data/site.json using DeepL.
Existing English is preserved; edits to English are treated as manual overrides.
Clear an English field to return it to automatic translation.
"""
import os, json, hashlib, urllib.parse, urllib.request, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA=os.path.join(ROOT,"data","site.json")
STATE=os.path.join(ROOT,".translation-state.json")
KEY=os.environ.get("DEEPL_AUTH_KEY","").strip()
if not KEY:
    print("DEEPL_AUTH_KEY is not configured; skipping translations.")
    sys.exit(0)

def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def deepl_translate(value):
    if not value or not value.strip():
        return value
    endpoint = "https://api-free.deepl.com/v2/translate" if KEY.endswith(":fx") else "https://api.deepl.com/v2/translate"
    payload=urllib.parse.urlencode({"text": value, "source_lang":"PL", "target_lang":"EN-GB"}).encode()
    req=urllib.request.Request(endpoint, data=payload, headers={"Authorization":"DeepL-Auth-Key "+KEY,"Content-Type":"application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=45) as response:
        result=json.loads(response.read().decode("utf-8"))
    return result["translations"][0]["text"]

with open(DATA,encoding="utf-8") as f:
    data=json.load(f)
if os.path.exists(STATE):
    with open(STATE,encoding="utf-8") as f: state=json.load(f)
else:
    # Adopt current translations as baseline, so the first run never overwrites them.
    state={}
    def seed(node,path=""):
        if isinstance(node,dict):
            if isinstance(node.get("pl"),str) and isinstance(node.get("en"),str):
                state[path]={"pl":digest(node["pl"]),"en":digest(node["en"]),"locked":False}
                return
            for k,v in node.items(): seed(v, f"{path}/{k}")
        elif isinstance(node,list):
            for i,v in enumerate(node): seed(v,f"{path}/{i}")
    seed(data)

translated=0
errors=[]
def walk(node,path=""):
    global translated
    if isinstance(node,dict):
        if isinstance(node.get("pl"),str) and isinstance(node.get("en"),str):
            pl=node["pl"]; en=node["en"]
            old=state.get(path)
            if old is None:
                # New field: blank English means automatic; existing English is respected.
                if en.strip():
                    state[path]={"pl":digest(pl),"en":digest(en),"locked":False}
                    return
                old={"pl":"","en":"","locked":False}
            # A changed English value means a manual override. Empty English opts back in.
            if en.strip() and old.get("en") and digest(en)!=old.get("en"):
                old["locked"]=True
            if not en.strip():
                old["locked"]=False
            source_changed=digest(pl)!=old.get("pl")
            needs_translation=bool(pl.strip()) and (not en.strip() or (source_changed and not old.get("locked")))
            if needs_translation:
                try:
                    new_en=deepl_translate(pl)
                    node["en"]=new_en
                    state[path]={"pl":digest(pl),"en":digest(new_en),"locked":False}
                    translated+=1
                except Exception as exc:
                    errors.append(f"{path}: {exc}")
                    state[path]=old
            else:
                old["pl"]=digest(pl)
                if en.strip(): old["en"]=digest(en)
                state[path]=old
            return
        for k,v in node.items(): walk(v,f"{path}/{k}")
    elif isinstance(node,list):
        for i,v in enumerate(node): walk(v,f"{path}/{i}")
walk(data)
if errors:
    print("Translation errors:\n"+"\n".join(errors),file=sys.stderr)
    # Keep successful translations, but fail the workflow so the problem is visible.
    with open(DATA,"w",encoding="utf-8") as f: json.dump(data,f,ensure_ascii=False,indent=2); f.write("\n")
    with open(STATE,"w",encoding="utf-8") as f: json.dump(state,f,ensure_ascii=False,indent=2); f.write("\n")
    sys.exit(1)
with open(DATA,"w",encoding="utf-8") as f:
    json.dump(data,f,ensure_ascii=False,indent=2); f.write("\n")
with open(STATE,"w",encoding="utf-8") as f:
    json.dump(state,f,ensure_ascii=False,indent=2); f.write("\n")
print(f"Translated {translated} Polish text field(s).")
